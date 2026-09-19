import { randomBytes } from "crypto";
import { PUBLIC_ID_LENGTH, PUBLIC_ID_PLACEHOLDER_PREFIX, type PublicId } from "shared/publicId";

const PUBLIC_ID_REPAIR_BATCH_SIZE = 100;
const PUBLIC_ID_COLLISION_RETRIES = 8;

export interface PublicIdRepairDelegate {
    findMany(args: unknown): Promise<Array<{ id: number, publicId: string }>>;
    updateMany(args: unknown): Promise<{ count: number }>;
    count(args: unknown): Promise<number>;
}

// TTable ensures public IDs are only usable within the context of the specified table key.
export function generatePublicId<TTable extends string = string>(): PublicId<TTable> {
    const value = randomBytes(12).toString("base64url");
    if (value.length !== PUBLIC_ID_LENGTH) {
        throw new Error(`Generated public ID has unexpected length ${value.length}.`);
    }
    return value as PublicId<TTable>;
}

// pass in an exception thrown by prisma; this contains the logic that
// decides if that error represents a publicid collision
export function isPublicIdUniqueCollision(error: unknown): boolean {
    if (!error || typeof error !== "object") {
        return false;
    }
    const candidate = error as { code?: unknown, meta?: { target?: unknown } };
    // P2002 = "Unique constraint failed on the {constraint}"
    if (candidate.code !== "P2002") {
        return false;
    }
    return JSON.stringify(candidate.meta?.target || "").includes("publicId");
}

// for migration of legacy `id` fields to public IDs, the migration.sql initializes
// publicId with placeholders; this function runs at server startup to repair them
// to correct production publicIds.
export async function repairPublicIdPlaceholders(args: {
    delegate: PublicIdRepairDelegate;
    modelName: string;
    generate?: () => string;
}): Promise<number> {
    const generate = args.generate || generatePublicId;
    let replacementCount = 0;

    while (true) {
        const placeholders = await args.delegate.findMany({
            where: { publicId: { startsWith: PUBLIC_ID_PLACEHOLDER_PREFIX } },
            select: { id: true, publicId: true },
            orderBy: { id: "asc" },
            take: PUBLIC_ID_REPAIR_BATCH_SIZE,
        });
        if (placeholders.length === 0) break;

        for (const row of placeholders) {
            let replaced = false;
            for (let attempt = 0; attempt < PUBLIC_ID_COLLISION_RETRIES; ++attempt) {
                try {
                    const result = await args.delegate.updateMany({
                        where: { id: row.id, publicId: row.publicId },
                        data: { publicId: generate() },
                    });
                    if (result.count > 0) replacementCount += result.count;
                    // A zero count means another server process repaired this
                    // exact placeholder after our read.
                    replaced = true;
                    break;
                } catch (error) {
                    if (!isPublicIdUniqueCollision(error)) throw error;
                }
            }
            if (!replaced) {
                throw new Error(`Unable to generate a unique public ID for ${args.modelName} ${row.id}.`);
            }
        }
    }

    const remainingCount = await args.delegate.count({
        where: { publicId: { startsWith: PUBLIC_ID_PLACEHOLDER_PREFIX } },
    });
    if (remainingCount !== 0) {
        throw new Error(`${remainingCount} ${args.modelName} public-ID placeholders remain after startup repair.`);
    }
    return replacementCount;
}
