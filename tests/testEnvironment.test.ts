import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { isDeferredTestFile } from "../scripts/lib/migration-restoration.cjs"

function findTestFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return findTestFiles(entryPath)
    return /\.test\.tsx?$/.test(entry.name) ? [entryPath] : []
  })
}

const testFiles = findTestFiles(path.join(process.cwd(), "tests"))

describe("Vitest environment boundaries", () => {
  it("uses Vitest's jsdom environment for every React DOM test", () => {
    const missingJsdomEnvironment = testFiles.filter(file => {
      const source = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")
      if (isDeferredTestFile(source, file)) {
        return false
      }
      const importsReactDom = /from\s+["']react-dom\/(?!server["'])/.test(source)
      return importsReactDom && !source.startsWith("// @vitest-environment jsdom")
    })

    expect(missingJsdomEnvironment.map(file => path.relative(process.cwd(), file))).toEqual([])
  })

  it("does not install hand-built JSDOM globals inside test files", () => {
    const manualDomTests = testFiles.filter(file => {
      const source = fs.readFileSync(file, "utf8")
      if (isDeferredTestFile(source, file)) {
        return false
      }
      return /from\s+["']jsdom["']/.test(source) || /new\s+JSDOM\s*\(/.test(source)
    })

    expect(manualDomTests.map(file => path.relative(process.cwd(), file))).toEqual([])
  })
})
