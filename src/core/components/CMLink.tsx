import { ActivityFeature } from "../db3/shared/activityTracking";
import { useFeatureRecorder } from "./DashboardContext";

type CMLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    trackingFeature?: ActivityFeature;
}

// use this for tracking purposes
export function CMLink({ onClick, ...rest }: CMLinkProps) {
    const recordFeature = useFeatureRecorder();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        void recordFeature({
            feature: rest.trackingFeature || ActivityFeature.general_link_click,
        });
        if (onClick) {
            onClick(e)
        }
    }
    return <a onClick={handleClick} {...rest} />
}


type CMDivLinkProps = React.HTMLAttributes<HTMLDivElement> & {
    trackingFeature?: ActivityFeature;
}

// use this for tracking purposes
export function CMDivLink({ onClick, ...rest }: CMDivLinkProps) {
    const recordFeature = useFeatureRecorder();

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        void recordFeature({
            feature: rest.trackingFeature || ActivityFeature.general_link_click,
        });
        if (onClick) {
            onClick(e)
        }
    }
    return <div onClick={handleClick} {...rest} />
}


type CMSpanLinkProps = React.HTMLAttributes<HTMLSpanElement> & {
    trackingFeature?: ActivityFeature;
}

// use this for tracking purposes
export function CMSpanLink({ onClick, ...rest }: CMSpanLinkProps) {
    const recordFeature = useFeatureRecorder();

    const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
        void recordFeature({
            feature: rest.trackingFeature || ActivityFeature.general_link_click,
        });
        if (onClick) {
            onClick(e)
        }
    }
    return <span onClick={handleClick} {...rest} />
}

