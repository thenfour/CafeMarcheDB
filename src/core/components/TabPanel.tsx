import { Suspense } from "react";
import { CoalesceBool } from "shared/utils";

type TTabID = string | number | undefined | null;

interface CMTabProps {
    thisTabId: TTabID;
    summaryIcon?: React.ReactNode;
    summaryTitle?: React.ReactNode;
    summarySubtitle?: React.ReactNode;
    enabled?: boolean;
    canBeDefault?: boolean; // if the requested default tab is not available, 
};

export const CMTab = ({ enabled = true, ...props }: React.PropsWithChildren<CMTabProps>) => {
    return enabled && <Suspense>{props.children}</Suspense>;
};

const CMTabHeader = (props: CMTabProps & {
    selected: boolean,
    onClick: (e: React.MouseEvent<HTMLLIElement>) => void
}) => {
    return <li
        key={props.thisTabId}
        onClick={props.onClick}
        className={`CMTabHeaderRoot ${props.selected ? "selected" : "notselected"}`}
    >
        <div className="CMTabHeaderL2">
            {(props.summaryIcon !== undefined) && <div className="CMTabHeaderIcon">{props.summaryIcon}</div>}
            {(props.summaryTitle !== undefined) && <div className="CMTabHeaderTitle">{props.summaryTitle}</div>}
            {(props.summarySubtitle !== undefined) && <div className="CMTabHeaderSubtitle">{props.summarySubtitle}</div>}
        </div>
    </li>
};

export type CMTabPanelChild = React.ReactElement<React.PropsWithChildren<CMTabProps>>;

interface CMTabPanelProps {
    selectedTabId: TTabID;
    //defaultTabId?: TTabID;
    handleTabChange: (e: React.SyntheticEvent | undefined, newTabId: TTabID) => void;
    className?: string | undefined;
    style?: React.CSSProperties | undefined;
    children: CMTabPanelChild | CMTabPanelChild[];
    //setNewDefault?: (tabId: TTabID) => void;
    tablListStyle?: React.CSSProperties | undefined;
};

export const CMTabPanel = (props: CMTabPanelProps) => {
    const handleTabHeaderClick = (ch: React.ReactElement<React.PropsWithChildren<CMTabProps>>, e: React.MouseEvent<HTMLLIElement>) => {
        props.handleTabChange(e, ch.props.thisTabId);
    };

    const children = Array.isArray(props.children) ? props.children : [props.children];

    // if the selected tab is not available

    const enabledChildren = children.filter(tab => CoalesceBool(tab.props.enabled, true));
    let selectedChild = enabledChildren.find(tab => tab.props.thisTabId === props.selectedTabId);
    if (!selectedChild) {
        //selectedChild = filteredChildren.find(tab => tab.props.thisTabId === props.defaultTabId);
        //const moreFilteredChildren = filteredChildren.filter(t => !!t.props.canBeDefault);
        selectedChild = enabledChildren.find(tab => tab.props.canBeDefault);
        if (selectedChild) {
            //props.setNewDefault && props.setNewDefault(selectedChild.props.thisTabId);
            props.handleTabChange(undefined, selectedChild.props.thisTabId);
        } else if (enabledChildren.length) {
            selectedChild = enabledChildren[0];
        }
    }
    return <div className={`CMTabPanel ${props.className}`} style={props.style}>
        <div className="CMTabHeader">
            <ul className="CMTabList" style={props.tablListStyle}>
                {
                    enabledChildren.map(tab => <CMTabHeader key={tab.props.thisTabId} {...tab.props} onClick={e => handleTabHeaderClick(tab, e)} selected={selectedChild?.props.thisTabId === tab.props.thisTabId} />)
                }
            </ul>
        </div>
        {selectedChild &&
            <div className="CMTabExpanded">
                {selectedChild}
            </div>}
    </div>;
};
