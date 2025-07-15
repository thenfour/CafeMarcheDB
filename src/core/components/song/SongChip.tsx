import * as db3 from "src/core/db3/db3";
import { CMChip, CMChipSizeOptions } from "../CMChip";
import { ColorVariationSpec } from "../color/palette";
import { getURIForSong } from "../../db3/clientAPILL";
import { useDashboardContext } from "../DashboardContext";
import { Permission } from "@/shared/permissions";
import { getHashedColor } from "@/shared/utils";



export interface SongChipProps {
    value: db3.SongPayloadMinimum;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
    useHashedColor?: boolean;
};

export const SongChip = (props: SongChipProps) => {
    const dashboardContext = useDashboardContext();
    const href = dashboardContext.isAuthorized(Permission.view_songs) ? getURIForSong(props.value) : undefined;

    return <CMChip
        variation={props.variation}
        size={props.size}
        href={href}
        className={props.className}
    >
        {props.startAdornment}
        <span style={{ color: props.useHashedColor ? getHashedColor(props.value.id.toString()) : undefined }}>
            {props.value.name}
        </span>
        {props.endAdornment}
    </CMChip>
}

