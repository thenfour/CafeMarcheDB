import React from "react";
import { useQuery } from "@blitzjs/rpc";
import type { UserPublicId } from "shared/publicId";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import getUserAccountAnalysisChoices from "src/core/db3/queries/getUserAccountAnalysisChoices";
import type { UserAccountAnalysisChoice } from "src/core/db3/shared/getUserMassAnalysisTypes";
import { useLocale } from "src/locale/components/useLocale";
import { SelectionPicker } from "../select/SelectionPicker";
import { makeLocalSelectionSource } from "../select/selectionSource";
import { UserChip } from "./userChip";

export type AccountAnalysisChoice = UserAccountAnalysisChoice;

// used by mass analysis comparison
export function AccountAnalysisComparisonPicker({ excludedUserId, onSelect, onClose }: {
    readonly excludedUserId: UserPublicId;
    readonly onSelect: (account: AccountAnalysisChoice) => void;
    readonly onClose: () => void;
}) {
    const context = useDB3QueryContext();
    const { bandPublicId: _band, ...input } = context;
    const locale = useLocale();
    const [result] = useQuery(getUserAccountAnalysisChoices, input, { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    const accounts = result.filter(account => account.publicId !== excludedUserId);
    const source = makeLocalSelectionSource<AccountAnalysisChoice>({
        items: accounts, getKey: account => account.publicId,
        getLabel: account => `${account.name} ${account.email} ${account.publicId}`,
        renderValue: account => <><UserChip value={account} noLink />{account.isDeleted && <span> ({locale.getPlainString("accountAnalysis.inactive")})</span>}</>,
    });
    return <SelectionPicker source={source} value={[]} title={locale.getPlainString("accountAnalysis.compare")} onCancel={onClose}
        onAccept={selected => {
            const account = selected[0];
            if (account) {
                onSelect(account);
            }
            onClose();
        }} />;
}
