/**
 * Smoke-tests native Node dependencies used by the application.
 *
 * Intended for the GitHub Actions release workflow. Run from the repository
 * root inside scripts/release/Dockerfile after build.mjs has installed packages.
 * Usage: node scripts/release/check-native.cjs
 * It checks Sharp and password hashing without connecting to a database.


docker run --rm `
  --volume "${PWD}:/workspace" `
  --env DATABASE_URL=mysql://build:build@127.0.0.1:3306/cmdb_build `
  --env SESSION_SECRET_KEY=cmdb-build-placeholder-not-a-runtime-secret `
  --env CMDB_BASE_URL=http://localhost:10455 `
  --env FILE_UPLOAD_PATH=/tmp/cmdb-build-uploads `
  --env NODE_OPTIONS=--max-old-space-size=5632 `
  cmdb-release node scripts/release/check-native.cjs



*/

const assert = require("node:assert/strict")
const sharp = require("sharp")
const securePassword = require("secure-password")

async function main() {
    const image = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).png().toBuffer()
    assert.ok(image.length > 0)
    const passwords = securePassword()
    const password = Buffer.from("cmdb-build-runtime-check")
    const hash = await passwords.hash(password)
    assert.equal(await passwords.verify(password, hash), securePassword.VALID)
    console.log("Sharp and password hashing work with the release runtime.")
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
