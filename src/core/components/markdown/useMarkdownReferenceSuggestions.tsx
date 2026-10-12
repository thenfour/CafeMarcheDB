import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import PersonIcon from "@mui/icons-material/Person";
import React from "react";
import { QuickSearchItemType, QuickSearchItemTypeSets, type QuickSearchItemMatch } from "shared/quickFilter";
import { useQuickSearchProvider } from "../search/useQuickSearchProvider";

interface MarkdownReferenceSuggestion {
    key: string;
    item: QuickSearchItemMatch;
    isCurrent: () => boolean;
}

/** The library needs a stable key even when output(null) rejects an outdated choice. */
export function useMarkdownReferenceSuggestions(enabled: boolean, textarea: React.MutableRefObject<HTMLTextAreaElement | null>) {
    const provider = useQuickSearchProvider(enabled);

    const invalidate = () => provider.invalidate();
    React.useEffect(() => {
        // The library listens on the textarea. Keep this synthetic Escape local
        // so dismissing suggestions cannot close an enclosing dialog.
        textarea.current?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: false }));
    }, [provider.scopeKey, provider.snapshot, enabled]);

    async function provide(token: string, wikiOnly: boolean): Promise<MarkdownReferenceSuggestion[]> {
        const element = textarea.current;
        const text = element?.value;
        const caret = element?.selectionEnd;
        const query = wikiOnly ? token.slice(1) : token;
        const allowedTypes = wikiOnly ? QuickSearchItemTypeSets.WikiPages : QuickSearchItemTypeSets.Everything;
        const batch = await provider.search(token.includes("]]") || (wikiOnly && !token.startsWith("[")) ? "" : query,
            allowedTypes, wikiOnly ? "requireAll" : "omitUnavailable");
        if (!batch) {
            // RTA 4.9 checks only the trigger, not the token, on completion. Settling an
            // abandoned callback would erase a newer popup; the discarded promise has no owner.
            return new Promise<MarkdownReferenceSuggestion[]>(() => {});
        }
        return batch.results.filter(item => !wikiOnly || !!item.canonicalWikiSlug).map(item => ({
            key: `${item.itemType}:${item.id}`,
            item,
            isCurrent: () => batch.isCurrent() && textarea.current === element
                && element?.value === text && element?.selectionEnd === caret,
        }));
    }

    const wikiTrigger = {
        dataProvider: (token: string) => provide(token, true),
        component: ({ entity, selected }: { entity: MarkdownReferenceSuggestion; selected: boolean }) => entity.isCurrent()
            ? <div className={`autoCompleteCMLinkItem wiki ${selected ? "selected" : "notSelected"}`}>{entity.item.canonicalWikiSlug}</div> : null,
        output: (entity: MarkdownReferenceSuggestion) => entity.isCurrent() ? `[[${entity.item.canonicalWikiSlug}]]` : null,
    };
    const mentionTrigger = {
        dataProvider: (token: string) => provide(token, false),
        component: ({ entity, selected }: { entity: MarkdownReferenceSuggestion; selected: boolean }) => entity.isCurrent() ?
            <div className={`autoCompleteCMLinkItem ${entity.item.itemType} ${selected ? "selected" : "notSelected"}`}>
                {entity.item.itemType === QuickSearchItemType.event && <CalendarMonthIcon />}
                {entity.item.itemType === QuickSearchItemType.song && <MusicNoteIcon />}
                {entity.item.itemType === QuickSearchItemType.user && <PersonIcon />}
                {entity.item.name}
            </div> : null,
        output: (entity: MarkdownReferenceSuggestion) => {
            if (!entity.isCurrent()) {
                return null;
            }
            // Wiki routes use canonical slugs; the old wikiPage:id output opened a nonexistent article.
            const path = entity.item.itemType === QuickSearchItemType.wikiPage
                ? entity.item.canonicalWikiSlug : `${entity.item.itemType}:${entity.item.id}`;
            return path ? `[[${path}|${entity.item.name}]]` : null;
        },
    };
    return { triggers: { "[[": wikiTrigger, "@": mentionTrigger }, invalidate };
}
