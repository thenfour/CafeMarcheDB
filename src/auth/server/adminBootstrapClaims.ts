import { Prisma } from "@prisma/client";

interface AdminBootstrapClaimDatabase {
    $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
    $executeRaw(query: Prisma.Sql): Promise<number>;
}

export const hasAdminBootstrapTokenBeenClaimed = async (
    db: AdminBootstrapClaimDatabase,
    tokenHash: string,
): Promise<boolean> => {
    const claims = await db.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        SELECT id
        FROM AdminBootstrapClaim
        WHERE tokenHash = ${tokenHash}
        LIMIT 1
    `);
    return claims.length > 0;
};

export const recordAdminBootstrapTokenClaim = async (
    db: AdminBootstrapClaimDatabase,
    tokenHash: string,
    claimedByUserId: number,
): Promise<boolean> => {
    const insertedRows = await db.$executeRaw(Prisma.sql`
        INSERT IGNORE INTO AdminBootstrapClaim (tokenHash, claimedByUserId)
        VALUES (${tokenHash}, ${claimedByUserId})
    `);
    return insertedRows === 1;
};
