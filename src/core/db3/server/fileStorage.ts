import path from "node:path";
import { unlink } from "node:fs/promises";

/** The caller owns the transaction; remove its new files even when commit fails. */
export async function withFileStorageRollback<TResult>(work: (createdPaths: string[]) => Promise<TResult>): Promise<TResult> {
    const createdPaths: string[] = [];
    try {
        return await work(createdPaths);
    } catch (error) {
        await Promise.all(createdPaths.map(createdPath => unlink(createdPath)));
        throw error;
    }
}

export function requireFileStorageDirectory(): string {
    const directory = process.env.FILE_UPLOAD_PATH;
    if (!directory) {
        throw new Error("FILE_UPLOAD_PATH is not configured.");
    }
    return path.resolve(directory);
}

/** A stored leaf is a filename, including on Windows where ':' can open another stream. */
export function resolveFileStoragePath(directory: string, storedLeafName: string): string {
    if (!storedLeafName || storedLeafName === "." || storedLeafName === ".."
        || /[\\/:\0]/.test(storedLeafName) || path.basename(storedLeafName) !== storedLeafName) {
        throw new Error("Invalid stored file name.");
    }
    return path.resolve(directory, storedLeafName);
}
