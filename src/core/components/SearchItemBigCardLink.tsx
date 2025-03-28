import { simulateLinkClick } from "./CMCoreComponents2";


// for the "relevant event happening today" card on the dashboard, we show direct links to setlist and descriptions.
interface SearchItemBigCardLinkProps {
    icon: React.ReactNode;
    title: string;
    uri: string;
};

export const SearchItemBigCardLink = (props: SearchItemBigCardLinkProps) => {
    return <div className='SearchItemBigCardLink interactable' onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
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

