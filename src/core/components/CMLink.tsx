import { ActivityFeature } from "./featureReports/activityTracking";
import Link from "next/link";
import { useAppContext } from "./AppContext";
import { useClientTelemetryEvent } from "./dashboardContext/DashboardContext";

type CMLinkProps = React.PropsWithChildren<{
    trackingFeature?: ActivityFeature | undefined;
    navigation?: "client" | "document";
    onClick?: (e: React.MouseEvent) => void;
    href: string;
    className?: string;
    target?: string;
    rel?: string;
    style?: React.CSSProperties;
    title?: string;
}>;

// use this for tracking purposes
// lsmb todo: use router.
export function CMLink({ trackingFeature = ActivityFeature.link_follow_internal, navigation = "client", onClick, ...rest }: CMLinkProps) {
    const recordFeature = useClientTelemetryEvent();
    //const appContext = useAppContext();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        //if (trackingFeature) {
        //console.log("CMLink clicked", { trackingFeature, appContext });

        void recordFeature({
            feature: trackingFeature,
        });
        //}
        if (onClick) {
            onClick(e);
        }
    }
    if (navigation === "document") {
        // Server endpoints and external handoffs must use a normal document request.
        return <a onClick={handleClick} {...rest} />;
    }
    return <Link onClick={handleClick} {...rest} />;
}
