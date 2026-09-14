// Read-only preflight for 20260914000000_user_sign_in_methods.
// Report user IDs, never login identifiers or password hashes.
const { loadEnvConfig } = require("@next/env");
const { PrismaClient } = require("@prisma/client");
const { z } = require("zod");

async function main() {
    loadEnvConfig(process.cwd(), false, { info() {}, error: console.error });
    const db = new PrismaClient();
    try {
        const rows = await db.$queryRaw`SELECT id, email, googleId FROM User ORDER BY id`;
        const owners = new Map();
        const problems = [];
        const emailSchema = z.string().email().max(320);
        for (const row of rows) {
            const methods = [["email", row.email.trim().toLowerCase()]];
            if (row.googleId !== null) methods.push(["google", row.googleId]);
            for (const [type, identifier] of methods) {
                const valid = type === "email" ? emailSchema.safeParse(identifier).success
                    : /^[\x21-\x7e]{1,255}$/.test(identifier) && !identifier.includes("@");
                if (!valid) problems.push({ type, userId: row.id, issue: "invalid identifier" });
                const key = `${type}:${identifier}`;
                if (owners.has(key)) problems.push({ type, userIds: [owners.get(key), row.id], issue: "duplicate ownership" });
                else owners.set(key, row.id);
            }
        }
        console.log(JSON.stringify({ users: rows.length, methods: owners.size, problems }, null, 2));
        if (problems.length) process.exitCode = 1;
    } finally {
        await db.$disconnect();
    }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
