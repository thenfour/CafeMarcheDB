import React from "react";
import { CMChip, CMChipSizeOptions } from "./CMChip";
import { useQuery } from "@blitzjs/rpc";
import getUser from "../db3/queries/getUser";
import * as db3 from "src/core/db3/db3";
import { ColorVariationSpec } from "shared/color";
import { getHashedColor } from "shared/utils";


export interface UserChipBaseProps {
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
    useHashedColor?: boolean;
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
        />
}

