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
