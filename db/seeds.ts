import { PrismaClient } from "@prisma/client";
import { initializeAccessControl } from "../src/setup/accessControl";

// Seed real access-control foundations. Legacy random demo data references the
// old model; its generators are adapted with the affected domains in phase 4.
const database = new PrismaClient();
initializeAccessControl(database)
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => database.$disconnect());
