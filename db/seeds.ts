import { PrismaClient } from "@prisma/client";
import { runDatabaseSeed } from "./seeding/seed";

const database = new PrismaClient();
runDatabaseSeed(database)
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => database.$disconnect());
