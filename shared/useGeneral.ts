import { useRef, useEffect } from "react";

// https://overreacted.io/making-setinterval-declarative-with-react-hooks/
export function useInterval(callback: () => void, intervalMilliseconds: number | null): void {
    const savedCallback = useRef<() => void>(callback);

    // Remember the latest callback if it changes.
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        function tick() {
            savedCallback.current();
        }
        if (intervalMilliseconds === null) {
            return; // this is a way to disable the calling entirely.
        }
        const id = setInterval(tick, intervalMilliseconds);
        return () => clearInterval(id);
    }, [intervalMilliseconds]);
};


// https://geekyants.com/blog/mastering-the-usethrottle-hook-in-react
export function useThrottle(cb: () => void, limitIntervalMilliseconds: number) {
    //const x = Date.now();
    const lastRun = useRef<number>(0);

    return function () {
        if (Date.now() - lastRun.current >= limitIntervalMilliseconds) {
            cb(); // Execute the callback
            lastRun.current = Date.now(); // Update last execution time
        }
    };
}