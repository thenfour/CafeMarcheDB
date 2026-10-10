// Own a disposable native database; never benchmark against application data.
const { PrismaClient } = require("@prisma/client")
const { randomBytes } = require("node:crypto")
const { spawnSync } = require("node:child_process")
const path = require("node:path")

async function main() {
  const projectRoot = path.resolve(__dirname, "..")
  const serverUrl = process.env.CMDB_BENCHMARK_DATABASE_SERVER_URL || "mysql://root@127.0.0.1:32695/mysql"
  const server = new URL(serverUrl)
  if (server.hostname !== "127.0.0.1" || !["32691", "32693", "32694", "32695"].includes(server.port)
    || server.pathname !== "/mysql") {
    throw new Error("The benchmark requires a local disposable MariaDB test server.")
  }
  const name = `lsmb_phase2_${randomBytes(6).toString("hex")}`
  const admin = new PrismaClient({ datasourceUrl: serverUrl })
  let created = false
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    created = true
    server.pathname = `/${name}`
    const env = { ...process.env, DATABASE_URL: server.href, CMDB_PHASE2_TEST_DATABASE_URL: server.href,
      CMDB_RUN_DASHBOARD_RELEVANCE_BENCHMARK: "1" }
    const schema = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"],
      { cwd: projectRoot, env, stdio: "inherit", windowsHide: true })
    if (schema.status !== 0) {
      throw new Error("Benchmark schema setup failed.")
    }
    const command = "yarn test tests/performance/dashboardEventSearch.mysql.test.ts --reporter=dot"
    const run = process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", command], { cwd: projectRoot, env, stdio: "inherit", windowsHide: true })
      : spawnSync("yarn", ["test", "tests/performance/dashboardEventSearch.mysql.test.ts", "--reporter=dot"],
        { cwd: projectRoot, env, stdio: "inherit" })
    process.exitCode = run.status || (run.error ? 1 : 0)
  } finally {
    if (created) {
      await admin.$executeRawUnsafe(`DROP DATABASE \`${name}\``)
    }
    await admin.$disconnect()
  }
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
