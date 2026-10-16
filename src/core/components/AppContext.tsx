
import React, { createContext, useContext, useMemo } from "react";
import { slugifyWithDots } from "shared/rootroot";
import { ActivityFeatureAssociations } from "./featureReports/activityTracking";

// Our context will hold an array of strings that represent the "stack."
type AppContextDataBase = ActivityFeatureAssociations & {
    stack: string;
};
const AppContextData = createContext<AppContextDataBase>({
    stack: "",
});

// A simple hook to retrieve the stack
export function useAppContext() {
    return useContext(AppContextData)
}


type Props = ActivityFeatureAssociations & {
    name?: string | undefined,
    children: React.ReactNode
}

export function AppContextMarker({ name, children, ...associations }: Props) {
    const parentStack = useAppContext();

    const nextStack = useMemo<AppContextDataBase>(() => {
        const newStack = name ? `${parentStack.stack}/${slugifyWithDots(name)}` : parentStack.stack;//:  [...parentStack.stack, slugifyWithDots(props.name)] : parentStack.stack;
        const ret: AppContextDataBase = {
            ...parentStack,
            ...associations,
            stack: newStack,
        };
        return ret;
    }, [parentStack, name, ...Object.values(associations)]);

    // Provide this new stack to child components
    return (
        <AppContextData.Provider value={nextStack}>
            {children}
        </AppContextData.Provider>
    )
}

