import { getPermissionDefinition, isPermission } from "@/shared/permissions";

export interface PermissionIdentity {
    readonly id: number;
    readonly name: string;
}

export interface EffectivePermission extends PermissionIdentity {
    readonly isDelegable: boolean;
}

// Shared by server authorization and browser UI checks. RPC/session payloads
// carry plain data; consumers construct this object after deserialization.
export class PermissionSet {
    private readonly permissions: ReadonlyArray<EffectivePermission>;

    constructor(permissions: ReadonlyArray<PermissionIdentity>);
    constructor(names: ReadonlyArray<string>, allPermissions: ReadonlyArray<PermissionIdentity>);
    constructor(permissions: ReadonlyArray<PermissionIdentity> | ReadonlyArray<string>, allPermissions?: ReadonlyArray<PermissionIdentity>) {
        if (!Array.isArray(permissions)) throw new Error("Effective permissions are required.");
        let records: ReadonlyArray<PermissionIdentity>;
        if (allPermissions !== undefined) {
            if (!Array.isArray(allPermissions) || !permissions.every(name => typeof name === "string")) {
                throw new Error("Expected permission names and a permission catalog.");
            }
            const names = new Set(permissions as ReadonlyArray<string>);
            records = allPermissions.filter(permission => names.has(permission.name));
        } else {
            records = permissions as ReadonlyArray<PermissionIdentity>;
        }
        if (!records.every(permission => permission && typeof permission.id === "number" && typeof permission.name === "string")) {
            throw new Error("Expected permission records with IDs and names.");
        }
        this.permissions = [...new Map(records.map(permission => [permission.id, {
            ...permission,
            // Delegability is application policy. Never trust persisted or
            // serialized metadata for this security classification.
            isDelegable: isPermission(permission.name)
                && getPermissionDefinition(permission.name).isDelegable,
        }])).values()];
    }

    // note: returns in order that's zippable with ids
    get names(): string[] { return [...new Set(this.permissions.map(permission => permission.name))]; }
    // note: returns in order that's zippable with names
    get ids(): number[] { return this.permissions.map(permission => permission.id); }

    includesName(name: string): boolean { return this.permissions.some(permission => permission.name === name); }
    includesId(id: number): boolean { return this.permissions.some(permission => permission.id === id); }
    includesAllNames(names: ReadonlyArray<string>): boolean { return names.every(name => this.includesName(name)); }

    hasAll(other: Readonly<PermissionSet>): boolean {
        return other.names.every(name => this.includesName(name));
    }

    hasAllDelegable(other: PermissionSet): boolean {
        return other.permissions.every(permission => (
            permission.isDelegable && this.includesName(permission.name)
        ));
    }

    hasSameNames(names: ReadonlyArray<string>): boolean {
        return new Set(names).size === this.names.length && this.includesAllNames(names);
    }
}
