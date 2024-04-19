// https://usehooks-ts.com/react-hook/use-debounce
import { useEffect, useState } from 'react'

export interface DebounceInfo<T> {
    isDebouncing: boolean;
    isFirstUpdate: boolean;
};

export type DebounceResult<T> = [
    T,
    DebounceInfo<T>,
];

// uses useEffect's comparator which only works at root level. so it won't work for array contents or object fields for example.
// for arrays use useDebounceArray
export function useDebounce<T>(value: T, delay?: number): DebounceResult<T> {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)
    const [isDebouncing, setIsDebouncing] = useState<boolean>(false);
    const [isFirstUpdate, setIsFirstUpdate] = useState<boolean>(true);

    useEffect(() => {
        // don't debounce the initialization of values. there is nothing to save and we don't want activity indicators to be spinning on load.
        if (isFirstUpdate) {
            setIsFirstUpdate(false);
            setIsDebouncing(false);
            setDebouncedValue(value)
            return;
        }
        setIsDebouncing(true);
        const timer = setTimeout(() => {
            setIsDebouncing(false);
            setDebouncedValue(value)
        },
            delay || 500);

        return () => {
            setIsDebouncing(false);
            clearTimeout(timer);
        }
    }, [delay, value])

    return [
        debouncedValue,
        { isDebouncing, isFirstUpdate },
    ];
};



export function useDebounceArray<TValue>(valueArray: TValue[], delay?: number): DebounceResult<TValue[]> {
    const [debouncedValue, setDebouncedValue] = useState<TValue[]>(valueArray);
    const [isDebouncing, setIsDebouncing] = useState<boolean>(false);

    useEffect(() => {
        setIsDebouncing(true);
        const timer = setTimeout(() => {
            setIsDebouncing(false);
            setDebouncedValue(valueArray)
        },
            delay || 500);

        return () => {
            setIsDebouncing(false);
            clearTimeout(timer);
        }
    }, [delay, ...valueArray])

    // todo: support isFirstUpdate
    const isFirstUpdate = false;

    return [
        debouncedValue,
        { isDebouncing, isFirstUpdate },
    ];
};




// convert a non-debounced value to debounced.
// then you can use useEffect() on the debounced value to trigger a change event.
//
// const debouncedHtml = useDebounce<string>(html || "", 500);
// React.useEffect(() => {
//     console.log(`value committed: ${debouncedHtml}`);
// }, [debouncedHtml]);

// on one hand you might think oh but i want a function to be triggered on debounce not a value changed.
// but i think this might actually be more clear logic because of how captures will be tempting to use but shouldn't be used in a fn.
