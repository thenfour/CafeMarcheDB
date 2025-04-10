
import React, { createContext, useContext, useMemo } from "react";
import { slugifyWithDots } from "shared/rootroot";

// Our context will hold an array of strings that represent the "stack."
interface AppContextDataBase {
    stack: string[];

    eventId?: number | undefined,
    songId?: number | undefined,
    wikiPageId?: number | undefined,
    fileId?: number | undefined,
    queryText?: string | undefined,

    toString: () => string;
};
const AppContextData = createContext<AppContextDataBase>({
    stack: [],
    toString: () => ""
});

// A simple hook to retrieve the stack
export function useAppContext() {
    return useContext(AppContextData)
}


type Props = {
    name?: string | undefined,
    eventId?: number | undefined,
    songId?: number | undefined,
    wikiPageId?: number | undefined,
    fileId?: number | undefined,
    queryText?: string | undefined,

    children: React.ReactNode
}

export function AppContextMarker(props: Props) {
    const parentStack = useAppContext();

    const nextStack = useMemo(() => {
        const newStack = props.name ? [...parentStack.stack, slugifyWithDots(props.name)] : parentStack.stack;
        return {
            stack: newStack,
            toString: () => newStack.join("/"),
            eventId: props.eventId || parentStack.eventId,
            songId: props.songId || parentStack.songId,
            wikiPageId: props.wikiPageId || parentStack.wikiPageId,
            fileId: props.fileId || parentStack.fileId,
            queryText: props.queryText || parentStack.queryText,
        }
    }, [parentStack, props.name, props.eventId, props.songId, props.wikiPageId, props.fileId, props.queryText]);

    // Provide this new stack to child components
    return (
        <AppContextData.Provider value={nextStack}>
            {props.children}
        </AppContextData.Provider>
    )
}

