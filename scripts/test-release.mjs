/**
 * Runs the release/deployment tooling tests without publishing or deploying.
 *
 * Intended for developers and CI. Run from any repository checkout with Node
 * 18.20.8 using: node scripts/test-release.mjs
 * Tests use temporary repositories and simulate GitHub, MySQL and Supervisor.
 */

// Expand the test files ourselves: Windows shells and Node 18 do not expand globs.
import fs from "node:fs"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const directory = new URL("./tests/", import.meta.url)
const tests = fs.readdirSync(directory).filter((name) => name.endsWith(".test.mjs"))
    .sort().map((name) => fileURLToPath(new URL(name, directory)))
const result = spawnSync(process.execPath, ["--test", ...tests], { stdio: "inherit" })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
