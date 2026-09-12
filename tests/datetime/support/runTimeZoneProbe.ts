import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

// Set TZ before Node starts: changing it inside a Vitest worker does not reliably
// change native Date behavior on every supported development platform.
export function runTimeZoneProbe<T>(fixturePath: string, timeZone: string): T {
  const result = spawnSync(process.execPath, [
    "-r", require.resolve("ts-node/register/transpile-only"),
    "-r", require.resolve("tsconfig-paths/register"),
    resolve(fixturePath),
  ], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TZ: timeZone,
      TS_NODE_COMPILER_OPTIONS: JSON.stringify({ module: "CommonJS", jsx: "react-jsx" }),
    },
    encoding: "utf8",
    timeout: 15_000,
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
  })

  if (result.error || result.status !== 0) {
    throw new Error(`Date/time probe failed in ${timeZone}: ${result.error?.message || result.stderr || result.stdout}`)
  }
  return JSON.parse(result.stdout) as T
}
