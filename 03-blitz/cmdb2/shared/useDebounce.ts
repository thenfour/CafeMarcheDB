// https://usehooks-ts.com/react-hook/use-debounce
import { useEffect, useState } from 'react'

export default function useDebounce<T>(value: T, delay?: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay || 500)

        return () => {
            clearTimeout(timer)
        }
    }, [value, delay])

    return debouncedValue
}

// use useDebounce() to convert a non-debounced value to debounced.
// then you can use useEffect() on the debounced value to trigger a change event.
//
// const debouncedHtml = useDebounce<string>(html || "", 500);
// React.useEffect(() => {
//     console.log(`value committed: ${debouncedHtml}`);
// }, [debouncedHtml]);

// on one hand you might think oh but i want a function to be triggered on debounce not a value changed.
// but i think this might actually be more clear logic because of how captures will be tempting to use but shouldn't be used in a fn.
