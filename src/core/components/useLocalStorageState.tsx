import { useEffect, useState } from 'react';

interface UseLocalStorageStateOptions<T> {
    key: string;
    initialValue: T | (() => T);
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
    onError?: (error: Error, operation: 'load' | 'save') => void;
}

export function useLocalStorageState<T>({
    key,
    initialValue,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
}: UseLocalStorageStateOptions<T>) {
    const [state, setState] = useState<T>(() => {

        const saved = localStorage.getItem(key);
        if (saved) {
            const parsed = deserialize(saved);
            return parsed;
        }

        const initial = typeof initialValue === 'function'
            ? (initialValue as () => T)()
            : initialValue;
        return initial;
    });

    useEffect(() => {
        const serialized = serialize(state);
        localStorage.setItem(key, serialized);
    }, [key, state, serialize]);

    return [state, setState] as const;
}

// Specialized hook for Set<string> with array serialization
export function useLocalStorageSet(
    key: string,
    initialValue: Set<string> | (() => Set<string>)
) {
    return useLocalStorageState({
        key,
        initialValue,
        serialize: (set: Set<string>) => JSON.stringify([...set]),
        deserialize: (str: string) => {
            //console.log(`deserializing Set from string`, str);
            return new Set(JSON.parse(str) as string[]);
        },
    });
}