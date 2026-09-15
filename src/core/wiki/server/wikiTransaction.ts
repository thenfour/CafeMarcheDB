import db, { Prisma } from "db";
import { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";

// Re-run the entire decision after a concurrent writer wins. This also handles
// two editors creating the same previously nonexistent page.
export async function wikiTransaction<T>(work: (tx: TransactionalPrismaClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await db.$transaction(work, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable
            });
        } catch (error) {
            const tooManyAttempts = attempt >= 2;

            // P2034: "Transaction failed due to a write conflict or a deadlock. Please retry your transaction"
            // P2002: "Unique constraint failed on the {constraint}"
            const isRetryableError = error instanceof Prisma.PrismaClientKnownRequestError &&
                ["P2034", "P2002"].includes(error.code);

            if (tooManyAttempts || !isRetryableError) //
            {
                throw error;
            }
        }
    }
}
