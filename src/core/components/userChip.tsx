import React from "react";
import { CMChip, CMChipSizeOptions } from "./CMChip";
import { useQuery } from "@blitzjs/rpc";
import getUser from "../db3/queries/getUser";
import * as db3 from "src/core/db3/db3";
import { ColorVariationSpec } from "shared/color";


export interface UserChipBaseProps {
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
};

// the user chip when you know the user info.
type ValuedUserChipProps = UserChipBaseProps & {
    value: db3.UserPayload_Name | null;
    userId?: never;
};

// the user chip when you know the user ID, and need to query for the info.
type QueriedUserChipProps = UserChipBaseProps & {
    userId: number | null;
};

const ValuedUserChip = (props: ValuedUserChipProps) => {
    return <CMChip
        variation={props.variation}
        size={props.size}
        onClick={props.onClick}
        className={props.className}
    >
        {props.value?.name || "--"}
    </CMChip>
}


const QueriedUserChip: React.FC<QueriedUserChipProps> = (props) => {
    const [user, userX] = useQuery(getUser, { userId: props.userId });
    return <ValuedUserChip
        value={user}
        variation={props.variation}
        size={props.size}
        onClick={props.onClick}
        className={props.className}
    />;
};

// export interface UserChipProps {
//     value?: db3.UserPayload_Name | null | undefined;
//     userId?: number | null | undefined;

//     variation?: ColorVariationSpec;
//     size?: CMChipSizeOptions;
//     onClick?: () => void;
//     className?: string;
// };

export const UserChip = (props: ValuedUserChipProps | QueriedUserChipProps) => {
    return (props.userId !== undefined) ?
        <QueriedUserChip
            userId={props.userId}
            variation={props.variation}
            size={props.size}
            onClick={props.onClick}
            className={props.className}
        />
        : <ValuedUserChip
            value={props.value}
            variation={props.variation}
            size={props.size}
            onClick={props.onClick}
            className={props.className}
        />
}

