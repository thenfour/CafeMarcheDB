export interface EffectivePermission {
    readonly id: number;
    readonly name: string;
}

// Shared by server authorization and browser UI checks. RPC/session payloads
// carry plain data; consumers construct this object after deserialization.
export class PermissionSet {
    private readonly permissions: ReadonlyArray<EffectivePermission>;

    constructor(permissions: ReadonlyArray<EffectivePermission>);
    constructor(names: ReadonlyArray<string>, allPermissions: ReadonlyArray<EffectivePermission>);
    constructor(permissions: ReadonlyArray<EffectivePermission> | ReadonlyArray<string>, allPermissions?: ReadonlyArray<EffectivePermission>) {
        if (!Array.isArray(permissions)) throw new Error("Effective permissions are required.");
        let records: ReadonlyArray<EffectivePermission>;
        if (allPermissions !== undefined) {
            if (!Array.isArray(allPermissions) || !permissions.every(name => typeof name === "string")) {
                throw new Error("Expected permission names and a permission catalog.");
            }
            const names = new Set(permissions as ReadonlyArray<string>);
            records = allPermissions.filter(permission => names.has(permission.name));
        } else {
            records = permissions as ReadonlyArray<EffectivePermission>;
        }
        if (!records.every(permission => permission && typeof permission.id === "number" && typeof permission.name === "string")) {
            throw new Error("Expected permission records with IDs and names.");
        }
        this.permissions = [...new Map(records.map(permission => [permission.id, { ...permission }])).values()];
    }

    // note: returns in order that's zippable with ids
    get names(): string[] { return [...new Set(this.permissions.map(permission => permission.name))]; }
    // note: returns in order that's zippable with names
    get ids(): number[] { return this.permissions.map(permission => permission.id); }

    includesName(name: string): boolean { return this.permissions.some(permission => permission.name === name); }
    includesId(id: number): boolean { return this.permissions.some(permission => permission.id === id); }
    includesAllNames(names: ReadonlyArray<string>): boolean { return names.every(name => this.includesName(name)); }

    hasSameNames(names: ReadonlyArray<string>): boolean {
        return new Set(names).size === this.names.length && this.includesAllNames(names);
    }
}
