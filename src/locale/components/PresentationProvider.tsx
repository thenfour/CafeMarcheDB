import { useQuery } from "@blitzjs/rpc";
import React from "react";
import { useSession } from "@blitzjs/auth";
import { queryClient } from "src/blitz-client";
import getPresentationData from "../queries/getPresentationData";
import type { PresentationInput, PresentationSelection } from "../shared/presentationInput";
import { presentationContextKey, type PresentationData } from "../shared/presentationContext";

interface PresentationContextValue {
    readonly data: PresentationData | null;
    readonly selection: PresentationSelection | undefined; // todo: remove selection.
    readonly invalidate: () => Promise<void>;
}
const PresentationContext = React.createContext<PresentationContextValue>({
    data: null,
    selection: undefined,
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

function LoadedPresentation({ input, children }: React.PropsWithChildren<{ input: PresentationInput }>) {
    const [data] = useQuery(getPresentationData, input, {
        staleTime: 0,
        cacheTime: 0,
        keepPreviousData: false,
    });
    const value = React.useMemo(() => ({
        data,
        selection: input.selection,
        invalidate: invalidatePresentation,
    }),
        [data, input.selection]);
    return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>;
}

export function PresentationProvider({ initial, selection, routeLocale, children }: React.PropsWithChildren<{
    initial: PresentationData;
    selection?: PresentationSelection;
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
        selection: selection ?? initial?.input.selection,
        routeLocale: routeLocale === undefined ? initial?.input.routeLocale : routeLocale,
        browserLanguages: [...(browserLanguages ?? initial?.input.browserLanguages ?? [])]
    };
    const contextKey = presentationContextKey(input);
    const [refresh, setRefresh] = React.useState(0);
    React.useEffect(() => {
        const update = () => setRefresh(value => value + 1);
        const storageUpdate = (event: StorageEvent) => { if (event.key === changeEvent) update(); };
        window.addEventListener(changeEvent, update);
        window.addEventListener("focus", update);
        window.addEventListener("storage", storageUpdate);
        return () => {
            window.removeEventListener(changeEvent, update);
            window.removeEventListener("focus", update);
            window.removeEventListener("storage", storageUpdate);
        };
    }, []);
    const sessionKey = `${session.userId ?? "public"}/${session.permissionNames?.join(",") ?? ""}`;
    const [initialSession] = React.useState(sessionKey);
    const initialEligible = React.useRef(true);
    // Generate outside the suspending child so retries use the same query input.
    const clientRequestId = React.useMemo(() => `${Date.now()}/${Math.random()}`, [contextKey, sessionKey, refresh]);
    if (!initial || initialSession !== sessionKey || refresh > 0 || presentationContextKey(initial.input) !== contextKey) {
        initialEligible.current = false;
    }
    const canUseInitial = initial && initialEligible.current;
    // During a scope/identity change the new tree suspends, so old text/grants cannot remain visible.
    return canUseInitial
        ? <PresentationContext.Provider value={{ data: initial, selection: input.selection, invalidate: invalidatePresentation }}>{children}</PresentationContext.Provider>
        : <React.Suspense fallback={<span role="status">Loading language and settings…</span>}>
            <LoadedPresentation key={clientRequestId} input={{ ...input, clientRequestId }}>{children}</LoadedPresentation>
        </React.Suspense>;
}
