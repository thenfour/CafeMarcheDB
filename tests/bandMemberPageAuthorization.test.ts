import { beforeEach, describe, expect, it, vi } from "vitest";
import getUser from "src/core/db3/queries/getUser";
import { getServerSideProps } from "src/pages/backstage/user/[...id_slug_tab]";
import { getServerSideProps as getPlatformServerSideProps } from "src/pages/backstage/platform-user/[...id_slug_tab]";
import { invokeResolver } from "./authorization/support/resolverHarness";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./authorization/support/authorizationFixtures";
import { bandUserIdentityView, bandUserProfileView } from "src/core/db3/shared/entities/user/bandUserProfile";
import { platformUserEditorView } from "src/core/db3/shared/entities/user/platformUser";
import { parsePublicId } from "shared/publicId";
import { Permission } from "shared/permissions";

// Authorization is opaque here; the native tests exercise its actual membership and field policies.
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization: (...args: unknown[]) => {
    authorizations.push(args);
    return Promise.resolve(authorizationMarker);
} }));
vi.mock("src/core/db3/server/db3QueryCore", () => ({ queryView: (input: unknown, auth: unknown) => {
    reads.push({ input, auth });
    return Promise.resolve({ items: available ? [{ ...identity, name: "Alice" }] : [] });
} }));
vi.mock("src/blitz-server", () => ({ gSSP: (callback: (args: PageInput) => Promise<unknown>) => callback }));
vi.mock("src/core/components/dashboard/DashboardLayout", () => ({ default: () => null }));
vi.mock("src/core/components/dashboard/StaticMenuItems", () => ({ NavRealm: { users: "users" } }));
vi.mock("src/core/components/user/BandMemberProfile", () => ({ BandMemberProfile: () => null }));
vi.mock("src/core/components/user/AccountProfile", () => ({ AccountProfilePageContent: () => null }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: () => "Member profile" }) }));

const personId = parsePublicId<"User">("User000000000001");
const bandPublicId = parsePublicId<"Band">("Band000000000001");
const identity = bandUserIdentityView.parseDto({ publicId: "Membership000001", user: { publicId: personId, name: "Alice" } });
const authorizationMarker = { hasPermission: (permission: Permission) => platformAccess && permission === Permission.manage_global_users };
const actor = createAuthorizationTestUser("normal");
const ctx = createAuthorizationTestContext(actor);
const authorizations: unknown[][] = [];
const reads: Array<{ input: unknown; auth: unknown }> = [];
let available: boolean;
let platformAccess: boolean;
interface PageInput {
    readonly params: { readonly id_slug_tab: string[] };
    readonly query: { readonly bandPublicId?: string; readonly routeLocale?: string };
    readonly req: { readonly headers: { readonly "accept-language": string } };
    readonly ctx: typeof ctx;
}
// The gSSP mock exposes its callback directly, including Blitz's injected ctx.
const page = getServerSideProps as unknown as (input: PageInput) => Promise<unknown>;
// The platform entrypoint exposes the same mocked Blitz callback.
const platformPage = getPlatformServerSideProps as unknown as (input: PageInput) => Promise<unknown>;
const pageInput: PageInput = { params: { id_slug_tab: [personId, "old-slug", "attendance"] }, query: { bandPublicId, routeLocale: "fr-BE" },
    req: { headers: { "accept-language": "nl-BE" } }, ctx };

beforeEach(() => {
    available = true;
    platformAccess = false;
    reads.length = 0;
    authorizations.length = 0;
});

describe("member page and lazy person lookup boundaries", () => {
    it("resolves user chips only through explicit scoped membership reads", async () => {
        expect(await invokeResolver(getUser, { userId: personId }, ctx)).toBeNull();
        expect(reads).toEqual([]);
        expect(await invokeResolver(getUser, { userId: personId, bandPublicId, routeLocale: "fr-BE", clientRequestId: "refresh" }, ctx)).toEqual(identity.user);
        expect(authorizations[0]).toEqual([ctx.session, bandPublicId]);
        expect(reads[0]).toMatchObject({ auth: authorizationMarker, input: {
            view: bandUserIdentityView, bandPublicId, routeLocale: "fr-BE", clientRequestId: "refresh", filter: { tableParams: { personPublicId: personId } },
        } });
    });
    it("returns no chip label for an unavailable membership and rejects forged input", async () => {
        available = false;
        expect(await invokeResolver(getUser, { userId: personId, bandPublicId }, ctx)).toBeNull();
        await expect(invokeResolver(getUser, { userId: personId, bandPublicId: "invalid" }, ctx)).rejects.toThrow();
    });
    it("keeps old person URL shapes while checking the selected membership before rendering", async () => {
        expect(await page(pageInput)).toEqual({ props: { personId, profileScope: "band", title: "Alice" } });
        expect(authorizations[0]).toEqual([ctx.session, bandPublicId]);
        expect(reads[0]).toMatchObject({ auth: authorizationMarker, input: {
            view: bandUserProfileView, bandPublicId, routeLocale: "fr-BE", browserLanguages: ["nl-BE"],
            filter: { tableParams: { personPublicId: personId } }, take: 1,
        } });
    });
    it("does not render an inactive, other-band or absent membership", async () => {
        available = false;
        expect(await page(pageInput)).toEqual({ notFound: true });
    });
    it("rejects invalid identities and unauthorized account context without a shared-person lookup", async () => {
        expect(await page({ ...pageInput, params: { id_slug_tab: ["123"] } })).toEqual({ notFound: true });
        expect(await platformPage({ ...pageInput, query: {} })).toEqual({ notFound: true });
        expect(reads).toEqual([]);
        expect(authorizations).toEqual([[ctx.session, null]]);
    });
    it("uses the platform account view for an explicit account URL, including inactive targets", async () => {
        platformAccess = true;
        expect(await platformPage({ ...pageInput, query: { routeLocale: "fr-BE" } })).toEqual({ props: { personId, profileScope: "account", title: "Alice" } });
        expect(authorizations).toEqual([[ctx.session, null]]);
        expect(reads[0]).toMatchObject({ input: { view: platformUserEditorView, includeDeleted: true,
            filter: { publicIds: [personId] }, bandPublicId: null, routeLocale: "fr-BE" } });
    });
    it("does not replace an unavailable band member with an account profile even for platform actors", async () => {
        platformAccess = true;
        available = false;
        expect(await page(pageInput)).toEqual({ notFound: true });
        expect(reads[0]).toMatchObject({ input: { view: bandUserProfileView } });
        expect(await platformPage({ ...pageInput, query: {} })).toEqual({ notFound: true });
    });
});
