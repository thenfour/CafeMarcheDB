import { registryEntry, RegistryEntryWithoutKey } from "@/src/setting/shared/registryHelpers";
import { z } from "zod";

type StaticStringParamDef = {
    key: string;
    description: string;
};

type LocalizedStringFormat = "plain" | "markdown";

type StaticStringDef<TZodSchema extends z.ZodType<string>> = RegistryEntryWithoutKey<TZodSchema> & {
    description: string;
    format: LocalizedStringFormat;
    parameters?: readonly StaticStringParamDef[];
};

export function staticString<const T extends StaticStringDef<z.ZodType<string>>>(
    definition: T & RegistryEntryWithoutKey<T["schema"]>,
) {
    return registryEntry(definition);
}

export function markdownStaticString<const T extends Omit<StaticStringDef<z.ZodType<string>>, "format">>(
    definition: T & RegistryEntryWithoutKey<T["schema"]>,
) {
    // Keep the caller's literal metadata when adding the fixed format.
    return staticString<T & { readonly format: "markdown" }>({ ...definition, format: "markdown" });
}

export function plainStaticString<const T extends Omit<StaticStringDef<z.ZodType<string>>, "format">>(
    definition: T & RegistryEntryWithoutKey<T["schema"]>,
) {
    return staticString<T & { readonly format: "plain" }>({ ...definition, format: "plain" });
}
