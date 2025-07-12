import { IsNullOrWhitespace } from "@/shared/utils";
import { AdminInspectObject } from "../CMCoreComponents2";
import { CMLink } from "../CMLink";

export interface GenericSearchListItemProps<T> {
    index: number,
    item: T;
    refetch: () => void;

    href: string; // URL for the item
    title: string;
    icon?: React.ReactNode;
    bodyContent?: React.ReactNode;
    footerContent?: React.ReactNode;
    credits?: React.ReactNode[];
}

export const GenericSearchListItem = <T,>(props: GenericSearchListItemProps<T>) => {
    const validCredits = props.credits ? props.credits.filter(c => !IsNullOrWhitespace(c)) : [];
    return <div className={`songListItem`}>
        <div className="titleLine">
            <div className="topTitleLine">
                {props.icon}
                <CMLink className="nameLink" href={props.href}>{props.title}</CMLink>
                <div style={{ flexGrow: 1 }}>
                    <AdminInspectObject src={props.item} label="Obj" />
                </div>
                <span className="resultIndex">#{props.index}</span>
            </div>
        </div>

        {validCredits.length > 0 &&
            <div className="credits">
                {validCredits.map((credit, index) => (
                    <div className="credit row" key={index}>
                        <div className="fieldItem" key="email">{credit}</div>
                    </div>
                ))}
            </div>
        }

        <div className="searchBody">
            {props.bodyContent}
            {props.footerContent && <div className="lengthBpmLine row">
                {props.footerContent}
            </div>}
        </div>
    </div>
};


