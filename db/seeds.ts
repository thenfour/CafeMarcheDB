import { PrismaClient } from "@prisma/client";
import { initializeAccessControl } from "../src/setup/accessControl";

// Fresh installs need access-control foundations. Workflow fixtures are separate
// from this production seed and must use explicit band ownership.
const database = new PrismaClient();
initializeAccessControl(database)
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => database.$disconnect());
