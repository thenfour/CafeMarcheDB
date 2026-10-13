// this doesn't actually do the loading, it mostly manages
// invalidation and caching / refreshing.

import { useQuery } from "@blitzjs/rpc";
import React from "react";
import { useSession } from "@blitzjs/auth";
import { queryClient } from "src/blitz-client";
import getPresentationData from "../queries/getPresentationData";
import type { PresentationInput } from "../shared/presentationInput";
import type { BandPublicId } from "shared/publicId";
import { presentationContextKey, type PresentationData } from "../shared/presentationContext";

function newKey(): string {
    return `${Date.now().valueOf()}`;
}

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
    await queryClient.invalidateQueries();
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(changeEvent));
        try {
            window.localStorage.setItem(changeEvent, newKey());
        } catch {
            // Storage may be disabled; the local change event still refreshes this tab.
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
    React.useEffect(() => {
        document.documentElement.lang = data.localization.formattingLocale;
    }, [data.localization.formattingLocale]);
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
    // nb: full dashboard context not available here
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
        const storageUpdate = (event: StorageEvent) => { if (event.key === changeEvent) update(); };
        window.addEventListener(changeEvent, update);
        window.addEventListener("storage", storageUpdate);
        // do not automatically refresh on window focus; it's
        // distracting and unnecessary.
        // window.addEventListener("focus", update);
        return () => {
            window.removeEventListener(changeEvent, update);
            window.removeEventListener("storage", storageUpdate);
            // window.removeEventListener("focus", update);
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
        clientRequestId = newKey();
        requestIds.current.set(requestKey, clientRequestId);
    }
    if (!initial || initialSession !== sessionKey || refresh > 0 || presentationContextKey(initial.input) !== contextKey) {
        initialEligible.current = false;
    }
    const canUseInitial = initial && initialEligible.current;
    const scopeKey = JSON.stringify([contextKey, session.userId]);

    // During a band/account change the new tree suspends, so old text/grants cannot remain visible.
    // Refresh queries without remounting same-scope forms and discarding their drafts.
    return <React.Suspense
        key={scopeKey}
        fallback={<span role="status">Loading language and settings…</span>}
    >
        <LoadedPresentation
            input={{ ...input, clientRequestId }}
            initial={canUseInitial ? initial : undefined}
        >
            {children}
        </LoadedPresentation>
    </React.Suspense>;
}
