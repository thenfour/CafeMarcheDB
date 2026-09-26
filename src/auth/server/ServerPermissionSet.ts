import { PermissionSet } from "../shared/PermissionSet";

export interface DatabasePermissionIdentity {
    readonly id: number;
    readonly name: string;
}

/** Trusted database-read capability. Never send this object through RPC. */
export class ServerPermissionSet extends PermissionSet {
    private readonly databaseIds: ReadonlySet<number>;

    constructor(permissions: readonly DatabasePermissionIdentity[]) {
        if (!Array.isArray(permissions) || !permissions.every(permission => permission
            && Number.isSafeInteger(permission.id) && permission.id > 0
            && typeof permission.name === "string")) {
            throw new Error("Expected database permission IDs and names.");
        }
        super(permissions.map(permission => permission.name));
        this.databaseIds = new Set(permissions.map(permission => permission.id));
    }

    get ids(): number[] { return [...this.databaseIds]; }
    includesId(id: number): boolean { return this.databaseIds.has(id); }
}
