import path from "node:path";

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
