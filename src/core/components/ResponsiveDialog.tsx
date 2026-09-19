import { Dialog, DialogProps, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import React from "react";

export type ResponsiveDialogProps = Omit<DialogProps, "fullScreen">;

export const useResponsiveDialogFullscreen = () => {
    const theme = useTheme();
    return useMediaQuery(theme.breakpoints.down("md"));
};

interface DialogViewportRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

/**
 * The layout viewport does not reliably shrink when a mobile keyboard opens.
 * Keep dialogs inside the visual viewport when the browser exposes it, with
 * window dimensions as a fallback for older browsers and tests.
 */
export const useDialogViewportRect = (active: boolean): DialogViewportRect | null => {
    const [rect, setRect] = React.useState<DialogViewportRect | null>(null);

    React.useEffect(() => {
        if (!active || typeof window === "undefined") {
            setRect(null);
            return;
        }

        const visualViewport = window.visualViewport;
        const update = () => {
            setRect(visualViewport ? {
                top: visualViewport.offsetTop,
                left: visualViewport.offsetLeft,
                width: visualViewport.width,
                height: visualViewport.height,
            } : {
                top: 0,
                left: 0,
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        update();
        window.addEventListener("resize", update);
        visualViewport?.addEventListener("resize", update);
        // Mobile Safari can pan the visual viewport to keep the focused field visible.
        visualViewport?.addEventListener("scroll", update);

        return () => {
            window.removeEventListener("resize", update);
            visualViewport?.removeEventListener("resize", update);
            visualViewport?.removeEventListener("scroll", update);
        };
    }, [active]);

    return rect;
};

/** A standard MUI dialog constrained to the usable viewport and edge-to-edge below md. */
export const ResponsiveDialog = ({ className, sx, style, open, ...props }: ResponsiveDialogProps) => {
    const fullScreen = useResponsiveDialogFullscreen();
    const viewport = useDialogViewportRect(open);
    const viewportVariables = viewport ? {
        "--cm-dialog-viewport-top": `${viewport.top}px`,
        "--cm-dialog-viewport-left": `${viewport.left}px`,
        "--cm-dialog-viewport-width": `${viewport.width}px`,
        "--cm-dialog-viewport-height": `${viewport.height}px`,
    } as React.CSSProperties : undefined;

    return <Dialog
        {...props}
        open={open}
        className={`${className ?? ""} ${fullScreen ? "smallScreen" : "bigScreen"}`.trim()}
        fullScreen={fullScreen}
        scroll={props.scroll ?? "paper"}
        style={{ ...style, ...viewportVariables }}
        sx={[
            {
                "& .MuiDialog-container": {
                    boxSizing: "border-box",
                    position: "absolute",
                    top: "var(--cm-dialog-viewport-top, 0px)",
                    left: "var(--cm-dialog-viewport-left, 0px)",
                    width: "var(--cm-dialog-viewport-width, 100vw)",
                    height: "max(0px, calc(var(--cm-dialog-viewport-height, 100dvh) - var(--media-bar-height, 0px)))",
                    minHeight: 0,
                    paddingTop: fullScreen ? 0 : "32px",
                    paddingBottom: 0,
                    alignItems: "flex-start",
                    justifyContent: "center",
                },
                "& .MuiDialog-paper": {
                    minHeight: 0,
                    maxHeight: fullScreen ? "100%" : "calc(100% - 64px)",
                    margin: 0,
                },
            },
            ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
    />;
};
