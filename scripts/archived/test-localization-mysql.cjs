// Validate the target schema in a fresh local database without replacing the app's Prisma client.
const { loadEnvConfig } = require("@next/env");
const { PrismaClient } = require("@prisma/client");
const { randomBytes } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
    const projectRoot = path.resolve(__dirname, "..");
    loadEnvConfig(projectRoot);
    const source = new URL(process.env.DATABASE_URL);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(source.hostname)) {
        throw new Error("This test runner requires local MySQL.");
    }
    const databaseName = `cmdb_localization_test_${randomBytes(8).toString("hex")}`;
    const target = new URL(source);
    target.pathname = `/${databaseName}`;
    if (!/^cmdb_localization_test_[a-f0-9]{16}$/.test(databaseName) || target.pathname === source.pathname) {
        throw new Error("Invalid disposable database target.");
    }
    const temporaryParent = path.join(projectRoot, "temp");
    fs.mkdirSync(temporaryParent, { recursive: true });
    const temporaryRoot = fs.mkdtempSync(path.join(temporaryParent, "localization-schema-"));
    const admin = new PrismaClient({ datasourceUrl: source.toString() });
    const env = { ...process.env, DATABASE_URL: target.toString(), LOCALIZATION_TEST_DATABASE_URL: target.toString() };
    const run = (args) => {
        const result = spawnSync(process.execPath, args, { cwd: projectRoot, env, stdio: "inherit", windowsHide: true });
        if (result.error || result.status !== 0) throw new Error("Schema validation command failed.");
    };
    let created = false;
    try {
        await admin.$executeRawUnsafe(`CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        created = true;
        run(["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--schema", "db/schema.prisma"]);
        // Generate into this temporary directory, leaving the current application client intact.
        const schema = fs.readFileSync(path.join(projectRoot, "db/schema.prisma"), "utf8")
            .replace(/provider\s*=\s*"prisma-client-js"/, 'provider = "prisma-client-js"\n  output = "./client"');
        const temporarySchema = path.join(temporaryRoot, "schema.prisma");
        fs.writeFileSync(temporarySchema, schema);
        run(["node_modules/prisma/build/index.js", "generate", "--schema", temporarySchema]);
        run(["scripts/test-unit.cjs", "tests/localizationMultitenancy.mysql.test.ts", "--reporter=dot"]);
    } finally {
        try {
            if (created) await admin.$executeRawUnsafe(`DROP DATABASE \`${databaseName}\``);
        } finally {
            await admin.$disconnect();
            // Verify the resolved target before recursively removing temporary artifacts on Windows.
            const relative = path.relative(temporaryParent, path.resolve(temporaryRoot));
            if (!relative || path.isAbsolute(relative) || relative.startsWith("..") || relative.includes(path.sep)) {
                throw new Error("Invalid temporary artifact directory.");
            }
            fs.rmSync(temporaryRoot, { recursive: true, force: true });
        }
    }
}

main().catch(() => {
    console.error("MySQL localization tests failed. Check the command output and local disposable-database privileges.");
    process.exitCode = 1;
});
