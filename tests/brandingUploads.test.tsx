// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import type { CMButtonProps } from "src/core/components/CMCoreComponents2";
import type { CMDBUploadFilesArgs } from "src/core/components/file/CMDBUploadFile";
import type { UploadedFile, UploadResponsePayload } from "src/core/db3/shared/fileTypes";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { createLocaleApi, type LocalizationCatalog } from "src/locale/shared/localizationCatalog";
import { collectLocalePreferences } from "src/locale/shared/localePreferences";
import { resolveString } from "src/locale/shared/stringResolution";
import { kStaticLocalizedStringRegistry } from "src/locale/shared/staticLocalizedStringRegistry";
import { RegisteredSettingsEditor } from "src/setting/client/components/RegisteredSettingsEditor";
import { renderBrandingAssetDraftTools } from "src/setting/client/components/BrandingAssetDraftTools";

vi.mock("@blitzjs/rpc", () => ({ useMutation: () => [mutate] }));
vi.mock("src/setting/server/mutations/updateBulkSettings", () => ({ default: vi.fn() }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => presentation }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => createLocaleApi(presentation.data?.localization ?? null) }));
vi.mock("src/core/components/SnackbarContext", () => ({ useSnackbar: () => ({ showSuccess, showError, showMessage }) }));
vi.mock("src/core/components/CMCoreComponents2", () => ({
    CMButton: ({ children, disabled, onClick }: React.PropsWithChildren<Pick<CMButtonProps, "disabled" | "onClick">>) =>
        <button disabled={disabled} onClick={onClick}>{children}</button>,
    CMButtonGroup: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    CircularProgressWithLabel: ({ value }: { value: number }) => <span>{value}%</span>,
}));
vi.mock("src/core/components/file/CMDBUploadFile", () => ({
    CMDBUploadFile: (args: CMDBUploadFilesArgs) => new Promise<UploadResponsePayload>((resolve, reject) => requests.push({ args, resolve, reject })),
}));

const mutate = vi.fn();
const invalidate = vi.fn(async () => {});
const showSuccess = vi.fn();
const showError = vi.fn();
const showMessage = vi.fn();
const bands = [parsePublicId<"Band">("BrandBand0000001"), parsePublicId<"Band">("BrandBand0000002")];
const favicon = "siteCustomization.faviconUrl";
const logo = "siteCustomization.logoUrl";
type AssetKey = typeof favicon | typeof logo;
const requests: Array<{ args: CMDBUploadFilesArgs; resolve: (response: UploadResponsePayload) => void; reject: (error: Error) => void }> = [];
const uploaded: UploadedFile = { publicId: parsePublicId<"File">("BrandFile0000001"), storedLeafName: "brand image.svg", fileLeafName: "brand.svg",
    mimeType: "image/svg+xml", externalURI: null, description: "", sizeBytes: 100, customData: null, uploadedByUserId: null };
const files: FileList = Object.assign([new File(["<svg/>"], "brand.svg", { type: "image/svg+xml" })], {
    item: (index: number) => index === 0 ? files[0]! : null,
});
let presentation: ReturnType<typeof usePresentation>;
let root: Root;
let container: HTMLDivElement;

function fixture(bandPublicId = bands[0]!, userPublicId = parsePublicId<"User">("BrandPerson00001"), routeLocale = "en-US"): ReturnType<typeof usePresentation> {
    const input = { bandPublicId, routeLocale, browserLanguages: ["nl-BE", "en-US"] };
    const preferences = collectLocalePreferences(input);
    const availability = { global: ["en-US"], band: ["en-US", "fr-BE", "nl-BE"] };
    // Every registered key is populated, as in a server presentation snapshot.
    const strings = Object.fromEntries(Object.entries(kStaticLocalizedStringRegistry).map(([key, definition]) => [key,
        resolveString({ preferences, availability, registeredDefault: definition.defaultValue, globalValues: [], bandValues: [] }),
    ])) as LocalizationCatalog["strings"];
    return { bandPublicId, invalidate, data: { input,
        queryExecutionTimeMs: 0,
        band: { publicId: bandPublicId, name: "Test band" },
        authorization: { bandPublicId, userPublicId, bandUserPublicId: parsePublicId<"BandUser">("BrandMember00001"),
            effectivePermissionNames: [Permission.upload_files, Permission.manage_site_branding] },
        localization: { bandPublicId, preferences, availability, strings, formattingLocale: routeLocale, cacheKey: routeLocale, payloadBytes: 0 },
        settings: { global: {}, user: {}, bandUser: {}, band: {
            [favicon]: { value: "/favicon.png", source: "stored", capabilities: { canView: true, canEdit: true } },
            [logo]: { value: "/old-logo.svg", source: "stored", capabilities: { canView: true, canEdit: true } },
        } },
    } };
}
const row = (key: AssetKey = favicon) => container.querySelector<HTMLDivElement>(`[data-settings-key="${key}"]`)!;
const field = (key: AssetKey = favicon) => row(key).querySelector<HTMLInputElement>('input:not([type="file"])')!;
const input = (key: AssetKey = favicon) => row(key).querySelector<HTMLInputElement>('input[type="file"]')!;
const area = (key: AssetKey = favicon) => row(key).querySelector<HTMLDivElement>(key === favicon ? ".brandFaviconUploadArea" : ".brandLogoUploadArea")!;
const button = (label: string, key: AssetKey = favicon) => [...row(key).querySelectorAll("button")].filter(item => item.textContent === label).pop()!;
async function render() {
    await act(async () => root.render(<RegisteredSettingsEditor hive="band" renderDraftTools={renderBrandingAssetDraftTools} />));
}
async function openUpload(key: AssetKey = favicon) {
    if (!input(key)) {
        await act(async () => button(kStaticLocalizedStringRegistry["files.upload"].defaultValue, key).click());
    }
}
async function choose(key: AssetKey = favicon) {
    await openUpload(key);
    Object.defineProperty(input(key), "files", { configurable: true, value: files });
    await act(async () => Simulate.change(input(key)));
}
async function respond(index = requests.length - 1, responseFiles = [uploaded]) {
    await act(async () => requests[index]!.resolve({ isSuccess: true, files: responseFiles }));
}
async function edit(value: string, key: AssetKey = favicon) {
    await act(async () => { field(key).value = value; Simulate.change(field(key)); });
}
async function transfer(kind: "paste" | "drop", key: AssetKey, fileList: FileList | readonly File[] = [], text = "", target: Element = area(key)) {
    const event = new Event(kind, { bubbles: true, cancelable: true });
    // jsdom has no DataTransfer constructor; the controls consume only these two fields.
    Object.defineProperty(event, kind === "paste" ? "clipboardData" : "dataTransfer", { value: { files: fileList, getData: () => text } });
    await act(async () => (kind === "drop" ? area(key).querySelector(".fileDropWrapper")! : target).dispatchEvent(event));
    return event;
}
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks(); requests.length = 0; mutate.mockResolvedValue(undefined);
    presentation = fixture();
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe("branding uploads in the registered settings editor", () => {
    it("opens the native chooser and carries explicit band/public policy without person or membership associations", async () => {
        await render(); await openUpload();
        const click = vi.spyOn(input(), "click");
        await act(async () => Simulate.click(area().querySelector('[role="button"]')!));
        expect(click).toHaveBeenCalledOnce();
        await choose();
        expect(requests[0]!.args).toMatchObject({ bandPublicId: bands[0], files, fields: { visiblePermission: Permission.visibility_public } });
        expect(Object.keys(requests[0]!.args.fields)).toEqual(["visiblePermission"]);
        expect(requests[0]!.args.maxImageDimension).toBeUndefined();
        expect(field().disabled).toBe(true); expect(input().disabled).toBe(true);
        expect(button("Save").disabled).toBe(true); expect(button("Reset to default").disabled).toBe(true);
        expect(document.querySelector('.uploadProgressModal [role="status"]')).not.toBeNull();
        await act(async () => requests[0]!.args.onProgress(0.5, 50, 100));
        expect(document.querySelector('.uploadProgressModal [role="status"]')?.textContent).toBe("50%");
        await choose(); await transfer("paste", favicon, files); await transfer("drop", favicon, files);
        expect(requests).toHaveLength(1);
        await respond(); expect(field().disabled).toBe(false);
    });

    it("selects the first batch URL, previews it, and publishes only on an explicit save", async () => {
        await render(); await choose(); await respond(0, [uploaded, { ...uploaded, storedLeafName: "second.png" }]);
        const uri = `/api/files/download/brand%20image.svg?bandPublicId=${bands[0]}`;
        expect(field().value).toBe(uri); expect(row().querySelector("img")?.getAttribute("src")).toBe(uri);
        expect(field(logo).value).toBe("/old-logo.svg"); expect(mutate).not.toHaveBeenCalled();
        expect(showSuccess).toHaveBeenCalledWith(kStaticLocalizedStringRegistry["settings.brand.uploaded"].defaultValue);
        await act(async () => button("Save").click());
        expect(mutate).toHaveBeenCalledWith({ bandPublicId: bands[0], commands: [{ hive: "band", key: favicon, operation: { kind: "set", value: uri } }] });
        expect(invalidate).toHaveBeenCalledOnce();
    });

    it.each(["paste", "drop"] as const)("routes a file %s only to the selected asset even with both choosers open", async kind => {
        await render(); await openUpload(); await openUpload(logo);
        expect((await transfer(kind, logo, files)).defaultPrevented).toBe(true);
        expect(requests).toHaveLength(1);
        await respond(); expect(field().value).toBe("/favicon.png"); expect(field(logo).value).toContain("brand%20image.svg");
    });

    it.each(["paste", "drop"] as const)("sets an external URL draft from %s without uploading a File", async kind => {
        await render(); await transfer(kind, logo, [], "https://example.com/logo.svg");
        expect(field(logo).value).toBe("https://example.com/logo.svg"); expect(requests).toHaveLength(0); expect(mutate).not.toHaveBeenCalled();
        expect(showSuccess).toHaveBeenCalledWith(kStaticLocalizedStringRegistry["settings.brand.urlSet"].defaultValue);
    });

    it("preserves ordinary URL-field paste and rejects dangerous URL drops", async () => {
        await render(); await openUpload(); await openUpload(logo);
        expect((await transfer("paste", favicon, [], "https://example.com/typed.svg", field())).defaultPrevented).toBe(false);
        await transfer("drop", favicon, [], "javascript:alert(1)");
        expect(field().value).toBe("/favicon.png"); expect(requests).toHaveLength(0); expect(showSuccess).not.toHaveBeenCalled();
    });

    it("retains a failed upload's draft and allows a retry", async () => {
        await render(); await edit("/my-draft.png"); await choose();
        await act(async () => requests[0]!.reject(new Error("Image processing or storage failed")));
        expect(field().value).toBe("/my-draft.png"); expect(field().disabled).toBe(false);
        expect(document.querySelector('.uploadProgressModal [role="status"]')).toBeNull();
        expect(showError).toHaveBeenCalledWith(kStaticLocalizedStringRegistry["settings.brand.uploadFailed"].defaultValue);
        await choose(); await respond(); expect(field().value).toContain("brand%20image.svg");
    });

    it("treats an empty success response as a failure without clearing the draft", async () => {
        await render(); await choose(); await respond(0, []);
        expect(field().value).toBe("/favicon.png"); expect(showError).toHaveBeenCalledOnce(); expect(mutate).not.toHaveBeenCalled();
    });

    it("supports cancel, clear, intentional blank save and explicit logo reset", async () => {
        await render(); await choose(logo); await respond();
        await act(async () => button("Cancel", logo).click());
        expect(field(logo).value).toBe("/old-logo.svg");
        await act(async () => button("Clear image", logo).click());
        expect(row(logo).querySelector("img")).toBeNull();
        await act(async () => button("Save", logo).click());
        expect(mutate).toHaveBeenLastCalledWith({ bandPublicId: bands[0], commands: [{ hive: "band", key: logo, operation: { kind: "set", value: "" } }] });
        await act(async () => button("Reset to default", logo).click());
        expect(mutate).toHaveBeenLastCalledWith({ bandPublicId: bands[0], commands: [{ hive: "band", key: logo, operation: { kind: "reset" } }] });
        expect(field(logo).value).toBe(""); expect(requests).toHaveLength(1);
    });

    it("keeps the uploaded URL after fresh save authorization fails", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        await render(); await choose(); await respond();
        const draft = field().value; mutate.mockRejectedValueOnce(new Error("Branding grant revoked"));
        await act(async () => button("Save").click());
        expect(field().value).toBe(draft); expect(invalidate).not.toHaveBeenCalled(); expect(button("Save").disabled).toBe(false);
    });

    it.each(["band", "account", "locale", "grant refresh"])("cancels a pending upload after a %s change and ignores late completion", async change => {
        await render(); await choose();
        const old = requests[0]!;
        presentation = fixture(change === "band" ? bands[1] : bands[0],
            parsePublicId<"User">(change === "account" ? "BrandPerson00002" : "BrandPerson00001"), change === "locale" ? "fr-BE" : "en-US");
        await render(); expect(old.args.signal?.aborted).toBe(true);
        await choose(logo); expect(requests).toHaveLength(2);
        await respond(0); expect(field().value).toBe("/favicon.png"); expect(field(logo).value).toBe("/old-logo.svg");
        expect(document.querySelector('.uploadProgressModal [role="status"]')).not.toBeNull(); expect(showSuccess).not.toHaveBeenCalled();
        await respond(1); expect(field(logo).value).toContain(`bandPublicId=${presentation.bandPublicId}`);
    });

    it("does not overwrite a draft changed while uploading", async () => {
        await render(); await choose(); await edit("/new-draft.png"); await respond();
        expect(field().value).toBe("/new-draft.png"); expect(showSuccess).not.toHaveBeenCalled();
        expect(showMessage).toHaveBeenCalledWith({ severity: "warning", children: kStaticLocalizedStringRegistry["settings.brand.draftChanged"].defaultValue });
    });

    it.each(["no band", "anonymous", "no upload grant", "read only"])("removes uploads for %s", async reason => {
        const data = presentation.data!;
        presentation = { ...presentation, bandPublicId: reason === "no band" ? null : presentation.bandPublicId, data: { ...data,
            authorization: { ...data.authorization, userPublicId: reason === "anonymous" ? null : data.authorization.userPublicId,
                effectivePermissionNames: reason === "no upload grant" ? [Permission.manage_site_branding] : data.authorization.effectivePermissionNames },
            settings: reason === "read only" ? { ...data.settings, band: { [favicon]: { ...data.settings.band[favicon]!, capabilities: { canView: true, canEdit: false } } } } : data.settings,
        } };
        await render(); expect(input()).toBeNull();
        await transfer("drop", favicon, files); await transfer("paste", favicon, files);
        expect(requests).toHaveLength(0);
    });

    it("cancels and suppresses feedback after unmount", async () => {
        await render(); await choose(); await act(async () => root.render(null));
        expect(requests[0]!.args.signal?.aborted).toBe(true);
        await respond(); expect(showSuccess).not.toHaveBeenCalled(); expect(showError).not.toHaveBeenCalled(); expect(mutate).not.toHaveBeenCalled();
    });
});
