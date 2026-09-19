export type ConnectionIssueReason = "browser-offline" | "server-unreachable" | "reconnecting";

export interface ConnectionHealthSnapshot {
    issue: null | {
        reason: ConnectionIssueReason;
        since: number;
        lastFailureAt: number;
    };
}

interface QueryWithErrorBoundaryState {
    state: {
        data: unknown;
    };
}

export interface ConnectivityFailureContext {
    source: "browser" | "query" | "mutation";
    operation?: string;
    hasCachedData?: boolean;
    failureCount?: number;
}

const connectivityErrorMessages = [
    /failed to fetch/i,
    /fetch failed/i,
    /load failed/i,
    /network error/i,
    /network request failed/i,
    /networkerror when attempting to fetch resource/i,
];

const connectedSnapshot: ConnectionHealthSnapshot = { issue: null };
let snapshot: ConnectionHealthSnapshot = connectedSnapshot;
const listeners = new Set<() => void>();

const isBrowserOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

const publish = (next: ConnectionHealthSnapshot) => {
    snapshot = next;
    listeners.forEach(listener => listener());
};

const errorDetails = (error: unknown) => {
    if (!(error instanceof Error)) {
        return { value: String(error) };
    }
    return {
        name: error.name,
        message: error.message,
        stack: error.stack,
    };
};

const diagnosticEnvironment = () => ({
    timestamp: new Date().toISOString(),
    browserOnline: typeof navigator === "undefined" ? undefined : navigator.onLine,
    pagePath: typeof location === "undefined" ? undefined : location.pathname,
});

export const isConnectivityError = (error: unknown): boolean => {
    if (!error || typeof error !== "object") return false;

    const candidate = error as { name?: unknown; message?: unknown; statusCode?: unknown };
    if (candidate.name === "AbortError") return false;
    if (typeof candidate.statusCode === "number") return false;

    const message = typeof candidate.message === "string" ? candidate.message : "";
    return connectivityErrorMessages.some(pattern => pattern.test(message));
};

// Two retries cover a short connectivity hiccup without keeping a genuinely
// unavailable initial page behind a spinner for a long time.
export const shouldRetryQuery = (failureCount: number, error: unknown): boolean =>
    failureCount < 2 && isConnectivityError(error);

export const shouldThrowQueryError = (error: unknown, query: QueryWithErrorBoundaryState): boolean => {
    // A failed refresh must not replace a page that already has useful data.
    // Initial loads still use the root fallback because there is nothing to show.
    if (isConnectivityError(error) && query.state.data !== undefined) return false;
    return true;
};

export const getConnectionHealthSnapshot = (): ConnectionHealthSnapshot => snapshot;
export const getServerConnectionHealthSnapshot = (): ConnectionHealthSnapshot => connectedSnapshot;

export const subscribeToConnectionHealth = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const reportConnectivityFailure = (error: unknown, context: ConnectivityFailureContext) => {
    const now = Date.now();
    const reason: ConnectionIssueReason = isBrowserOffline() ? "browser-offline" : "server-unreachable";
    const since = snapshot.issue?.since ?? now;

    console.warn("[CMDB connectivity] Request failed; cached data will remain visible when available.", {
        ...diagnosticEnvironment(),
        ...context,
        error: errorDetails(error),
    });

    publish({ issue: { reason, since, lastFailureAt: now } });
};

export const reportConnectivitySuccess = (operation?: string) => {
    if (isBrowserOffline() || snapshot.issue === null) return;

    console.info("[CMDB connectivity] Server connection restored.", {
        ...diagnosticEnvironment(),
        operation,
        disconnectedSince: new Date(snapshot.issue.since).toISOString(),
    });
    publish(connectedSnapshot);
};

const reportBrowserOffline = () => {
    const now = Date.now();
    const since = snapshot.issue?.since ?? now;
    console.warn("[CMDB connectivity] Browser reported that it is offline.", diagnosticEnvironment());
    publish({ issue: { reason: "browser-offline", since, lastFailureAt: now } });
};

const reportBrowserOnline = () => {
    if (snapshot.issue === null) return;
    console.info("[CMDB connectivity] Browser network returned; waiting for a successful server request.", diagnosticEnvironment());
    publish({
        issue: {
            ...snapshot.issue,
            reason: "reconnecting",
        },
    });
};

export const startBrowserConnectivityMonitoring = () => {
    if (typeof window === "undefined") return () => undefined;

    window.addEventListener("offline", reportBrowserOffline);
    window.addEventListener("online", reportBrowserOnline);
    if (isBrowserOffline()) reportBrowserOffline();

    return () => {
        window.removeEventListener("offline", reportBrowserOffline);
        window.removeEventListener("online", reportBrowserOnline);
    };
};

export const resetConnectionHealth = () => publish(connectedSnapshot);
