import { ActivityFeature } from "./featureReports/activityTracking";
import { simulateLinkClick2 } from "./CMCoreComponents2";
import { CMDivLink } from "./CMLink";


// for the "relevant event happening today" card on the dashboard, we show direct links to setlist and descriptions.
interface SearchItemBigCardLinkProps {
    icon: React.ReactNode;
    title: string;
    uri: string;
    eventId: number;
};

export const SearchItemBigCardLink = (props: SearchItemBigCardLinkProps) => {
    return <CMDivLink trackingFeature={ActivityFeature.link_follow_internal} className='SearchItemBigCardLink interactable' onClick={async (e) => {
        simulateLinkClick2(props.uri, e);
    }}>
        <div className='SearchItemBigCardLinkIcon'>
            {props.icon}
        </div>
        <div className='SearchItemBigCardLinkText'>
            {props.title}
        </div>
    </CMDivLink>;
};

