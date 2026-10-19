import type { Simplify } from "blitz";

type RegistryEntryWithKey<CommonBase, TKey extends string = string> = CommonBase & {
    readonly key: TKey;
};

// A registry may mix entry shapes; preserve each entry's concrete metadata.
type RegistryEntries<CommonBase> = Readonly<Record<string, CommonBase>>;

type RegistryFactory<
    CommonBase,
    TEntry extends RegistryEntryWithKey<CommonBase>,
    TKey extends string
> = (key: TKey) => TEntry;

type RegistryFactoryMap<CommonBase, TEntries extends RegistryEntries<CommonBase>> = {
    readonly [K in keyof TEntries]: RegistryFactory<
        CommonBase,
        TEntries[K] & RegistryEntryWithKey<CommonBase, K & string>,
        K & string
    >;
};

type FrozenRegistry<CommonBase, TEntries extends RegistryEntries<CommonBase>> = {
    readonly [K in keyof TEntries]: Simplify<TEntries[K] & { readonly key: K & string }>;
};

/** Calls each factory with its own key and shallow-freezes the resulting registry. */
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

// Specify the common contract first, then infer each concrete entry.
export function registryFor<CommonBase>() {
    return <const TEntries extends RegistryEntries<CommonBase>>(
        factories: RegistryFactoryMap<CommonBase, TEntries>,
    ) => defineRegistry<CommonBase, TEntries>(factories);
}
