import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { getHashedColor } from "@/shared/utils";
import { useCmdbRouter } from "@/src/route/useCmdbRouter";
import * as db3 from "src/core/db3/db3";
import { CMChip, CMChipSizeOptions } from "../CMChip";
import { ColorVariationSpec } from "../color/palette";
import { useDashboardContext } from "../dashboardContext/DashboardContext";



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
    const router = useCmdbRouter();
    const href = dashboardContext.isAuthorized(BandPermission.view_songs) ? router.getURIForSong(props.value) : undefined;

    return <CMChip
        variation={props.variation}
        size={props.size}
        href={href}
        className={props.className}
    >
        {props.startAdornment}
        <span style={{ color: props.useHashedColor ? getHashedColor(props.value.publicId) : undefined }}>
            {props.value.name}
        </span>
        {props.endAdornment}
    </CMChip>
}

