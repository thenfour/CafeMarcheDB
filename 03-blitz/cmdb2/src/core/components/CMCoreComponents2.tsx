// avoiding circular dependencies by breaking this up a bit.
// this will be LOWER level than CMCoreComponents.
import React, { Suspense } from "react";


export interface CMSmallButtonProps {
    onClick?: () => void;
    variant?: "framed" | "default";
};

export const CMSmallButton = (props: React.PropsWithChildren<CMSmallButtonProps>) => {
    return <div className={`variant_${props.variant || "default"} interactable freeButton CMSmallButton`} onClick={() => { props.onClick && props.onClick() }}>
        {props.children}
    </div>;
};

