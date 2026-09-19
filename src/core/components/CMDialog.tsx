import { Box, BoxProps, DialogActions, DialogContent, DialogContentProps, DialogTitle, DialogTitleProps } from "@mui/material";
import React from "react";
import { ResponsiveDialog, ResponsiveDialogProps, useResponsiveDialogFullscreen } from "./ResponsiveDialog";

export interface CMDialogProps extends Omit<ResponsiveDialogProps, "children" | "title"> {
    title?: React.ReactNode;
    header?: React.ReactNode;
    actions?: React.ReactNode;
    titleProps?: DialogTitleProps;
    headerProps?: BoxProps;
    contentProps?: DialogContentProps;
    fillHeight?: boolean;
    children?: React.ReactNode;
}

/**
 * Coordinates a dialog launched by a MUI Menu. Opening another Modal while the
 * Menu is still exiting can leave the Menu's invisible backdrop active. Close
 * the Menu through requestOpen(), then pass onMenuExited to its transition.
 */
export const useDialogAfterMenuClose = () => {
    const pendingOpenRef = React.useRef(false);
    const [dialogOpen, setDialogOpen] = React.useState(false);

    const requestOpen = React.useCallback((closeMenu: () => void) => {
        pendingOpenRef.current = true;
        closeMenu();
    }, []);

    const onMenuExited = React.useCallback(() => {
        if (!pendingOpenRef.current) return;
        pendingOpenRef.current = false;
        setDialogOpen(true);
    }, []);

    const closeDialog = React.useCallback(() => setDialogOpen(false), []);

    return { dialogOpen, requestOpen, onMenuExited, closeDialog };
};

const DialogActionsCM = (props: React.PropsWithChildren<{ fullScreen?: boolean; className?: string }>) => {
    return <DialogActions
        disableSpacing
        className={["CMDialogActions", props.className].filter(Boolean).join(" ")}
        sx={{
            display: "block",
            flex: "0 0 auto",
            px: { xs: 2, md: 3 },
            pt: 1.5,
            pb: "max(12px, env(safe-area-inset-bottom))",
            borderTop: 1,
            borderColor: "divider",
            backgroundColor: "background.paper",
            "& .CMDialogActionsButtonContainer": {
                display: "flex",
                justifyContent: "flex-end",
                gap: 1.25,
            },
            "& .MuiButton-root, & .CMButton": {
                minWidth: 100,
                minHeight: 44,
                fontSize: 20,
                ...(props.fullScreen ? { flex: "1 1 0" } : {}),
            },
        }}
    >
        <div className="CMDialogActionsButtonContainer">{props.children}</div>
    </DialogActions>;
};

/**
 * Standard dialog anatomy: a non-scrolling header, one scrolling content area,
 * and actions which remain visible inside the usable visual viewport.
 */
export const CMDialog = ({
    title,
    header,
    actions,
    titleProps,
    headerProps,
    contentProps,
    fillHeight = false,
    className,
    children,
    sx,
    ...dialogProps
}: CMDialogProps) => {
    const fullScreen = useResponsiveDialogFullscreen();
    const { sx: contentSx, ...remainingContentProps } = contentProps ?? {};

    return <ResponsiveDialog
        {...dialogProps}
        className={["CMDialog", fillHeight && "CMDialogFillHeight", className].filter(Boolean).join(" ")}
        sx={[
            {
                "& .MuiDialog-paper": {
                    overflow: "hidden",
                    ...(fillHeight && !fullScreen ? { height: "min(660px, 100%)" } : {}),
                },
            },
            ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
    >
        {(title !== undefined || header !== undefined) && <Box
            {...headerProps}
            className={["CMDialogHeader", headerProps?.className].filter(Boolean).join(" ")}
            sx={[
                { flex: "0 0 auto", minWidth: 0 },
                ...(Array.isArray(headerProps?.sx) ? headerProps.sx : headerProps?.sx ? [headerProps.sx] : []),
            ]}
        >
            {title !== undefined && <DialogTitle {...titleProps}>{title}</DialogTitle>}
            {header}
        </Box>}
        <DialogContent
            dividers
            {...remainingContentProps}
            className={["CMDialogContent", contentProps?.className].filter(Boolean).join(" ")}
            sx={[
                { minHeight: 0, overscrollBehavior: "contain" },
                ...(Array.isArray(contentSx) ? contentSx : contentSx ? [contentSx] : []),
            ]}
        >
            {children}
        </DialogContent>
        {actions !== undefined && <DialogActionsCM fullScreen={fullScreen}>{actions}</DialogActionsCM>}
    </ResponsiveDialog>;
};
