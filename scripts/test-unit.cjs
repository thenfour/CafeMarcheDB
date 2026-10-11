// wrapper which runs all tests,
// including both Node and jsdom test environments

const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const { inspectRestoration } = require("./lib/migration-restoration.cjs")

const projectRoot = path.resolve(__dirname, "..")
const testsRoot = path.join(projectRoot, "tests")
const vitestEntry = path.join(projectRoot, "node_modules", "vitest", "vitest.mjs")

function findTestFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return findTestFiles(entryPath)
    return /\.test\.tsx?$/.test(entry.name) ? [entryPath] : []
  })
}

function relativeTestPath(file) {
  return path.relative(projectRoot, file).replaceAll(path.sep, "/")
}

function fail(message) {
  console.error(`[unit-tests] ${message}`)
  process.exit(1)
}

const allTestFiles = [
  ...findTestFiles(testsRoot),
  ...findTestFiles(path.join(projectRoot, "src"))
].sort()
const selectors = []
const vitestArgs = []
const optionsWithValues = new Set(["--reporter", "--testNamePattern", "-t", "--mode", "--testTimeout", "--hookTimeout"])
const unsupportedOptions = ["--threads", "--runInBand", "--shard", "--environment", "--dir"]

for (let i = 2; i < process.argv.length; i += 1) {
  const argument = process.argv[i]
  const unsupported = unsupportedOptions.find(option => argument === option || argument.startsWith(`${option}=`))
  if (unsupported) fail(`Do not pass ${unsupported}; the repository test runner owns process and environment isolation.`)

  if (argument.startsWith("-")) {
    vitestArgs.push(argument)
    if (optionsWithValues.has(argument)) {
      const value = process.argv[++i]
      if (!value) fail(`${argument} requires a value.`)
      vitestArgs.push(value)
    }
    continue
  }

  selectors.push(argument)
}

function filesForSelector(selector) {
  const resolved = path.resolve(projectRoot, selector)
  if (fs.existsSync(resolved)) {
    const stat = fs.statSync(resolved)
    if (stat.isDirectory()) return findTestFiles(resolved)
    if (stat.isFile()) return [resolved]
  }

  const normalizedSelector = selector.replaceAll("\\", "/").replace(/^\.\//, "")
  return allTestFiles.filter(file => relativeTestPath(file).includes(normalizedSelector))
}

const requestedTestFiles = selectors.length === 0
  ? allTestFiles
  : [...new Set(selectors.flatMap(filesForSelector))].sort()

if (requestedTestFiles.length === 0) fail(`No test files matched: ${selectors.join(", ")}`)

let deferredTestFiles
try {
  // Missing or damaged references fail even when the selected tests are unrelated.
  deferredTestFiles = new Set(inspectRestoration(projectRoot).deferredTestFiles)
} catch (error) {
  fail(error.message)
}
const preservedTestFiles = requestedTestFiles.filter(file => deferredTestFiles.has(relativeTestPath(file)))
const selectedTestFiles = requestedTestFiles.filter(file => !deferredTestFiles.has(relativeTestPath(file)))
if (preservedTestFiles.length > 0) {
  console.log(`[unit-tests] ${preservedTestFiles.length} deferred specifications preserved as comments; these are not executed tests.`)
}
if (selectedTestFiles.length === 0) {
  fail("The selection contains only deferred specifications. No executable tests ran.")
}

const jsdomDirective = "// @vitest-environment jsdom"
const jsdomTestFiles = []
const nodeTestFiles = []

for (const file of selectedTestFiles) {
  const source = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")
    ; (source.startsWith(jsdomDirective) ? jsdomTestFiles : nodeTestFiles).push(file)
}

function runVitest(files, label) {
  console.log(`[unit-tests] ${label} (${files.length} ${files.length === 1 ? "file" : "files"})`)
  const result = spawnSync(process.execPath, [
    vitestEntry,
    "run",
    ...files.map(relativeTestPath),
    ...vitestArgs,
    "--threads=false",
  ], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  })

  if (result.error) {
    console.error(result.error)
    return 1
  }
  return result.status ?? 1
}

if (nodeTestFiles.length > 0) {
  const status = runVitest(nodeTestFiles, "Node test batch")
  if (status !== 0) process.exit(status)
}

const failedJsdomFiles = []
for (const file of jsdomTestFiles) {
  const status = runVitest([file], `Isolated jsdom test: ${relativeTestPath(file)}`)
  if (status !== 0) failedJsdomFiles.push(relativeTestPath(file))
}

if (failedJsdomFiles.length > 0) {
  fail(`Failed jsdom files: ${failedJsdomFiles.join(", ")}`)
}

console.log(`[unit-tests] Passed ${selectedTestFiles.length} test files.`)
