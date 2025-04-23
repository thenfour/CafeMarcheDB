import { ActivityFeature } from "../db3/shared/activityTracking";
import { useFeatureRecorder } from "./DashboardContext";

type CMLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    trackingFeature: ActivityFeature;
}

// use this for tracking purposes
export function CMLink({ trackingFeature, onClick, ...rest }: CMLinkProps) {
    const recordFeature = useFeatureRecorder();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        void recordFeature({
            feature: trackingFeature,
        });
        if (onClick) {
            onClick(e)
        }
    }
    return <a onClick={handleClick} {...rest} />
}


type CMDivLinkProps = React.HTMLAttributes<HTMLDivElement> & {
    trackingFeature: ActivityFeature;
}

// use this for tracking purposes
export function CMDivLink({ trackingFeature, onClick, ...rest }: CMDivLinkProps) {
    const recordFeature = useFeatureRecorder();

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        void recordFeature({
            feature: trackingFeature,
        });
        if (onClick) {
            onClick(e)
        }
    }
    return <div onClick={handleClick} {...rest} />
}


type CMSpanLinkProps = React.HTMLAttributes<HTMLSpanElement> & {
    trackingFeature: ActivityFeature;
}

// use this for tracking purposes
export function CMSpanLink({ trackingFeature, onClick, ...rest }: CMSpanLinkProps) {
    const recordFeature = useFeatureRecorder();

    const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
        void recordFeature({
            feature: trackingFeature,
        });
        if (onClick) {
            onClick(e)
        }
    }
    return <span onClick={handleClick} {...rest} />
}

