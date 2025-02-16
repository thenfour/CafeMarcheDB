import React from "react";
import { gIconMap } from "src/core/db3/components/IconMap";
import { MatchingSlugItem } from "src/core/db3/shared/apiTypes";
import { NameValuePair } from "../CMCoreComponents2";
import { CMTextInputBase } from "../CMTextField";
import { getURIForEvent, getURIForInstrument, getURIForSong, getURIForUser } from "src/core/db3/clientAPILL";


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export async function fetchObjectQuery(keyword: string): Promise<MatchingSlugItem[]> {
    const response = await fetch(`/api/wiki/searchSongEvents?keyword=${keyword}`);

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    const ret = await response.json() as MatchingSlugItem[];
    return ret;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const AssociationValueLink = (props: { value: MatchingSlugItem | null, className?: string | undefined }) => {

    const className = `AssociationValue autoCompleteCMLinkItem ${props.className || ""} ${props.value?.itemType || "null"}`;

    if (!props.value) return <div className={className}>-</div>;
    switch (props.value?.itemType) {
        case "song":
            return <div className={className}><a className="flexLink" target="_blank" rel="noreferrer" href={getURIForSong(props.value)}>{gIconMap.MusicNote()} {props.value?.name}</a></div>;
        case "event":
            return <div className={className}><a className="flexLink" target="_blank" rel="noreferrer" href={getURIForEvent(props.value)}>{gIconMap.CalendarMonth()} {props.value?.name}</a></div>;
        case "user":
            return <div className={className}><a className="flexLink" target="_blank" rel="noreferrer" href={getURIForUser(props.value)}>{gIconMap.Person()} {props.value?.name}</a></div>;
        case "instrument":
            return <div className={className}><a className="flexLink" target="_blank" rel="noreferrer" href={getURIForInstrument(props.value)}>{gIconMap.Trumpet()} {props.value?.name}</a></div>;
        default:
            return <div className={className}>{props.value?.name}</div>;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const AssociationValue = (props: { value: MatchingSlugItem | null, className?: string | undefined }) => {

    const className = `AssociationValue autoCompleteCMLinkItem ${props.className || ""} ${props.value?.itemType || "null"}`;

    if (!props.value) return <div className={className}>-</div>;
    switch (props.value?.itemType) {
        case "song":
            return <div className={className}>{gIconMap.MusicNote()} {props.value?.name}</div>;
        case "event":
            return <div className={className}>{gIconMap.CalendarMonth()} {props.value?.name}</div>;
        case "user":
            return <div className={className}>{gIconMap.Person()} {props.value?.name}</div>;
        case "instrument":
            return <div className={className}>{gIconMap.Trumpet()} {props.value?.name}</div>;
        default:
            return <div className={className}>{props.value?.name}</div>;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface AssociationSelectProps {
    value: MatchingSlugItem | null;
    onChange: (newValue: MatchingSlugItem | null) => void;
    allowNull?: boolean;
};

// could use an AutoComplete, but this is just easier.
export const AssociationSelect = ({ allowNull = true, ...props }: AssociationSelectProps) => {
    const [query, setQuery] = React.useState<string>("");
    const [results, setResults] = React.useState<MatchingSlugItem[]>([]);

    React.useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            return;
        }
        void fetchObjectQuery(query).then((response) => {
            setResults(response);
        });
    }, [query]);

    return <NameValuePair
        name="Association"
        value={
            <div className="AssociationSelect">
                <CMTextInputBase
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <div style={{ display: "flex" }}>
                    {allowNull && !!props.value && <div className="selectable deemphasizedWithHover" onClick={() => props.onChange(null)}>{gIconMap.Close()}</div>}
                    <AssociationValueLink value={props.value} />
                </div>
                <div className="autoCompleteResults">
                    {results.map((item, index) => <div
                        key={index}
                        className="selectable"
                        onClick={() => {
                            props.onChange(item);
                            setQuery("");
                        }}
                    >
                        <AssociationValue
                            key={index}
                            value={item}
                            className="selectable" />
                    </div>
                    )}
                </div>
            </div>
        }
    />;
};