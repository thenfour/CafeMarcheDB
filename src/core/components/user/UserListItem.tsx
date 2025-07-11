import { StandardVariationSpec } from "@/shared/color";
import * as db3 from "src/core/db3/db3";
import { getURIForUser } from "../../db3/clientAPILL";
import { SearchResultsRet } from "../../db3/shared/apiTypes";
import { CMChip, CMChipContainer, CMStandardDBChip } from "../CMChip";
import { AdminInspectObject, GoogleIconSmall } from "../CMCoreComponents2";
import { CMLink } from "../CMLink";
import { DateValue } from "../DateTime/DateTimeComponents";
import { UsersFilterSpec } from "./UserClientBaseTypes";

export type EnrichedVerboseUser = db3.EnrichedUser<db3.UserPayload>;


type UserListItemProps = {
    index: number;
    user: EnrichedVerboseUser;
    results: SearchResultsRet;
    refetch: () => void;
    filterSpec: UsersFilterSpec;
};

export const UserListItem = (props: UserListItemProps) => {

    return <div className={`songListItem`}>
        <div className="titleLine">
            <div className="topTitleLine">
                <CMLink className="nameLink" href={getURIForUser(props.user)}>{props.user.name}</CMLink>
                <div style={{ flexGrow: 1 }}>
                    <AdminInspectObject src={props.user} label="Obj" />
                </div>
                <span className="resultIndex">#{props.index}</span>
            </div>
        </div>

        <div className="credits">
            <div className="credit row">
                <div className="fieldItem">{props.user.email}</div>
            </div>
            <div className="credit row">
                <div className="fieldItem">{props.user.phone}</div>
            </div>
        </div>

        <div className="searchBody">
            <CMChipContainer className="songTags">
                {props.user.tags.map(tag => <CMStandardDBChip
                    key={tag.id}
                    size='small'
                    model={tag.userTag}
                    variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.tagFilter.options.includes(tag.userTagId) }}
                    getTooltip={(_) => tag.userTag.description}
                />)}
                {props.user.role &&
                    <CMChip
                        color={props.user.role.color}
                        shape={"rectangle"}
                        size="small"
                        variation={{ ...StandardVariationSpec.Strong, selected: props.filterSpec.roleFilter.options.includes(props.user.role.id) }}
                    >
                        {props.user.role.name}
                    </CMChip>}
                {props.user.googleId && <GoogleIconSmall />
                }
            </CMChipContainer>

            <CMChipContainer className="instruments">
                {props.user.instruments.map(tag => <CMStandardDBChip
                    key={tag.id}
                    size='small'
                    model={tag.instrument}
                    variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.instrumentFilter.options.includes(tag.instrumentId) }}
                    getTooltip={(_) => tag.instrument.description}
                />)}
            </CMChipContainer>

            <div className="lengthBpmLine row">
                <DateValue value={props.user.createdAt} format={(dateStr) => `Created at ${dateStr}`} style={{ opacity: .5 }} />
            </div>

        </div>
    </div>;
};


