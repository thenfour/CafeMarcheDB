// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Localized } from "src/locale/components/Localized";
import { createLocaleApi, type LocalizationCatalog, type LocalizedStringIdAndParams } from "src/locale/shared/localizationCatalog";
import { collectLocalePreferences } from "src/locale/shared/localePreferences";
import { kStaticLocalizedStringRegistry, type LocalizedMarkdownKey, type StaticLocalizedStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { resolveString } from "src/locale/shared/stringResolution";

vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => createLocaleApi(catalog) }));
vi.mock("src/core/components/markdown/Markdown", () => ({
    Markdown: ({ markdown, className }: { markdown: string; className?: string }) => <div data-markdown className={className}>{markdown}</div>,
}));

let catalog: LocalizationCatalog;
let root: Root;
let container: HTMLDivElement;

function createCatalog(): LocalizationCatalog {
    const preferences = collectLocalePreferences({ routeLocale: "fr-BE" });
    const availability = { global: ["en-US", "fr-BE"], band: ["en-US", "fr-BE"] };
    // Every registry key is populated; Object.fromEntries cannot retain that exhaustive key type.
    const strings = Object.fromEntries(Object.entries(kStaticLocalizedStringRegistry).map(([key, entry]) => [key,
        resolveString({ preferences, availability, registeredDefault: entry.defaultValue, globalValues: [], bandValues: [] }),
    ])) as LocalizationCatalog["strings"];
    return { bandPublicId: null, preferences, availability, strings, formattingLocale: "fr-BE", cacheKey: "test", payloadBytes: 0 };
}

function setTranslation(id: StaticLocalizedStringKey, value: string | null, localeTag = "en-US") {
    catalog = {
        ...catalog,
        strings: { ...catalog.strings, [id]: { ...catalog.strings[id], value, localeTag } },
    };
}

async function render(element: React.ReactElement) {
    await act(async () => root.render(element));
}

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    catalog = createCatalog();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("localized presentation", () => {
    it("interpolates parameters in fragments and wrappers, including parameter changes", async () => {
        await render(<Localized id="menu.profile" parameters={{ bandName: "River Band" }} />);
        expect(container.textContent).toBe("Your River Band Profile");
        await render(<Localized id="menu.profile" parameters={{ bandName: "Brass Collective" }}
            component="span" className="profile" style={{ fontWeight: 700 }} />);
        expect(container.querySelector("span.profile")?.textContent).toBe("Your Brass Collective Profile");
        expect(container.querySelector("span")?.style.fontWeight).toBe("700");
        await render(<Localized id="common.action.ok" component="strong" />);
        expect(container.querySelector("strong")?.textContent).toBe("OK");
    });

    it("uses translation plural rules and the viewer's number formatting", async () => {
        // English zero uses 'other'; French zero uses 'one'. Formatting stays French in both cases.
        await render(<Localized id="common.items.count" parameters={{ count: 0 }} />);
        expect(container.textContent).toBe("0 items");
        await render(<Localized id="common.items.count" parameters={{ count: 1 }} />);
        expect(container.textContent).toBe("1 item");
        await render(<Localized id="common.items.count" parameters={{ count: 1234 }} />);
        expect(container.textContent).toBe(`${new Intl.NumberFormat("fr-BE").format(1234)} items`);
        setTranslation("common.items.count", "{count, plural, one {# article} other {# articles}}", "fr-BE");
        await render(<Localized id="common.items.count" parameters={{ count: 0 }} />);
        expect(container.textContent).toBe("0 article");
    });

    it("formats Date parameters with the viewer's formatting locale", async () => {
        const joinedAt = new Date(2026, 9, 20, 12);
        await render(<Localized id="membership.directory.joinedAt" parameters={{ joinedAt }} />);
        const formatted = new Intl.DateTimeFormat("fr-BE", { year: "numeric", month: "short", day: "numeric" }).format(joinedAt);
        expect(container.textContent).toBe(`Joined this band: ${formatted}`);
    });

    it("renders parameter values as literal text", async () => {
        await render(<Localized id="menu.profile" parameters={{ bandName: "<b>{band}</b>" }} />);
        expect(container.textContent).toBe("Your <b>{band}</b> Profile");
        expect(container.querySelector("b")).toBeNull();
    });

    it("renders Markdown without ICU interpolation and accepts a forwarded Markdown key", async () => {
        function Help({ id }: { id: LocalizedMarkdownKey }) {
            return <Localized id={id} className="help" />;
        }
        setTranslation("GlobalWikiPage_Markdown", "**Help** {literal}");
        await render(<Help id="GlobalWikiPage_Markdown" />);
        expect(container.querySelector("[data-markdown].help")?.textContent).toBe("**Help** {literal}");
        expect(container.querySelector("button, textarea, select")).toBeNull();
    });

    it("preserves intentionally empty plain and Markdown translations", async () => {
        setTranslation("menu.profile", "");
        await render(<Localized id="menu.profile" parameters={{ bandName: "River Band" }} />);
        expect(container.textContent).toBe("");
        setTranslation("GlobalWikiPage_Markdown", "");
        await render(<Localized id="GlobalWikiPage_Markdown" />);
        expect(container.querySelector("[data-markdown]")?.textContent).toBe("");
    });

    // Keep literal keys so each branch retains its required parameter type.
    it.each(["menu.profile", "GlobalWikiPage_Markdown"] as const)("throws for a missing translation: %s", async id => {
        setTranslation(id, null);
        // React logs render errors before propagating them to the caller.
        vi.spyOn(console, "error").mockImplementation(() => { });
        const element = id === "menu.profile"
            ? <Localized id={id} parameters={{ bandName: "River Band" }} />
            : <Localized id={id} />;
        await expect(render(element)).rejects.toThrow(`No eligible translation for ${id}`);
    });
});

describe("localized composition API", () => {
    it("shares formatting with string helpers and keeps the raw template in detail", () => {
        const locale = createLocaleApi(catalog);
        const composed = locale.getString({ id: "menu.profile", parameters: { bandName: "River Band" } });
        expect(composed.value).toBe(locale.getPlainString("menu.profile", { bandName: "River Band" }));
        expect(composed.value).toBe("Your River Band Profile");
        expect(composed.detail.value).toBe("Your {bandName} Profile");
        expect(composed.format).toBe("plain");
        setTranslation("GlobalWikiPage_Markdown", "**Help** {literal}");
        const updated = createLocaleApi(catalog);
        expect(updated.getString({ id: "GlobalWikiPage_Markdown" }).value).toBe(updated.getMarkdownString("GlobalWikiPage_Markdown"));
    });

    it("throws for missing translations and unloaded catalogs through every text API", () => {
        setTranslation("common.action.ok", null);
        setTranslation("GlobalWikiPage_Markdown", null);
        const locale = createLocaleApi(catalog);
        expect(() => locale.getString({ id: "common.action.ok" })).toThrow("No eligible translation for common.action.ok");
        expect(() => locale.getPlainString("common.action.ok")).toThrow("No eligible translation for common.action.ok");
        expect(() => locale.getMarkdownString("GlobalWikiPage_Markdown")).toThrow("No eligible translation for GlobalWikiPage_Markdown");
        expect(() => createLocaleApi(null).getString({ id: "common.action.ok" })).toThrow("not loaded");
    });

    it("throws when the catalog omits a registered key", () => {
        const strings = { ...catalog.strings };
        Reflect.deleteProperty(strings, "common.action.ok");
        const locale = createLocaleApi({ ...catalog, strings });
        expect(() => locale.getString({ id: "common.action.ok" })).toThrow("Localization key is not loaded: common.action.ok");
    });

    it("checks parameter pairs and Markdown presentation options at compile time", () => {
        if (false) {
            // @ts-expect-error Only registered keys can be presented.
            <Localized id="unregistered.string" />;
            // @ts-expect-error The profile caption requires bandName.
            <Localized id="menu.profile" />;
            // @ts-expect-error bandName must be a string.
            <Localized id="menu.profile" parameters={{ bandName: 42 }} />;
            // @ts-expect-error Unknown parameters cannot replace bandName.
            <Localized id="menu.profile" parameters={{ count: 2 }} />;
            // @ts-expect-error A numeric parameter cannot be a string.
            <Localized id="common.items.count" parameters={{ count: "2" }} />;
            // @ts-expect-error Date parameters require a Date.
            <Localized id="membership.directory.joinedAt" parameters={{ joinedAt: "2026-10-20" }} />;
            // @ts-expect-error Parameterless strings reject parameters.
            <Localized id="common.action.ok" parameters={{ bandName: "River Band" }} />;
            // @ts-expect-error Markdown rejects interpolation parameters.
            <Localized id="GlobalWikiPage_Markdown" parameters={{ bandName: "River Band" }} />;
            // @ts-expect-error Markdown owns its renderer and rejects component overrides.
            <Localized id="GlobalWikiPage_Markdown" component="article" />;
            // @ts-expect-error Even a null component is unsupported for Markdown.
            <Localized id="GlobalWikiPage_Markdown" component={null} />;
            // @ts-expect-error Caller fallbacks are no longer supported.
            <Localized id="common.action.ok" fallbackPlainString="Fallback" />;
            const id = Date.now() ? "menu.profile" : "common.action.ok";
            // @ts-expect-error A possibly parameterized key must be narrowed first.
            <Localized id={id} />;
            const parameterlessId = Date.now() ? "GlobalWikiPage_Markdown" : "common.action.ok";
            <Localized id={parameterlessId} />;
            // @ts-expect-error A possibly Markdown key cannot have a component override.
            <Localized id={parameterlessId} component="span" />;
            const locale = createLocaleApi(null);
            // @ts-expect-error Composition requires the key's parameters.
            locale.getString({ id: "menu.profile" });
            // @ts-expect-error Composition rejects incorrect parameter types.
            locale.getString({ id: "common.items.count", parameters: { count: "2" } });
            // @ts-expect-error Composition rejects parameters on parameterless keys.
            locale.getString({ id: "common.action.ok", parameters: { count: 2 } });
            // @ts-expect-error A possibly parameterized key must be narrowed first.
            locale.getString({ id });
            const input: LocalizedStringIdAndParams = Date.now()
                ? { id: "menu.profile", parameters: { bandName: "River Band" } }
                : { id: "common.items.count", parameters: { count: 2 } };
            locale.getString(input);
            <Localized {...input} />;
        }
        expect(true).toBe(true);
    });
});
