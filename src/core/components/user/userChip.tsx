import React from "react";
import { CMChip, CMChipSizeOptions } from "../CMChip";
import { useQuery } from "@blitzjs/rpc";
import getUser from "../../db3/queries/getUser";
import * as db3 from "src/core/db3/db3";
import { getHashedColor } from "shared/utils";
import { getURIForUser } from "../../db3/clientAPILL";
import { ColorVariationSpec } from "../color/palette";


export interface UserChipBaseProps {
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
    useHashedColor?: boolean;
    noLink?: boolean; // if true, will not render as a link
};

// the user chip when you know the user info.
type ValuedUserChipProps = UserChipBaseProps & {
    value: db3.UserPayload_Name | null;
    userId?: never;
    color?: string | null;
};

// the user chip when you know the user ID, and need to query for the info.
type QueriedUserChipProps = UserChipBaseProps & {
    userId: number | null;
    color?: string | null;
};

const ValuedUserChip = (props: ValuedUserChipProps) => {

    const userId = props.value?.id || null;
    const userURI = userId ? getURIForUser({ id: userId }) : undefined;

    const clickHandler = props.onClick;

    return <CMChip
        variation={props.variation}
        size={props.size}
        onClick={clickHandler}
        href={props.noLink ? undefined : userURI}
        className={props.className}
        color={props.color}
    >
        {props.startAdornment}
        <span style={{ color: props.useHashedColor ? getHashedColor(props.value?.id.toString() || "") : undefined }}>
            {props.value?.name || "--"}
        </span>
        {props.endAdornment}
    </CMChip>
}


const QueriedUserChip: React.FC<QueriedUserChipProps> = (props) => {
    if (props.userId === null) {
        return <ValuedUserChip
            value={null}
            variation={props.variation}
            size={props.size}
            onClick={props.onClick}
            className={props.className}
            startAdornment={props.startAdornment}
            endAdornment={props.endAdornment}
            useHashedColor={props.useHashedColor}
        />;
    }
    const [user, userX] = useQuery(getUser, { userId: props.userId });
    return <ValuedUserChip
        value={user}
        variation={props.variation}
        size={props.size}
        onClick={props.onClick}
        className={props.className}
        startAdornment={props.startAdornment}
        endAdornment={props.endAdornment}
        useHashedColor={props.useHashedColor}
    />;
};

export const UserChip = (props: ValuedUserChipProps | QueriedUserChipProps) => {

    return (props.userId !== undefined) ?
        <QueriedUserChip
            userId={props.userId}
            variation={props.variation}
            size={props.size}
            onClick={props.onClick}
            className={props.className}
            startAdornment={props.startAdornment}
            endAdornment={props.endAdornment}
            useHashedColor={props.useHashedColor}
            color={props.color}
            noLink={props.noLink}
        />
        : <ValuedUserChip
            value={props.value}
            variation={props.variation}
            size={props.size}
            onClick={props.onClick}
            className={props.className}
            startAdornment={props.startAdornment}
            endAdornment={props.endAdornment}
            useHashedColor={props.useHashedColor}
            color={props.color}
            noLink={props.noLink}
        />
}

