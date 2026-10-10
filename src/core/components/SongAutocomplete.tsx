import React from "react";
import { useQuery } from "@blitzjs/rpc";
import { QuickSearchItemType, type QuickSearchItemMatch } from "shared/quickFilter";
import type * as db3 from "src/core/db3/db3";
import type { SongPublicId } from "shared/publicId";
import type { GetFilteredSongsItemSongPayload } from "../db3/shared/apiTypes";
import getFilteredSongs from "../db3/queries/getFilteredSongs";
import { AssociationAutocomplete } from "./ItemAssociation";
import { useDashboardContext } from "./dashboardContext/DashboardContext";

const songTypes: readonly QuickSearchItemType.song[] = [QuickSearchItemType.song];

export interface SongAutocompleteProps {
    value: Pick<db3.SongClientPayload, "name"> | null;
    onChange: (value: GetFilteredSongsItemSongPayload | null) => void;
    fadedSongIds?: SongPublicId[];
    autofocus?: boolean;
}

export function SongAutocomplete(props: SongAutocompleteProps) {
    const dashboard = useDashboardContext();
    return <SongAutocompleteInBand key={dashboard.requireBandPublicId()} {...props} />;
}

function SongAutocompleteInBand({ value, onChange, fadedSongIds = [], autofocus = false }: SongAutocompleteProps) {
    const dashboard = useDashboardContext();
    const [inputValue, setInputValue] = React.useState(value?.name ?? "");
    const [pendingSelection, setPendingSelection] = React.useState<QuickSearchItemMatch<QuickSearchItemType.song> | null>(null);
    const pendingSongId = pendingSelection?.id ?? null;
    const [fullResult] = useQuery(getFilteredSongs, { bandPublicId: dashboard.requireBandPublicId(), id: pendingSongId }, {
        enabled: pendingSongId !== null, suspense: false, useErrorBoundary: false,
        staleTime: 0, cacheTime: 0, keepPreviousData: false,
    });
    React.useEffect(() => {
        if (!pendingSelection || !fullResult) {
            return;
        }
        if (fullResult.matchingItem && fullResult.matchingItem.publicId !== pendingSelection.id) {
            return;
        }
        setPendingSelection(null);
        setInputValue("");
        onChange(fullResult.matchingItem);
    }, [pendingSelection, fullResult, onChange]);
    return <AssociationAutocomplete<QuickSearchItemType.song>
        allowedItemTypes={songTypes}
        permissionPolicy="requireAll"
        searchEnabled
        value={inputValue}
        autofocus={autofocus} onValueChange={setInputValue}
        onSelect={selection => {
            setPendingSelection(selection);
            if (!selection) {
                onChange(null);
            }
        }}
        getItemInfo={item => ({ className: fadedSongIds.includes(item.id) ? "faded" : "notfaded" })}
    />;
}

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/core/components/SongAutocomplete.tsx:1-67
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: b1d26e1abc5935afd754490e9bb65f3eeebaaab51733d3107e17638facc46548
// MIGRATION_REFERENCE_BEGIN
// // drag reordering https://www.npmjs.com/package/react-smooth-dnd
// // https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129
//
// // clipboard custom formats
// // https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api/
//
// import { useQuery } from '@blitzjs/rpc';
// import React from "react";
// import { QuickSearchItemMatch, QuickSearchItemType } from 'shared/quickFilter';
// import * as db3 from "src/core/db3/db3";
// import type { SongPublicId } from "shared/publicId";
// import getFilteredSongs from '../db3/queries/getFilteredSongs';
// import { GetFilteredSongsItemSongPayload } from '../db3/shared/apiTypes';
// import { AssociationAutocomplete } from './ItemAssociation';
//
//
// export interface SongAutocompleteProps {
//     value: Pick<db3.SongClientPayload, "name"> | null;
//     onChange: (value: GetFilteredSongsItemSongPayload | null) => void;
//     fadedSongIds?: SongPublicId[];
//     autofocus?: boolean;
// };
//
// export const SongAutocomplete = ({ value, onChange, fadedSongIds = [], autofocus = false, }: SongAutocompleteProps) => {
//     const [inputValue, setInputValue] = React.useState(value?.name ?? ""); // value of the input
//     const [pendingSelection, setPendingSelection] = React.useState<
//         QuickSearchItemMatch<QuickSearchItemType.song> | null
//     >(null);
//     const pendingSongId = pendingSelection?.id ?? null;
//
//     const [fullResult, _] = useQuery(getFilteredSongs, { id: pendingSongId }, {
//         suspense: false,
//         useErrorBoundary: false,
//     });
//
//     const handleSelection = React.useCallback((selection: QuickSearchItemMatch<QuickSearchItemType.song>) => {
//         setPendingSelection(selection);
//     }, []);
//
//     React.useEffect(() => {
//         if (!pendingSelection || !fullResult) {
//             return;
//         }
//
//         // Clear the pending selection first to allow the same item to be selected again
//         setPendingSelection(null);
//         setInputValue(""); // assuming the caller will use this value and then wants the autocomplete to be reset
//         onChange(fullResult.matchingItem);
//     }, [pendingSelection, fullResult, onChange]);
//
//     return <AssociationAutocomplete
//         allowedItemTypes={[QuickSearchItemType.song]}
//         value={inputValue}
//         onSelect={(value) => {
//             if (value) {
//                 handleSelection(value);
//             }
//         }}
//         autofocus={autofocus}
//         onValueChange={setInputValue}
//         getItemInfo={(item) => {
//             return {
//                 className: fadedSongIds.includes(item.id) ? "faded" : "notfaded",
//             };
//         }}
//     />
// };
// MIGRATION_REFERENCE_END
