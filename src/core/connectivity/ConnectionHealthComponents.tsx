import PowerOffIcon from "@mui/icons-material/PowerOff";
import { Box, CircularProgress, Tooltip, Typography } from "@mui/material";
import React from "react";
import {
    getConnectionHealthSnapshot,
    getServerConnectionHealthSnapshot,
    isConnectivityError,
    reportConnectivityFailure,
    reportConnectivitySuccess,
    startBrowserConnectivityMonitoring,
    subscribeToConnectionHealth,
} from "./connectionHealth";

interface QueryCacheEventLike {
    type: string;
    query?: {
        queryKey?: unknown[];
        state?: {
            data?: unknown;
            fetchFailureCount?: number;
        };
    };
    action?: {
        type?: string;
        error?: unknown;
        manual?: boolean;
    };
}

interface MutationCacheEventLike {
    type: string;
    mutation?: {
        mutationId?: number;
    };
    action?: {
        type?: string;
        error?: unknown;
    };
}

interface QueryClientLike {
    getQueryCache: () => {
        subscribe: (listener: (event: QueryCacheEventLike) => void) => () => void;
    };
    getMutationCache: () => {
        subscribe: (listener: (event: MutationCacheEventLike) => void) => () => void;
    };
}

export const useConnectionHealth = () => React.useSyncExternalStore(
    subscribeToConnectionHealth,
    getConnectionHealthSnapshot,
    getServerConnectionHealthSnapshot,
);

export const ConnectionHealthMonitor = ({ queryClient }: { queryClient?: QueryClientLike }) => {
    React.useEffect(() => {
        const stopBrowserMonitoring = startBrowserConnectivityMonitoring();
        const stopQueryMonitoring = queryClient?.getQueryCache().subscribe(event => {
            if (event.type !== "updated" || !event.action || !event.query) return;

            if (event.action.type === "error" && isConnectivityError(event.action.error)) {
                reportConnectivityFailure(event.action.error, {
                    source: "query",
                    // Blitz query keys begin with the RPC route. Deliberately do
                    // not log the remaining key entries because they contain args.
                    operation: typeof event.query.queryKey?.[0] === "string" ? event.query.queryKey[0] : undefined,
                    hasCachedData: event.query.state?.data !== undefined,
                    failureCount: event.query.state?.fetchFailureCount,
                });
                return;
            }

            // setQueryData also emits a success action. Only a real fetch proves
            // that the server can be reached again.
            if (event.action.type === "success" && !event.action.manual) {
                reportConnectivitySuccess(typeof event.query.queryKey?.[0] === "string" ? event.query.queryKey[0] : undefined);
            }
        }) ?? (() => undefined);
        const stopMutationMonitoring = queryClient?.getMutationCache().subscribe(event => {
            if (event.type !== "updated" || !event.action || !event.mutation) return;
            const operation = event.mutation.mutationId === undefined
                ? "mutation"
                : `mutation-${event.mutation.mutationId}`;

            if (event.action.type === "error" && isConnectivityError(event.action.error)) {
                reportConnectivityFailure(event.action.error, {
                    source: "mutation",
                    operation,
                    hasCachedData: false,
                });
                return;
            }
            if (event.action.type === "success") reportConnectivitySuccess(operation);
        }) ?? (() => undefined);

        return () => {
            stopMutationMonitoring();
            stopQueryMonitoring();
            stopBrowserMonitoring();
        };
    }, [queryClient]);

    return null;
};

const tooltipText = {
    "browser-offline": "Connection lost. Changes may not be saved. Reconnecting automatically.",
    "server-unreachable": "The server cannot be reached. Changes may not be saved. Reconnecting automatically.",
    reconnecting: "Network connection returned. Waiting for fresh data...",
} as const;

export const ConnectionStatusIndicator = () => {
    const health = useConnectionHealth();
    if (!health.issue) return null;

    const label = tooltipText[health.issue?.reason ?? "unknown"];
    return <Tooltip title={label} arrow>
        <Box
            component="span"
            className="connectionStatusIndicator"
            role="status"
            aria-label={label}
            tabIndex={0}
        >
            <PowerOffIcon fontSize="small" />
        </Box>
    </Tooltip>;
};

export const DashboardLoadingStatus = () => {
    const health = useConnectionHealth();
    if (!health.issue) return <CircularProgress color="inherit" />;

    return <Box sx={{ textAlign: "center", maxWidth: 520, px: 3 }} role="status">
        <PowerOffIcon sx={{ fontSize: 44, mb: 1 }} />
        <Typography variant="h6">Waiting for a connection</Typography>
        <Typography variant="body2">
            This page has not finished loading. It will continue automatically when the server can be reached.
        </Typography>
    </Box>;
};
