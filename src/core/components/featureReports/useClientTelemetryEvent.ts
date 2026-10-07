import { getAntiCSRFToken } from "@blitzjs/auth";
import React from "react";
import { useThrottle } from "shared/useGeneral";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useAppContext } from "../AppContext";
import { collectDeviceInfo, type ClientActionRequest, type ClientActivityParams, type UseFeatureUseClientActivityParams } from "./activityTracking";

/** Keepalive delivery retains the context in which the action occurred. */
export function useClientTelemetryEvent(thisComponentContext?: string) {
    const appContext = useAppContext();
    const presentation = usePresentation();
    return async ({ feature, context, ...associations }: ClientActivityParams): Promise<void> => {
        const { stack, ...contextAssociations } = appContext;
        const request: ClientActionRequest = {
            event: {
                ...contextAssociations,
                ...associations,
                uri: window.location.href,
                context: [stack, thisComponentContext, context].filter(Boolean).join("/"),
                feature,
            },
            presentation: presentation.data?.input ?? { bandPublicId: presentation.bandPublicId ?? null },
        };
        request.event.deviceInfo = await collectDeviceInfo();
        // Keepalive supports the session middleware's anti-CSRF header during unload.
        const antiCSRFToken = getAntiCSRFToken();
        const headers: HeadersInit = [["Content-Type", "application/json"]];
        if (antiCSRFToken) {
            headers.push(["anti-csrf", antiCSRFToken]);
        }
        await fetch("/api/telemetry", {
            method: "POST", headers, body: JSON.stringify(request), keepalive: true,
        });
    };
}

export const useFeatureRecorder = () => useClientTelemetryEvent();

export function useRecordFeatureUse(params: UseFeatureUseClientActivityParams) {
    const recordEvent = useClientTelemetryEvent();
    const throttledRecordAction = useThrottle(() => {
        void recordEvent(params).catch(error => console.error("Error recording feature use", error));
    }, 250);
    React.useEffect(throttledRecordAction, []);
}
