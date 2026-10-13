const { loadEnvConfig } = require("@next/env");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

require("ts-node").register({ compilerOptions: { module: "CommonJS" } });
const { demoHelp, demoPassword, parseDemoConfig, resolveDemoDatabaseUrl } = require("../db/seeding/demo/config");

function runNode(args, env) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, { env, stdio: "inherit", windowsHide: true });
        child.on("error", reject);
        child.on("exit", (code, signal) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Demo subprocess failed (${signal || code}).`));
            }
        });
        for (const signal of ["SIGINT", "SIGTERM"]) {
            process.once(signal, () => child.kill(signal));
        }
    });
}

async function main() {
    const [operation, ...args] = process.argv.slice(2);
    if (args.includes("--help")) {
        console.log(demoHelp);
        return;
    }
    if (!["reset", "dev", "build", "start"].includes(operation)) {
        throw new Error("Use yarn demo:reset, yarn demo:dev, yarn demo:build, or yarn demo:start.");
    }
    if (operation !== "reset" && args.length) {
        throw new Error("Generator options belong to yarn demo:reset. Use --help.");
    }
    // Reject malformed generator options before connecting or resetting anything.
    const config = parseDemoConfig(args);
    loadEnvConfig(process.cwd(), operation === "dev");
    const target = resolveDemoDatabaseUrl(process.env.DATABASE_URL, process.env.DEMO_DATABASE_URL);
    const assetDirectory = path.resolve("temp/demo-assets", target.pathname.slice(1));
    const port = process.env.DEMO_PORT ?? "10455";
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
        throw new Error("DEMO_PORT must be an integer from 1 to 65535.");
    }
    const env = { ...process.env, DATABASE_URL: target.toString(), FILE_UPLOAD_PATH: assetDirectory,
        // This fixture deliberately hosts two bands on one development origin.
        CMDB_DEMO: "1", CMDB_HOSTING_MODE: "Platform", CMDB_BASE_URL: `http://localhost:${port}` };
    console.log(`Demo database: ${target.hostname}:${target.port || "3306"}${target.pathname}`);
    if (operation === "reset") {
        if (process.env.NODE_ENV === "production") {
            throw new Error("Run demo resets from a development environment.");
        }
        const adminUrl = new URL(target);
        adminUrl.pathname = "/mysql";
        const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
        try {
            // The target name was restricted to a single SQL identifier before connecting.
            await admin.$executeRawUnsafe(`CREATE DATABASE IF NOT EXISTS \`${target.pathname.slice(1)}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        } finally {
            await admin.$disconnect();
        }
        // The validated local demo target is the only database this command resets.
        await runNode(["node_modules/prisma/build/index.js", "migrate", "reset", "--force", "--skip-generate", "--skip-seed"], env);
        const { seedDemoDatabase } = require("../db/seeding/demo/seed");
        await seedDemoDatabase(target.toString(), config, assetDirectory);
        console.log(`Seeded ${config.bands} bands, ${config.membersPerBand} members/band, ${config.songsPerBand} songs/band, ${config.eventsPerBand} events/band.`);
        console.log(`Locales: ${config.locales.join(", ")}; seed: ${config.seed}; reference date: ${config.referenceDate}.`);
        console.log(`Login: admin@demo.invalid, shared@demo.invalid, manager1@demo.invalid, member1-1@demo.invalid. Password: ${demoPassword}`);
        console.log("Run yarn demo:dev, or yarn demo:build then yarn demo:start. Walkthrough: docs/demo-seeding.md");
        return;
    }
    const command = [require.resolve("blitz/bin/blitz"), operation];
    if (operation !== "build") {
        command.push("--port", port);
    }
    await runNode(command, env);
}

main().catch(error => {
    // Prisma connection failures can include URLs; keep credentials out of runner diagnostics.
    console.error(String(error.message).replace(/mysql:\/\/[^\s"']+/g, "[database connection]"));
    process.exitCode = 1;
});
