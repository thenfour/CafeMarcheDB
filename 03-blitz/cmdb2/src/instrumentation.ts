// https://github.com/vercel/next.js/discussions/15341
// Run code once per node server startup
import { Permission } from "../shared/permissions";
import db from "db"

async function SyncPermissionsTable() {
    console.log(`Synchronizing permissions table...`);
    const dbPermissions = await db.permission.findMany({
        include: { roles: { include: { role: true } } }
    });
    for (const codePermission of Object.values(Permission)) {
        const exists = dbPermissions.find(dbp => dbp.name === codePermission);
        console.log(`Permission ${codePermission} ${exists ? "already exists" : "DOESN'T EXIST"} on database`);
        if (!exists) {
            const newPerm = await db.permission.create({
                data: {
                    name: codePermission,
                    description: `auto-inserted by server`,
                },
            });
            console.log(` -> INSERTED Permission ${codePermission}. Be sure to associate it with roles.`);
        }
    }

    // TODO: other startup assertions.
}

export function register() {
    console.log(`INSTRUMENTATION RUNNING`);
    void SyncPermissionsTable();
}
