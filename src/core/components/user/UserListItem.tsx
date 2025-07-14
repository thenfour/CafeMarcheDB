import { Suspense } from "react";
import * as db3 from "src/core/db3/db3";
import { getURIForUser } from "../../db3/clientAPILL";
import { gIconMap } from "../../db3/components/IconMap";
import { SearchResultsRet } from "../../db3/shared/apiTypes";
import { CMChip, CMChipContainer, CMStandardDBChip } from "../CMChip";
import { DateValue } from "../DateTime/DateTimeComponents";
import { GenericSearchListItem } from "../search/SearchListItem";
import { UsersFilterSpec } from "./UserClientBaseTypes";
import { UserIdentityIndicator } from "./UserIdentityIndicator";
import { StandardVariationSpec } from "../color/palette";

export type EnrichedVerboseUser = db3.EnrichedUser<db3.UserPayload>;

type UserListItemProps = {
    index: number;
    user: EnrichedVerboseUser;
    results: SearchResultsRet;
    refetch: () => void;
    filterSpec: UsersFilterSpec;
};

export const UserListItem = (props: UserListItemProps) => {
    return <GenericSearchListItem<EnrichedVerboseUser>
        index={props.index}
        item={props.user}
        icon={gIconMap.Person()}
        refetch={props.refetch}
        href={getURIForUser(props.user)}
        title={props.user.name}
        credits={[
            props.user.email,
            props.user.phone,
        ]}
        bodyContent={
            <>
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
                    <Suspense>
                        <UserIdentityIndicator userId={props.user.id} showPassword={false} />
                    </Suspense>
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
            </>
        }
        footerContent={
            <>
                <DateValue value={props.user.createdAt} format={(dateStr) => `Created at ${dateStr}`} style={{ opacity: .5 }} />
            </>
        }
    />;
}
