import { asPermission, getPermissionDefinition, isPermission, Permission } from "@/shared/permissions";

// client-friendly permission set with only names (no db ids)
export class PermissionSet {
    private readonly permissionNames: ReadonlySet<Permission>;

    constructor(names: readonly Permission[]) {
        if (!Array.isArray(names)) {
            throw new Error("Expected permission names.");
        }
        const perms = names.map(name => asPermission(name));
        this.permissionNames = new Set(perms);
    }

    get names(): Permission[] { return [...this.permissionNames]; }

    includesName(name: Permission): boolean { return this.permissionNames.has(name); }
    includesAllNames(names: readonly Permission[]): boolean { return names.every(name => this.includesName(name)); }

    hasAll(other: Readonly<PermissionSet>): boolean {
        return this.includesAllNames(other.names);
    }

    hasAllDelegable(other: Readonly<PermissionSet>): boolean {
        // Delegability is application policy, not persisted or serialized metadata.
        return other.names.every(name => isPermission(name)
            && getPermissionDefinition(name).isDelegable
            && this.includesName(name));
    }

    hasSameNames(names: readonly Permission[]): boolean {
        return new Set(names).size === this.permissionNames.size && this.includesAllNames(names);
    }
}
