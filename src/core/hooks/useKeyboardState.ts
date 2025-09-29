import React from "react";

export type KeyboardState = {
    isMac: boolean;
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
    pressed: ReadonlySet<string>;
    hasRawPasteIntent: () => boolean;
    consumeRawPasteIntent: () => boolean;
};

/**
 * A document-level keyboard tracker that exposes modifier state and a short-lived
 * "raw paste" intent when a platform-specific combo is pressed.
 *
 * Raw paste combos:
 * - Windows/Linux: Ctrl+Shift+V, Ctrl+Shift+Insert
 * - macOS: Cmd+Shift+V
 *
 * Shift+Insert alone is NOT treated as raw paste.
 */
export function useKeyboardState(): KeyboardState {
    const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || "");

    const pressedRef = React.useRef<Set<string>>(new Set());
    const [mods, setMods] = React.useState({ ctrl: false, shift: false, alt: false, meta: false });

    const rawPasteArmedRef = React.useRef(false);
    const rawPasteTTLRef = React.useRef<number | null>(null);

    const disarmRawPaste = React.useCallback(() => {
        rawPasteArmedRef.current = false;
        if (rawPasteTTLRef.current) {
            window.clearTimeout(rawPasteTTLRef.current);
            rawPasteTTLRef.current = null;
        }
    }, []);

    const armRawPaste = React.useCallback(() => {
        rawPasteArmedRef.current = true;
        if (rawPasteTTLRef.current) window.clearTimeout(rawPasteTTLRef.current);
        // Avoid sticky state if paste doesn't follow promptly
        rawPasteTTLRef.current = window.setTimeout(() => {
            rawPasteArmedRef.current = false;
            rawPasteTTLRef.current = null;
        }, 600);
    }, []);

    React.useEffect(() => {
        if (typeof window === "undefined" || typeof document === "undefined") return;

        const onKeyDown = (e: KeyboardEvent) => {
            pressedRef.current.add(e.key);

            // Update modifiers snapshot
            const next = { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey };
            setMods(prev =>
                prev.ctrl !== next.ctrl || prev.shift !== next.shift || prev.alt !== next.alt || prev.meta !== next.meta
                    ? next
                    : prev
            );

            const key = e.key;
            const vKey = key.toLowerCase ? key.toLowerCase() === "v" : key === "v";
            const insertKey = key === "Insert";

            // Raw paste combos
            const winLinuxRaw = (!isMac && e.ctrlKey && e.shiftKey && (vKey || insertKey));
            const macRaw = (isMac && e.metaKey && e.shiftKey && vKey);

            if (winLinuxRaw || macRaw) armRawPaste();
        };

        const onKeyUp = (e: KeyboardEvent) => {
            pressedRef.current.delete(e.key);

            const next = { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey };
            setMods(prev =>
                prev.ctrl !== next.ctrl || prev.shift !== next.shift || prev.alt !== next.alt || prev.meta !== next.meta
                    ? next
                    : prev
            );

            // If any critical key is released, disarm the raw paste intent
            const key = e.key;
            if (
                key === "Control" ||
                key === "Meta" ||
                key === "Shift" ||
                key === "Insert" ||
                (key.toLowerCase ? key.toLowerCase() === "v" : key === "v")
            ) {
                disarmRawPaste();
            }
        };

        document.addEventListener("keydown", onKeyDown, true);
        document.addEventListener("keyup", onKeyUp, true);
        return () => {
            document.removeEventListener("keydown", onKeyDown, true);
            document.removeEventListener("keyup", onKeyUp, true);
        };
    }, [armRawPaste, disarmRawPaste, isMac]);

    const hasRawPasteIntent = React.useCallback(() => rawPasteArmedRef.current, []);
    const consumeRawPasteIntent = React.useCallback(() => {
        const was = rawPasteArmedRef.current;
        disarmRawPaste();
        return was;
    }, [disarmRawPaste]);

    return {
        isMac,
        ctrl: mods.ctrl,
        shift: mods.shift,
        alt: mods.alt,
        meta: mods.meta,
        pressed: pressedRef.current,
        hasRawPasteIntent,
        consumeRawPasteIntent,
    };
}
