import type { Simplify } from "blitz";

// ---- general-purpose "registry-like" helpers...

type RegistryEntryWithKey<CommonBase, TKey extends string = string> = CommonBase & {
    readonly key: TKey;
};

// A registry may mix entry shapes; preserve each entry's concrete metadata.
type RegistryEntries<CommonBase> = Readonly<Record<string, CommonBase>>;

// a factory is a function that takes a string key and returns a full registry entry.
type RegistryFactory<
    CommonBase,
    TEntry extends RegistryEntryWithKey<CommonBase>, // factory return type is with key
    TKey extends string
> = (key: TKey) => TEntry;

// this is what you pass into freezeRegistry.
type RegistryFactoryMap<CommonBase, TEntries extends RegistryEntries<CommonBase>> = {
    readonly [K in keyof TEntries]: RegistryFactory<
        CommonBase,
        TEntries[K] & RegistryEntryWithKey<CommonBase, K & string>,
        K & string
    >;
};

// return type of freezeRegistry.
type FrozenRegistry<CommonBase, TEntries extends RegistryEntries<CommonBase>> = {
    readonly [K in keyof TEntries]: Simplify<TEntries[K] & { readonly key: K & string }>;
};

/**
 * Calls each factory with its own key and freezes the resulting registry.
 * Entries are left intact, so factories can also construct class instances.
 * This is a shallow freeze: entry objects and nested values remain mutable.
 * Inline definitions retain their literal values and readonly metadata types.
 *
 * defineRegistry({ greeting: registryEntry({ defaultValue: "Hello", schema: z.string() }) });
 */
export function defineRegistry<const CommonBase, const TEntries extends RegistryEntries<CommonBase>>(
    factories: RegistryFactoryMap<CommonBase, TEntries>,
): FrozenRegistry<CommonBase, TEntries> {
    const entries: [string, unknown][] = [];
    for (const key in factories) {
        if (Object.prototype.hasOwnProperty.call(factories, key)) {
            entries.push([key, factories[key](key)]);
        }
    }

    // Object.fromEntries loses individual keys and return types. Each value
    // above came from the factory at the same key, so the mapped type is exact.
    return Object.freeze(Object.fromEntries(entries)) as FrozenRegistry<CommonBase, TEntries>;
}

// you can't directly pass the object to defineRegistry without specifying BOTH type params.
// registryFor curries to solve.
export function registryFor<CommonBase>() {
    return <const TEntries extends RegistryEntries<CommonBase>>(
        factories: RegistryFactoryMap<CommonBase, TEntries>,
    ) => defineRegistry<CommonBase, TEntries>(factories);
}

