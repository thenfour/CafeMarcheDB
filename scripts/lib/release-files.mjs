/**
 * Small filesystem helpers shared by the release/deployment scripts.
 *
 * Internal module; do not run it directly. It centralizes JSON files, streaming
 * checksums, executable entry-point detection and consistent error reporting.
 */

import fs from "node:fs"
import crypto from "node:crypto"
import path from "node:path"
import { fileURLToPath } from "node:url"

export function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

export function writeJson(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n")
}

export async function sha256File(filePath) {
    const hash = crypto.createHash("sha256")
    for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk)
    return hash.digest("hex")
}

export function isMain(metaUrl) {
    return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(metaUrl)
}

export function reportError(error) {
    console.error(`Error: ${error.message || error}`)
    process.exitCode = 1
}
