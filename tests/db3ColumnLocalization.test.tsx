// @vitest-environment jsdom
import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "db";
import { CMClientAuthorization } from "src/auth/shared/cmAuthorization";
import { PermissionSet } from "src/auth/shared/PermissionSet";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { GenericStringColumnClient, GenericIntegerColumnClient, BoolColumnClient, PublicIdColumnClient } from "src/core/db3/components/DB3ClientBasicFields";
import { EventDateRangeColumn } from "src/core/db3/components/DB3ClientDateRangeColumn";
import { defineTableClientSpec, defineLegacyTableClientSpec, useTableRenderContext, useLegacyTableRenderContext, xTableClientCaps } from "src/core/db3/components/DB3ClientCore";
import { defineView } from "src/core/db3/shared/core/db3View";
import { deriveViewContract } from "src/core/db3/shared/core/db3ViewContract";
import { xUserMinimum } from "src/core/db3/shared/schema/user";
import { collectLocalePreferences } from "src/locale/shared/localePreferences";
import { createLocaleApi, type LocalizationCatalog } from "src/locale/shared/localizationCatalog";
import { resolveString, type TranslationValue } from "src/locale/shared/stringResolution";
import { kStaticLocalizedStringRegistry, type StaticLocalizedStringKey } from "src/locale/shared/staticLocalizedStringRegistry";

vi.mock("src/core/db3/components/useClientAuth", () => ({ useClientAuth: () => authorization }));
vi.mock("src/core/db3/components/useDB3Context", () => ({ useDB3QueryContext: () => ({}) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => createLocaleApi(catalog) }));
vi.mock("src/core/components/markdown/Markdown", () => ({ Markdown: ({ markdown }: { markdown: string }) => <div>{markdown}</div> }));

const authorization = new CMClientAuthorization({ id: 1, publicId: parsePublicId<"User">("User000000000001") }, new PermissionSet([Permission.login]));
const viewArgs = Prisma.validator<Prisma.UserDefaultArgs>()({ select: { publicId: true, name: true } });
const contract = deriveViewContract(xUserMinimum, viewArgs);
const view = defineView({
    viewID: "Localization_FieldProbe", entity: xUserMinimum, selection: contract.prismaSelection,
    dtoSchema: contract.dtoSchema, hydrate: contract.hydrate,
});

interface TranslationFixture {
    readonly key: StaticLocalizedStringKey;
    readonly globalValues?: readonly TranslationValue[];
    readonly bandValues?: readonly TranslationValue[];
}

function makeCatalog(routeLocale: string, bandPublicId: string | null, translations: readonly TranslationFixture[]): LocalizationCatalog {
    const preferences = collectLocalePreferences({ routeLocale, browserLanguages: [] });
    const availability = { global: ["en-US", "fr-BE", "nl-BE"], band: ["en-US", "fr-BE", "nl-BE"] };
    // Every registered key is populated, matching the server catalog boundary.
    const strings = Object.fromEntries(Object.entries(kStaticLocalizedStringRegistry).map(([key, definition]) => {
        const translation = translations.find(entry => entry.key === key);
        return [key, resolveString({ preferences, availability, registeredDefault: definition.defaultValue,
            globalValues: translation?.globalValues ?? [], bandValues: translation?.bandValues ?? [] })];
    })) as LocalizationCatalog["strings"];
    return { bandPublicId, preferences, availability, strings, formattingLocale: routeLocale, cacheKey: "probe", payloadBytes: 0 };
}

let catalog: LocalizationCatalog;
let root: Root;
let container: HTMLDivElement;
const patch = vi.fn();
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    patch.mockReset();
    catalog = makeCatalog("en-US", null, []);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    if (originalActEnvironment) {
        Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    } else {
        Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    }
});

const columnArgs = { columnName: "name", cellWidth: 150, fieldCaptionKey: "db3.fields.name", fieldDescriptionKey: "menuLink.caption.DescriptionMarkdown" } as const;
const nameColumn = new GenericStringColumnClient(columnArgs);
const tableSpec = defineTableClientSpec({ view, columns: { name: () => nameColumn } });
const legacySpec = defineLegacyTableClientSpec({ table: xUserMinimum, columns: { name: () => nameColumn } });

function FieldContents({ heading }: { readonly heading: string }) {
    return <>
        <div role="columnheader">{heading}</div>
        {nameColumn.renderForNewDialog({ key: "name", row: { name: "Ada" }, value: "Ada", autoFocus: false, api: { setFieldValues: patch } })}
        {nameColumn.renderViewer({ key: "viewer", row: { name: "Ada" }, value: "Ada" })}
    </>;
}

function TypedFieldProbe() {
    const client = useTableRenderContext({ tableSpec, requestedCaps: xTableClientCaps.None });
    return <FieldContents heading={client.getColumn("name").headerName} />;
}

function LegacyFieldProbe() {
    const client = useLegacyTableRenderContext({ tableSpec: legacySpec, requestedCaps: xTableClientCaps.None });
    return <FieldContents heading={client.getColumn("name").headerName} />;
}

function FieldProbe({ legacy }: { readonly legacy: boolean }) {
    return legacy ? <LegacyFieldProbe /> : <TypedFieldProbe />;
}

describe("localized DB3 field presentation", () => {
    it.each([false, true])("resolves labels, help and accessible input names on the legacy=%s path", async legacy => {
        catalog = makeCatalog("fr-BE", "Band000000000001", [
            { key: "db3.fields.name", globalValues: [{ localeTag: "fr-BE", value: "Nom" }], bandValues: [{ localeTag: "nl-BE", value: "Bandnaam" }] },
            { key: "menuLink.caption.DescriptionMarkdown", bandValues: [{ localeTag: "fr-BE", value: "Aide du groupe" }] },
        ]);
        await act(async () => root.render(<FieldProbe legacy={legacy} />));
        expect(container.querySelector('[role="columnheader"]')?.textContent).toBe("Bandnaam");
        expect([...container.querySelectorAll(".name")].map(element => element.textContent)).toEqual(["Bandnaam", "Bandnaam"]);
        expect(container.querySelector(".description")?.textContent).toBe("Aide du groupe");
        const input = container.querySelector<HTMLInputElement>('input[aria-label="Bandnaam"]')!;
        expect(input.value).toBe("Ada");
        await act(async () => {
            input.value = "Bea";
            Simulate.change(input);
        });
        expect(patch).toHaveBeenCalledWith({ name: "Bea" });

        catalog = makeCatalog("en-US", "Band000000000002", []);
        await act(async () => root.render(<FieldProbe legacy={legacy} />));
        expect(container.querySelector('[role="columnheader"]')?.textContent).toBe("Name");
        expect(container.querySelector('input[aria-label="Name"]')).not.toBeNull();
        expect(container.textContent).not.toContain("Aide du groupe");
        expect(nameColumn.columnName).toBe("name");
    });

    it("keeps intentional blanks instead of deriving a label from the technical field name", async () => {
        catalog = makeCatalog("fr-BE", null, [{ key: "db3.fields.name", globalValues: [{ localeTag: "fr-BE", value: "" }] }]);
        await act(async () => root.render(<FieldProbe legacy={false} />));
        expect(container.querySelector('[role="columnheader"]')?.textContent).toBe("");
        expect(container.querySelector("input")?.getAttribute("aria-label")).toBe("");
    });

    it("retains distinct grid and form labels for composite date fields", async () => {
        const column = new EventDateRangeColumn({ startsAtColumnName: "startsAt", durationMillisColumnName: "durationMillis", isAllDayColumnName: "isAllDay",
            headerNameKey: "db3.fields.dateRange", fieldCaptionKey: "db3.fields.dateTimeRange", fieldDescriptionKey: null });
        expect(column.headerName).toBe("Date range");
        expect(column.fieldCaption).toBe("Date/time range");
        await act(async () => root.render(column.defaultRenderer({ value: "Range", isReadOnly: true, validationResult: undefined })));
        expect(container.querySelector(".name")?.textContent).toBe("Date/time range");
    });

    it("keeps numeric edits tied to the technical field while displaying its registered label", async () => {
        const column = new GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80, fieldCaptionKey: "db3.fields.sortOrder", fieldDescriptionKey: null });
        await act(async () => root.render(column.renderForNewDialog({ key: "sortOrder", row: { sortOrder: 1 }, value: 1,
            autoFocus: false, api: { setFieldValues: patch } })));
        const input = container.querySelector<HTMLInputElement>('input[aria-label="Sort order"]')!;
        expect(input.value).toBe("1");
        await act(async () => {
            input.value = "7";
            Simulate.change(input);
        });
        expect(patch).toHaveBeenCalledWith({ sortOrder: 7 });
    });

    it("keeps a boolean control's visible label and write contract together", async () => {
        const column = new BoolColumnClient({ columnName: "isDeleted", fieldCaptionKey: "db3.fields.deleted", fieldDescriptionKey: null });
        await act(async () => root.render(column.renderForNewDialog({ key: "isDeleted", row: { isDeleted: false }, value: false,
            autoFocus: false, api: { setFieldValues: patch } })));
        const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
        expect(checkbox.closest("label")?.textContent).toContain("Deleted");
        await act(async () => checkbox.click());
        expect(patch).toHaveBeenCalledWith({ isDeleted: true });
    });

    it("gives the built-in public identifier a nonempty registered label", () => {
        expect(new PublicIdColumnClient().headerName).toBe("ID");
    });
});
