
import React, { createContext, useContext, useMemo } from "react"
import { slugify, slugifyWithDots } from "shared/rootroot";

// Our context will hold an array of strings that represent the "stack."
interface AppContextDataBase {
    stack: string[];
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
    name: string
    children: React.ReactNode
}

export function AppContextMarker({ name, children }: Props) {
    // Get the current stack from our context
    const parentStack = useAppContext()

    // Create a new stack by appending this marker's name
    const nextStack = useMemo(() => {
        const newStack = [...parentStack.stack, slugifyWithDots(name)];
        return {
            stack: newStack,
            toString: () => newStack.join("/"),
        }
    }, [parentStack, name])

    // Provide this new stack to child components
    return (
        <AppContextData.Provider value={nextStack}>
            {children}
        </AppContextData.Provider>
    )
}

