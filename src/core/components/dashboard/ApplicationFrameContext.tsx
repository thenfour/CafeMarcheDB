import React from "react";

interface ApplicationFrameContextValue {
    dialogHostElement: HTMLDivElement | null;
    dialogHostRef: (element: HTMLDivElement | null) => void;
    hasOpenDialogs: boolean;
    registerOpenDialog: () => () => void;
}

const ApplicationFrameContext = React.createContext<ApplicationFrameContextValue | null>(null);

/**
 * Owns overlay state for the dashboard application frame. Dialogs register
 * here so the page region can become inert without disabling the persistent
 * media-player region.
 */
export const ApplicationFrameProvider = ({ children }: React.PropsWithChildren) => {
    const [dialogHostElement, setDialogHostElement] = React.useState<HTMLDivElement | null>(null);
    const [openDialogCount, setOpenDialogCount] = React.useState(0);

    const dialogHostRef = React.useCallback((element: HTMLDivElement | null) => {
        setDialogHostElement(element);
    }, []);

    const registerOpenDialog = React.useCallback(() => {
        let registered = true;
        setOpenDialogCount(count => count + 1);

        return () => {
            if (!registered) return;
            registered = false;
            setOpenDialogCount(count => Math.max(0, count - 1));
        };
    }, []);

    const value = React.useMemo<ApplicationFrameContextValue>(() => ({
        dialogHostElement,
        dialogHostRef,
        hasOpenDialogs: openDialogCount > 0,
        registerOpenDialog,
    }), [dialogHostElement, dialogHostRef, openDialogCount, registerOpenDialog]);

    return <ApplicationFrameContext.Provider value={value}>
        {children}
    </ApplicationFrameContext.Provider>;
};

export const useApplicationFrame = () => React.useContext(ApplicationFrameContext);

/** Keeps the main application unavailable while leaving peer frame regions,
 * such as the media player, fully interactive. */
export const useApplicationFrameBackgroundRef = () => {
    const applicationFrame = useApplicationFrame();
    const backgroundRef = React.useRef<HTMLDivElement | null>(null);

    React.useLayoutEffect(() => {
        const background = backgroundRef.current;
        if (!background) return;

        if (applicationFrame?.hasOpenDialogs) background.setAttribute("inert", "");
        else background.removeAttribute("inert");

        return () => background.removeAttribute("inert");
    }, [applicationFrame?.hasOpenDialogs]);

    return backgroundRef;
};
