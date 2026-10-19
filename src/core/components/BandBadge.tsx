import CheckIcon from "@mui/icons-material/Check";
import { Avatar, Box, Typography } from "@mui/material";
import type { BandIdentity } from "src/core/shared/bandIdentity";

/** A band's visual identity; callers supply any link or menu behavior. */
export function BandBadge({ band, selected = false }: { band: BandIdentity; selected?: boolean }) {
    const name = band.name ?? "";
    const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toLocaleUpperCase();

    return <Box component="span" className="BandBadge" sx={{
        display: "flex", alignItems: "center", gap: 1.5, width: "100%", minWidth: 0,
        boxSizing: "border-box", p: 1.5, borderRadius: 1,
        borderLeft: `6px solid ${band.theme.secondaryMain}`,
        backgroundColor: band.theme.primaryMain, color: band.theme.contrastText,
    }}>
        <Avatar component="span" src={band.logoUrl || undefined} alt="" variant="rounded" sx={{
            width: 44, height: 44, backgroundColor: "#fff", color: band.theme.primaryMain,
            fontWeight: 700, "& img": { objectFit: "cover" },
        }}>{initials}</Avatar>
        <Typography component="span" sx={{
            flex: 1, minWidth: 0, fontWeight: 600, lineHeight: 1.3,
            whiteSpace: "normal", overflowWrap: "anywhere", color: "inherit",
        }}>{name}</Typography>
        {selected && <CheckIcon fontSize="small" />}
    </Box>;
}
