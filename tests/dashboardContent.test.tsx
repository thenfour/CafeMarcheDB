// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { satisfiesPermissionRequirement, type PermissionRequirement } from "src/auth/shared/permissionRequirement";
import { createTestRouter } from "./support/routing";
import { parsePortalPath } from "src/route/portalRouting";
vi.mock("src/route/useCmdbRouter", () => ({ useCmdbRouter: () => createTestRouter({ baseUri: "https://test", hosting: { kind: "multiBand" }, requestPath: parsePortalPath(`/fr-BE/b/${band}`, { kind: "multiBand" }) }) }));
import { parsePublicId } from "shared/publicId";
import type { PresentationInput } from "src/locale/shared/presentationInput";
import { TableAccessor } from "shared/rootroot";
import { menuLinkListView, type MenuLinkListClient } from "src/core/db3/shared/entities/menuLink/menuLinkViews";
import { createDashboardReferenceStore, registerDashboardReferences, permissionDashboardView } from "src/core/db3/shared/references/dashboardReferences";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { BrandContext } from "shared/brandConfig";
import { DefaultDbBrandConfig } from "shared/brandConfigBase";
import { createTheme } from "@mui/material/styles";
import type { BandPresentation } from "src/locale/shared/presentationContext";

vi.mock("src/locale/components/PresentationProvider", () => ({
    usePresentation: () => ({ data: { band: selectedBand } }),
}));

vi.mock("next/router", () => ({ useRouter: () => ({ pathname: "/backstage", requestPath: { internalPathname: "/backstage" } }) }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({
    useDashboardContext: () => dashboard, useClientTelemetryEvent: () => vi.fn(),
}));
vi.mock("src/core/components/CMCoreComponents2", () => ({ AdminInspectObject: () => null }));
vi.mock("src/core/components/AppContext", () => ({
    AppContextMarker: ({ children }: React.PropsWithChildren) => <>{children}</>, useAppContext: () => [],
}));
vi.mock("src/core/components/CMLink", () => ({ CMLink: (props: React.ComponentProps<"a">) => <a {...props} /> }));
vi.mock("src/core/components/event/RelevantEvents", () => ({ RelevantEvents: () => <div className="RelevantEvents">Relevant Events</div> }));
vi.mock("src/core/components/EventCalendar", () => ({ BigEventCalendar: () => <div className="CMBigCalendar">Calendar</div> }));
vi.mock("src/core/components/dashboard/DashboardLayout", () => ({ default: ({ children }: React.PropsWithChildren) => <>{children}</> }));
vi.mock("src/core/components/CMCoreComponents", () => ({
    PermissionBoundary: ({ permission, children }: React.PropsWithChildren<{ permission: PermissionRequirement }>) => dashboard.isAuthorized(permission) ? <>{children}</> : null,
}));
vi.mock("src/core/components/wiki/WikiStandaloneComponents", () => ({
    WikiStandaloneControl: (props: { canonicalWikiPath: string; className?: string; floatingHeader?: boolean }) =>
        <div className={props.className} data-floating={props.floatingHeader}>{props.canonicalWikiPath}</div>,
}));
vi.mock("src/setting/client/components/SettingMarkdown", () => ({
    BandLocalizedMarkdown: ({ id }: { id: string }) => <div data-setting={id}>{id}</div>,
    Localized: ({ id }: { id: LocalizedPlainStringKey }) => <>{kStaticLocalizedStringRegistry[id].defaultValue}</>,
}));
vi.mock("src/locale/components/useLocale", () => ({
    useLocale: () => ({
        getPlainString: (key: LocalizedPlainStringKey, parameters?: { bandName: string }) =>
            kStaticLocalizedStringRegistry[key].defaultValue.replace("{bandName}", parameters?.bandName ?? ""),
    })
}));
import { AddDynMenuItemsToStatic, DynMenuToMenuItem, FlattenMenuSections, getCurrentMenuSection, SideMenu } from "src/core/components/dashboard/MenuStructure";
import { NavRealm, type MenuSection } from "src/core/components/dashboard/StaticMenuItems";
import { HomeContent } from "src/pages/backstage/index";

const band = parsePublicId<"Band">("DashboardBand001");
const otherBand = parsePublicId<"Band">("DashboardBand002");
let selectedBand: BandPresentation | null;
const permission = permissionDashboardView.hydrate(permissionDashboardView.parseDto({
    publicId: parsePublicId<"Permission">("DashboardPerm001"), name: Permission.visibility_members,
    description: "Members", sortOrder: 1, color: null, isVisibility: true,
    descriptionResolution: { value: "Members", localeTag: "en-US", scope: "global", source: "stored", reason: "exact", requestedTag: "en-US" },
    descriptionStringPublicId: null, significance: null, iconName: null,
}), createDashboardReferenceStore());
const references = createDashboardReferenceStore();
registerDashboardReferences(references, { permission: [permission] });
const grants = new Set<string>();
const memberPresentation: Pick<PresentationInput, "bandPublicId" | "routeLocale"> = { bandPublicId: band, routeLocale: "fr-BE" };
function authenticatedPerson(): { id: number } | null {
    return { id: 1 };
}
const hosting = { kind: "multiBand" } as const;
const dashboard = {
    dynMenuLinks: new TableAccessor<MenuLinkListClient>([]),
    permission: new TableAccessor([permission]),
    memberPresentation,
    currentUser: authenticatedPerson(),
    currentMembership: { bandUserInstruments: [] },
    isAuthorized: (value: PermissionRequirement | string) => typeof value === "string" ? grants.has(value)
        : satisfiesPermissionRequirement(value, permission => grants.has(permission), Boolean(dashboard.memberPresentation.bandPublicId)),
};
function menu(overrides: Partial<MenuLinkListClient> = {}): MenuLinkListClient {
    return {
        ...menuLinkListView.hydrate(menuLinkListView.parseDto({
            publicId: parsePublicId<"MenuLink">("DashboardMenu001"), caption: "Partitions", linkType: "Wiki",
            wikiSlug: "special/announcements", externalURI: null, applicationPage: "Resources", groupName: "scores",
            groupCssClass: "", itemCssClass: "score-link", iconName: null, visiblePermissionId: permission.publicId,
            realm: null, sortOrder: 2, createdAt: new Date(), createdByUserId: null, createdByUser: null,
            captionStringPublicId: null,
            captionResolution: { value: "Partitions", localeTag: "fr-BE", scope: "band", source: "stored", reason: "exact", requestedTag: "fr-BE" },
        }), references), ...overrides
    };
}
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    grants.clear(); grants.add(Permission.visibility_members); grants.add(Permission.view_wiki_pages); grants.add(Permission.view_events_nonpublic);
    dashboard.memberPresentation = { bandPublicId: band, routeLocale: "fr-BE" };
    selectedBand = { publicId: band, name: "River Band" };
    dashboard.currentUser = { id: 1 }; dashboard.currentMembership = { bandUserInstruments: [] };
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe("dashboard announcements and navigation", () => {
    it.each(["Different website title", ""])("uses the localized band name in menu captions with site title %j", async siteTitle => {
        grants.add(Permission.login);
        const theme = createTheme();
        const renderMenu = () => act(async () => root.render(
            <BrandContext.Provider value={{ ...DefaultDbBrandConfig, siteTitle }}>
                <SideMenu open onClose={() => { }} variant="permanent" drawerWidth={260} theme={theme} />
            </BrandContext.Provider>,
        ));
        await renderMenu();
        expect(container.textContent).toContain("Your River Band Profile");
        expect(container.textContent).toContain("Your CMDB profile");
        selectedBand = { publicId: band, name: "Groupe Rivière" };
        await renderMenu();
        expect(container.textContent).toContain("Your Groupe Rivière Profile");
        expect(container.textContent).not.toContain("Your River Band Profile");
        selectedBand = { publicId: otherBand, name: "Brass Collective" };
        dashboard.memberPresentation.bandPublicId = otherBand;
        await renderMenu();
        expect(container.textContent).toContain("Your Brass Collective Profile");
        selectedBand = { publicId: otherBand, name: null };
        await renderMenu();
        expect(container.textContent).toContain("Your Unnamed band Profile");
        selectedBand = null;
        dashboard.memberPresentation.bandPublicId = null;
        await renderMenu();
        expect(container.textContent).toContain("Your CMDB profile");
        expect(container.textContent).not.toContain("Your Unnamed band Profile");
    });

    it("retains nested Wiki paths, contextual band/locale, authored blank captions and external URLs", () => {
        const link = DynMenuToMenuItem(menu(), dashboard)!;
        expect(link.path).toBe("/backstage/wiki/special/announcements");
        expect(link).toMatchObject({ className: "score-link", permission: {
            anyOf: [Permission.visibility_members, Permission.global_band_admin], requiresBand: true,
        }, linkCaption: "Partitions", openInNewTab: false });
        expect(DynMenuToMenuItem(menu({ caption: { ...menu().caption, value: "" } }), dashboard)!.linkCaption).toBe("");
        const externalURI = "https://example.invalid/scores?edition=2026#brass";
        expect(DynMenuToMenuItem(menu({ linkType: "ExternalURL", externalURI }), dashboard)).toMatchObject({ path: externalURI, openInNewTab: true });
        dashboard.memberPresentation = { bandPublicId: otherBand, routeLocale: "nl-BE" };
        expect(DynMenuToMenuItem(menu(), dashboard)!.path).toBe("/backstage/wiki/special/announcements");
    });
    it("merges section/group names without case sensitivity and preserves static links and numeric order without mutating inputs", () => {
        const staticLink = DynMenuToMenuItem(menu({ caption: { ...menu().caption, value: "Static" } }), dashboard)!;
        const sections: MenuSection[] = [{ name: "Resources", groups: [{ className: "scores", links: [staticLink] }] }];
        const rows = [menu({ sortOrder: 20, caption: { ...menu().caption, value: "Later" } }), menu({ sortOrder: 2 })];
        const merged = AddDynMenuItemsToStatic(sections, new Map([["resources", new Map([["SCORES", rows]])]]), dashboard);
        expect(merged).toHaveLength(1); expect(merged[0]!.groups).toHaveLength(1);
        expect(merged[0]!.groups[0]!.links.map(link => link.linkCaption)).toEqual(["Static", "Partitions", "Later"]);
        expect(sections[0]!.groups[0]!.links).toEqual([staticLink]); expect(rows.map(row => row.sortOrder)).toEqual([20, 2]);
        const flat = FlattenMenuSections(dashboard, merged, hosting);
        expect(getCurrentMenuSection(flat, undefined, { pathname: "/backstage/wiki/[...slug]", requestPath: { internalPathname: "/backstage/wiki/special/announcements" } })).toBe("Resources");
    });
    it("filters revoked and unknown permissions and does not select external menu links as a local route", () => {
        const unknown = DynMenuToMenuItem(menu({ visiblePermissionId: parsePublicId<"Permission">("MissingPerm00001") }), dashboard)!;
        expect(unknown.permission).toBe(Permission.never_grant);
        const sections: MenuSection[] = [{ name: "Resources", groups: [{ links: [unknown, DynMenuToMenuItem(menu(), dashboard)!] }] }];
        expect(FlattenMenuSections(dashboard, sections, hosting).filter(row => row.item.type === "link")).toHaveLength(1);
        grants.delete(Permission.visibility_members);
        expect(FlattenMenuSections(dashboard, sections, hosting)).toEqual([]);
        grants.add(Permission.visibility_members);
        sections[0]!.groups[0]!.links = [DynMenuToMenuItem(menu({ linkType: "ExternalURL", externalURI: "/backstage" }), dashboard)!];
        expect(getCurrentMenuSection(FlattenMenuSections(dashboard, sections, hosting), NavRealm.backstageHome, { pathname: "/backstage", requestPath: { internalPathname: "/backstage" } })).toBeNull();
    });
    it("selects the original empty-string home realm and ignores unrelated and protocol-relative paths", () => {
        const link = DynMenuToMenuItem(menu(), dashboard)!;
        const sections: MenuSection[] = [{ name: "Home", groups: [{ links: [{ ...link, path: "/different", realm: NavRealm.backstageHome }] }] }];
        expect(getCurrentMenuSection(FlattenMenuSections(dashboard, sections, hosting), NavRealm.backstageHome, { pathname: "/backstage", requestPath: { internalPathname: "/backstage" } })).toBe("Home");
        expect(getCurrentMenuSection(FlattenMenuSections(dashboard, sections, hosting), NavRealm.songs, { pathname: "/backstage", requestPath: { internalPathname: "/backstage" } })).toBeNull();
        sections[0]!.groups[0]!.links = [{ ...link, path: "//example.invalid/backstage" }];
        expect(getCurrentMenuSection(FlattenMenuSections(dashboard, sections, hosting), undefined, { pathname: "//example.invalid/backstage", requestPath: { internalPathname: "//example.invalid/backstage" } })).toBeNull();
    });
    it("places floating announcements between the original header/footer and retains the scoped missing-instrument profile link", async () => {
        await act(async () => root.render(<HomeContent />));
        expect(container.querySelector(".announcementMarkdown")!.textContent).toBe("special/announcements");
        expect(container.querySelector(".announcementMarkdown")!.getAttribute("data-floating")).toBe("true");
        const text = container.textContent!;
        expect(text.indexOf("BackstageFrontpageHeaderMarkdown")).toBeLessThan(text.indexOf("special/announcements"));
        expect(text.indexOf("special/announcements")).toBeLessThan(text.indexOf("BackstageFrontpageMarkdown"));
        expect(container.querySelector("a")!.getAttribute("href")).toBe(`/fr-BE/b/${band}/profile`);
        expect(container.querySelector(".RelevantEvents")).not.toBeNull();
        expect(container.querySelector(".CMBigCalendar")).not.toBeNull();
        expect(text.indexOf("special/announcements")).toBeLessThan(text.indexOf("Relevant Events"));
        expect(text.indexOf("Calendar")).toBeLessThan(text.indexOf("BackstageFrontpageMarkdown"));
    });
    it("does not mount announcements without band, active user or Wiki read permission, or Event controls without their grant", async () => {
        grants.clear();
        await act(async () => root.render(<HomeContent />));
        expect(container.querySelector(".announcementMarkdown")).toBeNull();
        expect(container.querySelector(".RelevantEvents")).toBeNull();
        expect(container.querySelector(".CMBigCalendar")).toBeNull();
        grants.add(Permission.view_wiki_pages);
        // Home only needs the presence of an authenticated person and explicit selected band.
        dashboard.currentUser = null;
        await act(async () => root.render(<HomeContent />));
        expect(container.querySelector(".announcementMarkdown")).toBeNull();
        dashboard.currentUser = { id: 1 };
        dashboard.memberPresentation.bandPublicId = undefined;
        await act(async () => root.render(<HomeContent />));
        expect(container.querySelector(".announcementMarkdown")).toBeNull();
        expect(container.textContent).toContain(kStaticLocalizedStringRegistry["dashboard.band.required"].defaultValue);
    });
});
