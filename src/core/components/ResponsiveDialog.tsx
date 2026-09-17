import { Dialog, DialogProps, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import React from "react";

export type ResponsiveDialogProps = Omit<DialogProps, "fullScreen">;

export const useResponsiveDialogFullscreen = () => {
    const theme = useTheme();
    return useMediaQuery(theme.breakpoints.down("md"));
};

/** A standard MUI dialog on desktop which becomes edge-to-edge below the theme's md breakpoint. */
export const ResponsiveDialog = ({ className, ...props }: ResponsiveDialogProps) => {
    const fullScreen = useResponsiveDialogFullscreen();

    return <Dialog
        {...props}
        className={`${className ?? ""} ${fullScreen ? "smallScreen" : "bigScreen"}`.trim()}
        fullScreen={fullScreen}
    />;
};
