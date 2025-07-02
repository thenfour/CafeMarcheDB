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
    onError = (error, operation) => console.warn(`Failed to ${operation} from localStorage:`, error)
}: UseLocalStorageStateOptions<T>) {
    const [state, setState] = useState<T>(() => {
        const initial = typeof initialValue === 'function'
            ? (initialValue as () => T)()
            : initialValue;

        // Try to load from localStorage
        try {
            const saved = localStorage.getItem(key);
            if (saved) {
                const parsed = deserialize(saved);
                // // Merge with initial if initial is an object/Set, otherwise replace
                // if (initial instanceof Set && parsed instanceof Array) {
                //     parsed.forEach(item => (initial as Set<any>).add(item));
                //     return initial;
                // } else if (typeof initial === 'object' && initial !== null && typeof parsed === 'object' && parsed !== null) {
                //     return { ...initial, ...parsed };
                // }
                return parsed;
            }
        } catch (error) {
            onError(error as Error, 'load');
        }

        return initial;
    });

    // Save to localStorage whenever state changes
    useEffect(() => {
        try {
            const serialized = serialize(state);
            localStorage.setItem(key, serialized);
        } catch (error) {
            onError(error as Error, 'save');
        }
    }, [key, state, serialize, onError]);

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