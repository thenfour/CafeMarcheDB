// https://github.com/vercel/next.js/discussions/15341
// Run code once per node server startup
import { Permission } from "../shared/permissions";
import db from "db"
import { execSync } from "child_process";
import { nanoid } from "nanoid";

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
}

export async function register() {
    console.log(`INSTRUMENTATION RUNNING`);
    await SyncPermissionsTable();

    // ensure users have uids populated
    // Fetch users with null uids
    const usersWithoutUid = await db.user.findMany({
        where: {
            uid: null,
        },
    })

    console.log(`Users with NULL UIDs: ${usersWithoutUid.length}`);

    // Update each user, setting a new UUID for their uid field
    const updates = usersWithoutUid.map(async (user) => {
        return await db.user.update({
            where: {
                id: user.id,
            },
            data: {
                uid: nanoid(),
            },
        })
    });

    const ups = await Promise.all(updates);

    for (const up of ups) {
        console.log(`-> #${up.id} (${up.name}) => ${up.uid}`);
    }


    //const startupState = getServerStartStateRef();
    process.env.CMDB_START_TIME = `${new Date().valueOf()}`;
    process.env.CMDB_GIT_REVISION = execSync('git rev-parse HEAD').toString().trim();
    process.env.CMDB_GIT_COMMIT_DATE = execSync('git log -1 --format=%cd').toString().trim();
    console.log(`process.env.CMDB_START_TIME = ${process.env.CMDB_START_TIME}`);
    console.log(`process.env.CMDB_GIT_REVISION = ${process.env.CMDB_GIT_REVISION}`);
    console.log(`process.env.CMDB_GIT_COMMIT_DATE = ${process.env.CMDB_GIT_COMMIT_DATE}`);
}
