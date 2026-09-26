import { getPermissionDefinition, isPermission } from "@/shared/permissions";

/** Shared capability checks depend on permission names, never database identities. */
export class PermissionSet {
    private readonly permissionNames: ReadonlySet<string>;

    constructor(names: readonly string[]) {
        if (!Array.isArray(names) || !names.every(name => typeof name === "string")) {
            throw new Error("Expected permission names.");
        }
        this.permissionNames = new Set(names);
    }

    get names(): string[] { return [...this.permissionNames]; }

    includesName(name: string): boolean { return this.permissionNames.has(name); }
    includesAllNames(names: readonly string[]): boolean { return names.every(name => this.includesName(name)); }

    hasAll(other: Readonly<PermissionSet>): boolean {
        return this.includesAllNames(other.names);
    }

    hasAllDelegable(other: Readonly<PermissionSet>): boolean {
        // Delegability is application policy, not persisted or serialized metadata.
        return other.names.every(name => isPermission(name)
            && getPermissionDefinition(name).isDelegable
            && this.includesName(name));
    }

    hasSameNames(names: readonly string[]): boolean {
        return new Set(names).size === this.permissionNames.size && this.includesAllNames(names);
    }
}
