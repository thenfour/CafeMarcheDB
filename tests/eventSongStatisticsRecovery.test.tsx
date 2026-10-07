// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";

vi.mock("src/core/components/dashboard/DashboardLayout", () => ({
    default: ({ title, children }: React.PropsWithChildren<{ title: string }>) => <main><h1>{title}</h1>{children}</main>,
}));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({
    getPlainString: (key: LocalizedPlainStringKey) => `${language}: ${kStaticLocalizedStringRegistry[key].defaultValue}`,
}) }));
vi.mock("@blitzjs/rpc", () => ({ useQuery: () => { throw new Error("Recovery surface queried legacy data."); } }));

import StatisticsPage from "src/pages/backstage/stats";
import { SongHistory } from "src/core/components/song/SongHistory";

let language: string;
let root: Root;
let container: HTMLDivElement;
const song = { publicId: parsePublicId<"Song">("DeferredSong0001") };

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    language = "en";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe("event/song statistics recovery", () => {
    it("explains unavailable statistics without mounting a query or chart", async () => {
        await act(async () => root.render(<StatisticsPage />));
        expect(container.querySelector("h1")?.textContent).toBe("en: Event statistics");
        expect(container.querySelector('[role="alert"]')?.textContent)
            .toContain("Event statistics and popular-song reports are temporarily unavailable");
        expect(container.querySelector("svg.recharts-surface")).toBeNull();
    });

    it("updates the statistics title and explanation after a language change", async () => {
        await act(async () => root.render(<StatisticsPage />));
        language = "fr-BE";
        await act(async () => root.render(<StatisticsPage />));
        expect(container.querySelector("h1")?.textContent).toBe("fr-BE: Event statistics");
        expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/^fr-BE:/);
    });

    it("keeps the song history tab explicit through song and language changes without querying", async () => {
        await act(async () => root.render(<SongHistory song={song} />));
        expect(container.querySelector('[role="alert"]')?.textContent)
            .toContain("Song performance history is temporarily unavailable");
        language = "nl-BE";
        await act(async () => root.render(<SongHistory song={{ publicId: parsePublicId<"Song">("DeferredSong0002") }} />));
        expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/^nl-BE:/);
        expect(container.querySelectorAll("a")).toHaveLength(0);
    });
});
