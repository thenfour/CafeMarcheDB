import { ActivityFeature } from "../db3/shared/activityTracking";
import { simulateLinkClick } from "./CMCoreComponents2";
import { useFeatureRecorder } from "./DashboardContext";


// for the "relevant event happening today" card on the dashboard, we show direct links to setlist and descriptions.
interface SearchItemBigCardLinkProps {
    icon: React.ReactNode;
    title: string;
    uri: string;
    eventId: number;
    feature: ActivityFeature;
};

export const SearchItemBigCardLink = (props: SearchItemBigCardLinkProps) => {
    const recordFeature = useFeatureRecorder();
    return <div className='SearchItemBigCardLink interactable' onClick={async (e) => {
        e.stopPropagation();
        e.preventDefault();
        await recordFeature({
            feature: props.feature,
            eventId: props.eventId,
            context: `SearchItemBigCardLink/${props.title}`,
        });
        simulateLinkClick(props.uri);
    }}>
        <div className='SearchItemBigCardLinkIcon'>
            {props.icon}
        </div>
        <div className='SearchItemBigCardLinkText'>
            {props.title}
        </div>
    </div>;
};

