import { Dialog, DialogProps, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import React from "react";
import { useApplicationFrame } from "./dashboard/ApplicationFrameContext";

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
export const useDialogViewportRect = (active: boolean, hostElement?: HTMLElement | null): DialogViewportRect | null => {
    const [rect, setRect] = React.useState<DialogViewportRect | null>(null);

    React.useEffect(() => {
        if (!active || typeof window === "undefined") {
            setRect(null);
            return;
        }

        const visualViewport = window.visualViewport;
        const update = () => {
            if (hostElement) {
                const hostRect = hostElement.getBoundingClientRect();
                setRect({
                    top: 0,
                    left: 0,
                    width: hostRect.width,
                    height: hostRect.height,
                });
                return;
            }

            const viewport = visualViewport ? {
                top: visualViewport.offsetTop,
                left: visualViewport.offsetLeft,
                right: visualViewport.offsetLeft + visualViewport.width,
                bottom: visualViewport.offsetTop + visualViewport.height,
            } : {
                top: 0,
                left: 0,
                right: window.innerWidth,
                bottom: window.innerHeight,
            };
            setRect({
                top: viewport.top,
                left: viewport.left,
                width: viewport.right - viewport.left,
                height: viewport.bottom - viewport.top,
            });
        };

        update();
        window.addEventListener("resize", update);
        if (!hostElement) {
            visualViewport?.addEventListener("resize", update);
            // Mobile Safari can pan the visual viewport to keep the focused field visible.
            visualViewport?.addEventListener("scroll", update);
        }
        const resizeObserver = hostElement && typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
        if (hostElement) resizeObserver?.observe(hostElement);

        return () => {
            window.removeEventListener("resize", update);
            if (!hostElement) {
                visualViewport?.removeEventListener("resize", update);
                visualViewport?.removeEventListener("scroll", update);
            }
            resizeObserver?.disconnect();
        };
    }, [active, hostElement]);

    return rect;
};

/** A standard MUI dialog constrained to the usable viewport and edge-to-edge below md. */
export const ResponsiveDialog = ({ className, sx, style, open, ...props }: ResponsiveDialogProps) => {
    const fullScreen = useResponsiveDialogFullscreen();
    const applicationFrame = useApplicationFrame();
    const usesApplicationFrame = props.container === undefined && applicationFrame !== null;
    const frameDialogHost = usesApplicationFrame ? applicationFrame.dialogHostElement : null;
    const viewport = useDialogViewportRect(open, frameDialogHost);
    const unregisterDialogRef = React.useRef<(() => void) | null>(null);

    React.useLayoutEffect(() => {
        if (open && usesApplicationFrame && applicationFrame && !unregisterDialogRef.current) {
            unregisterDialogRef.current = applicationFrame.registerOpenDialog();
        } else if (!open && unregisterDialogRef.current) {
            unregisterDialogRef.current();
            unregisterDialogRef.current = null;
        }
    }, [applicationFrame, open, usesApplicationFrame]);

    React.useEffect(() => () => {
        unregisterDialogRef.current?.();
        unregisterDialogRef.current = null;
    }, []);

    const viewportVariables = viewport ? {
        "--cm-dialog-viewport-top": `${viewport.top}px`,
        "--cm-dialog-viewport-left": `${viewport.left}px`,
        "--cm-dialog-viewport-width": `${viewport.width}px`,
        "--cm-dialog-viewport-height": `${viewport.height}px`,
    } as React.CSSProperties : undefined;

    return <Dialog
        {...props}
        open={open}
        container={props.container !== undefined ? props.container : frameDialogHost ?? undefined}
        disableEnforceFocus={props.disableEnforceFocus ?? !!frameDialogHost}
        className={`${className ?? ""} ${fullScreen ? "smallScreen" : "bigScreen"}`.trim()}
        fullScreen={fullScreen}
        scroll={props.scroll ?? "paper"}
        style={{ ...style, ...viewportVariables }}
        sx={[
            {
                ...(frameDialogHost ? {
                    "&.MuiDialog-root": {
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "auto",
                    },
                    "& .MuiBackdrop-root": {
                        position: "absolute",
                    },
                } : {}),
                "& .MuiDialog-container": {
                    boxSizing: "border-box",
                    position: "absolute",
                    top: "var(--cm-dialog-viewport-top, 0px)",
                    left: "var(--cm-dialog-viewport-left, 0px)",
                    width: "var(--cm-dialog-viewport-width, 100vw)",
                    height: "var(--cm-dialog-viewport-height, 100dvh)",
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
