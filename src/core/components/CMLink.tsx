import { ActivityFeature } from "./featureReports/activityTracking";
import { useClientTelemetryEvent } from "./DashboardContext";
import Link from "next/link";
import { useAppContext } from "./AppContext";

type CMLinkProps = React.PropsWithChildren<{
    trackingFeature?: ActivityFeature | undefined;
    onClick?: (e: React.MouseEvent) => void;
    href: string;
    className?: string;
    target?: string;
    rel?: string;
    style?: React.CSSProperties;
    title?: string;
}>;

// use this for tracking purposes
export function CMLink({ trackingFeature = ActivityFeature.link_follow_internal, onClick, ...rest }: CMLinkProps) {
    const recordFeature = useClientTelemetryEvent();
    const appContext = useAppContext();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        //if (trackingFeature) {
        console.log("CMLink clicked", { trackingFeature, appContext });

        void recordFeature({
            feature: trackingFeature,
        });
        //}
        if (onClick) {
            onClick(e)
        }
    }
    return <Link onClick={handleClick} {...rest} />
}
