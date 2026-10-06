import { Simplify } from "blitz";
import { z } from "zod";

// ---- general-purpose "registry-like" helpers...

// all registry entries have default values and a schema for serialization & validation.
export type RegistryEntryWithoutKey<TZodSchema extends z.ZodTypeAny> = {
    readonly defaultValue: z.infer<TZodSchema>;
    readonly schema: TZodSchema;
};

export type RegistryEntryWithKey<TZodSchema extends z.ZodTypeAny, TKey extends string = string> = RegistryEntryWithoutKey<TZodSchema> & {
    readonly key: TKey;
};

// Hives may mix schemas; each concrete entry keeps its own schema and metadata.
export type RegistryEntries = Readonly<Record<string, RegistryEntryWithoutKey<z.ZodTypeAny>>>;

// a factory is a function that takes a string key and returns a full registry entry.
export type RegistryFactory<
    TEntry extends RegistryEntryWithKey<z.ZodTypeAny>, // factory return type is with key
    TKey extends string
> = (key: TKey) => TEntry;

// this is what you pass into freezeRegistry.
export type RegistryFactoryMap<TEntries extends RegistryEntries> = {
    readonly [K in keyof TEntries]: RegistryFactory<
        TEntries[K] & RegistryEntryWithKey<TEntries[K]["schema"], K & string>,
        K & string
    >;
};

// return type of freezeRegistry.
export type FrozenRegistry<TEntries extends RegistryEntries> = {
    readonly [K in keyof TEntries]: Simplify<TEntries[K] & { readonly key: K & string }>;
};

/**
 * Calls each factory with its own key and freezes the resulting registry.
 * Entries are left intact, so factories can also construct class instances.
 * This is a shallow freeze: entry objects and nested values remain mutable.
 * Inline definitions retain their literal values and readonly metadata types.
 *
 * freezeRegistry({ greeting: registryEntry({ defaultValue: "Hello", schema: z.string() }) });
 */
export function freezeRegistry<const TEntries extends RegistryEntries>(
    factories: RegistryFactoryMap<TEntries>,
): FrozenRegistry<TEntries> {
    const entries: [string, unknown][] = [];
    for (const key in factories) {
        if (Object.prototype.hasOwnProperty.call(factories, key)) {
            entries.push([key, factories[key](key)]);
        }
    }

    // Object.fromEntries loses individual keys and return types. Each value
    // above came from the factory at the same key, so the mapped type is exact.
    return Object.freeze(Object.fromEntries(entries)) as FrozenRegistry<TEntries>;
}

/** Turns a plain definition into a factory whose key comes from the registry. */
export function registryEntry<const TDefinition extends RegistryEntryWithoutKey<z.ZodTypeAny>>(
    definition: TDefinition & RegistryEntryWithoutKey<TDefinition["schema"]>,
): <TKey extends string>(key: TKey) => Simplify<Omit<TDefinition, "key"> & { readonly key: TKey }> {
    return key => ({ ...definition, key });
}

export type RegistryKey<Hive extends RegistryEntries> = Extract<keyof Hive, string>;
// A literal default does not narrow the value accepted by the schema.
export type RegistryValueOf<Hive extends RegistryEntries, TKey extends RegistryKey<Hive>> = z.infer<Hive[TKey]["schema"]>;

export type RegistryCapabilities = {
    canEdit: boolean;
    canView: boolean;
}

export interface IMutableRegistry<Hive extends RegistryEntries> {

    getCapabilities: <TKey extends RegistryKey<Hive>>(key: TKey) => RegistryCapabilities;
    getValue: <TKey extends RegistryKey<Hive>>(key: TKey) => RegistryValueOf<Hive, TKey>;
    refetch: () => Promise<void>;
    setValue: <TKey extends RegistryKey<Hive>>(key: TKey, value: RegistryValueOf<Hive, TKey>) => Promise<void>;
    reset: <TKey extends RegistryKey<Hive>>(key: TKey) => Promise<void>;
}
