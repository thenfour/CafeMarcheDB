import { ActivityFeature } from "./featureReports/activityTracking";
import { useClientTelemetryEvent } from "./DashboardContext";
import Link from "next/link";

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
export function CMLink({ trackingFeature, onClick, ...rest }: CMLinkProps) {
    const recordFeature = useClientTelemetryEvent();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (trackingFeature) {
            void recordFeature({
                feature: trackingFeature,
            });
        }
        if (onClick) {
            onClick(e)
        }
    }
    return <Link onClick={handleClick} {...rest} />
}
