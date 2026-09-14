// Run against a new disposable database on the local MySQL server. Never reset
// the application's database, and never print connection credentials.
const { loadEnvConfig } = require("@next/env");
const { PrismaClient } = require("@prisma/client");
const { randomBytes } = require("crypto");
const { spawnSync } = require("child_process");

async function main() {
    loadEnvConfig(process.cwd());
    const source = new URL(process.env.DATABASE_URL);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(source.hostname)) throw new Error("This test runner requires local MySQL.");
    const databaseName = `cmdb_merge_test_${randomBytes(8).toString("hex")}`;
    const target = new URL(source);
    target.pathname = `/${databaseName}`;
    if (!/^cmdb_merge_test_[a-f0-9]{16}$/.test(databaseName) || target.pathname === source.pathname) throw new Error("Invalid disposable database target.");
    const admin = new PrismaClient({ datasourceUrl: source.toString() });
    let created = false;
    try {
        await admin.$executeRawUnsafe(`CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        created = true;
        const env = { ...process.env, DATABASE_URL: target.toString(), USER_MERGE_TEST_DATABASE_URL: target.toString(), SESSION_SECRET_KEY: "merge-integration-test-secret-only" };
        const schema = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], { env, stdio: "inherit" });
        if (schema.status !== 0) throw new Error("Unable to create the disposable schema.");
        const tests = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/userMerge.mysql.test.ts", "--threads=false"], { env, stdio: "inherit" });
        process.exitCode = tests.status || (tests.error ? 1 : 0);
    } finally {
        if (created) await admin.$executeRawUnsafe(`DROP DATABASE \`${databaseName}\``);
        await admin.$disconnect();
    }
}

main().catch(() => {
    console.error("MySQL merge tests failed. Check the local server and disposable-database privileges.");
    process.exitCode = 1;
});
