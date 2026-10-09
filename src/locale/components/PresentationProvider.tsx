import { useQuery } from "@blitzjs/rpc";
import React from "react";
import { useSession } from "@blitzjs/auth";
import { queryClient } from "src/blitz-client";
import getPresentationData from "../queries/getPresentationData";
import type { PresentationInput } from "../shared/presentationInput";
import type { BandPublicId } from "shared/publicId";
import { presentationContextKey, type PresentationData } from "../shared/presentationContext";

interface PresentationContextValue {
    readonly data: PresentationData | null;
    readonly bandPublicId: BandPublicId | null | undefined;
    readonly invalidate: () => Promise<void>;
}
const PresentationContext = React.createContext<PresentationContextValue>({
    data: null,
    bandPublicId: undefined,
    invalidate: async () => { },
});
export const usePresentation = () => React.useContext(PresentationContext);
const changeEvent = "cmdb-presentation-changed";

/** Call after localization, availability, settings, membership or grant mutations. */
export async function invalidatePresentation(): Promise<void> {
    // Localized entity queries must also drop their old strings and permission snapshots.
    await queryClient.invalidateQueries();
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(changeEvent));
        try { window.localStorage.setItem(changeEvent, `${Date.now()}/${Math.random()}`); } catch {
            // Storage may be disabled; focus/refetch still refreshes the current tab.
        }
    }
}

function LoadedPresentation({ input, initial, children }: React.PropsWithChildren<{ input: PresentationInput; initial?: PresentationData }>) {
    const [data] = useQuery(getPresentationData, input, {
        initialData: initial,
        enabled: !initial,
        staleTime: 0,
        cacheTime: 0,
        keepPreviousData: false,
    });
    if (!data) {
        throw new Error("Presentation query returned no snapshot.");
    }
    const value = React.useMemo(() => ({
        data,
        bandPublicId: input.bandPublicId,
        invalidate: invalidatePresentation,
    }),
        [data, input.bandPublicId]);
    return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>;
}

export function PresentationProvider({ initial, bandPublicId, routeLocale, children }: React.PropsWithChildren<{
    initial?: PresentationData;
    bandPublicId?: BandPublicId | null;
    routeLocale?: string | null;
}>) {
    const session = useSession();
    const [browserLanguages, setBrowserLanguages] = React.useState<readonly string[] | null>(null);
    React.useEffect(() => {
        const update = () => setBrowserLanguages([...navigator.languages]);
        update();
        window.addEventListener("languagechange", update);
        return () => window.removeEventListener("languagechange", update);
    }, []);
    const input: PresentationInput = {
        bandPublicId: bandPublicId === undefined ? initial?.input.bandPublicId : bandPublicId,
        routeLocale: routeLocale === undefined ? initial?.input.routeLocale : routeLocale,
        browserLanguages: [...(browserLanguages ?? initial?.input.browserLanguages ?? [])]
    };
    const contextKey = presentationContextKey(input);
    const [refresh, setRefresh] = React.useState(0);
    React.useEffect(() => {
        const update = () => setRefresh(value => value + 1);
        // Keep the loaded page visible while a focus refresh waits for its snapshot.
        const focusUpdate = () => React.startTransition(update);
        const storageUpdate = (event: StorageEvent) => { if (event.key === changeEvent) update(); };
        window.addEventListener(changeEvent, update);
        window.addEventListener("focus", focusUpdate);
        window.addEventListener("storage", storageUpdate);
        return () => {
            window.removeEventListener(changeEvent, update);
            window.removeEventListener("focus", focusUpdate);
            window.removeEventListener("storage", storageUpdate);
        };
    }, []);

    // TODO: lift out tab/session mgmt logic/plumbing.
    const sessionKey = `${session.userId ?? "public"}/${session.permissionNames?.join(",") ?? ""}`;
    const [initialSession] = React.useState(sessionKey);
    const initialEligible = React.useRef(true);
    // React may discard a changed useMemo during a suspended transition. Retain
    // each context's token across retries, or every retry starts another request.
    const requestIds = React.useRef(new Map<string, string>());
    const requestKey = JSON.stringify([contextKey, sessionKey, refresh]);
    let clientRequestId = requestIds.current.get(requestKey);
    if (!clientRequestId) {
        clientRequestId = `${Date.now()}/${Math.random()}`;
        requestIds.current.set(requestKey, clientRequestId);
    }
    if (!initial || initialSession !== sessionKey || refresh > 0 || presentationContextKey(initial.input) !== contextKey) {
        initialEligible.current = false;
    }
    const canUseInitial = initial && initialEligible.current;
    const scopeKey = JSON.stringify([contextKey, session.userId ?? null]);
    // During a band/account change the new tree suspends, so old text/grants cannot remain visible.
    // Refresh queries without remounting same-scope forms and discarding their drafts.
    return <React.Suspense key={scopeKey} fallback={<span role="status">Loading language and settings…</span>}>
        <LoadedPresentation input={{ ...input, clientRequestId }} initial={canUseInitial ? initial : undefined}>
            {children}
        </LoadedPresentation>
    </React.Suspense>;
}
