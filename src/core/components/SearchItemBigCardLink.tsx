import { ActivityFeature } from "./featureReports/activityTracking";
import { CMLink } from "./CMLink";


// for the "relevant event happening today" card on the dashboard, we show direct links to setlist and descriptions.
interface SearchItemBigCardLinkProps {
    icon: React.ReactNode;
    title: string;
    uri: string;
    eventId: number;
};

export const SearchItemBigCardLink = (props: SearchItemBigCardLinkProps) => {
    return <CMLink href={props.uri} trackingFeature={ActivityFeature.link_follow_internal} className='SearchItemBigCardLink interactable'>
        <div className='SearchItemBigCardLinkIcon'>
            {props.icon}
        </div>
        <div className='SearchItemBigCardLinkText'>
            {props.title}
        </div>
    </CMLink>;
};

