import type { Prisma } from "@prisma/client";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";

const snapshot = Symbol("DB3 database snapshot");
export interface DB3ReadContext {
    readonly [snapshot]: true;
    readonly database: Prisma.TransactionClient;
    readonly authorization: CMServerAuthorization;
}
export type DB3SnapshotIsolation = "RepeatableRead" | "Serializable";
/** Only the interactive transaction capability is needed from the root Prisma/Blitz client. */
export interface DB3ReadRootDatabase {
    $transaction<T>(read: (database: Prisma.TransactionClient) => Promise<T>,
        options: { isolationLevel: DB3SnapshotIsolation; timeout?: number }): Promise<T>;
}
export type DB3ReadDatabase = DB3ReadRootDatabase | DB3ReadContext;
function isReadContext(database: DB3ReadDatabase): database is DB3ReadContext {
    // Prisma proxies report some absent symbols as present; only our explicit brand identifies a context.
    return Reflect.get(database, snapshot) === true;
}

/** Internal composition/test boundary: the transaction owner must declare its snapshot policy. */
export async function bindDB3ReadSnapshot(database: Prisma.TransactionClient, authorization: CMServerAuthorization,
    policy: { readonly isolationLevel: DB3SnapshotIsolation },
): Promise<DB3ReadContext> {
    if (policy.isolationLevel !== "RepeatableRead" && policy.isolationLevel !== "Serializable") {
        throw new Error("DB3 resolved reads require a repeatable database snapshot.");
    }
    return { [snapshot]: true, database, authorization: await authorization.refresh(database) };
}


// wrap in a transaction for reading consistency. the point of this wrapper is to
// (sometimes) allow functions to own their own transaction strategy.
// instead of the caller having to open the transaction and hope that the transaction strategy aligns.
export async function executeDB3Read<T>(database: DB3ReadDatabase,
    authorization: CMServerAuthorization, read: (context: DB3ReadContext) => Promise<T>,
): Promise<T> {
    if (isReadContext(database)) {
        return read({ ...database, authorization: await authorization.refresh(database.database) });
    }
    if (!("$transaction" in database)) {
        throw new Error("Pass the root Prisma client or a DB3ReadContext established by the transaction owner.");
    }
    return database.$transaction(async transaction => read(await bindDB3ReadSnapshot(transaction, authorization,
        { isolationLevel: "RepeatableRead" })), { isolationLevel: "RepeatableRead" });
}
