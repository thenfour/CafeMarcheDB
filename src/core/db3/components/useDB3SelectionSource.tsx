import React from "react";
import { TAnyModel } from "shared/rootroot";
import { SplitQuickFilter } from "shared/quickFilter";
import { CMChip, CMChipShapeOptions, CMChipSizeOptions } from "src/core/components/CMChip";
import { StandardVariationSpec } from "src/core/components/color/palette";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { SelectionSource } from "src/core/components/select/selectionSource";
import * as db3 from "../db3";
import { fetchUnsuspended } from "./DB3ClientCore";
import { useInsertMutationClient } from "./DB3ClientBasicFields";
import { useCrudViewCreate } from "./useCrudViewCreate";
import { useDB3Authorization } from "./useDB3Authorization";

interface DB3SelectionSourceProps<T> {
    schema: db3.xTable;
    view?: db3.AnyDB3CrudView;
    renderOption?: (item: T) => React.ReactNode;
    chipSize?: CMChipSizeOptions;
    chipShape?: CMChipShapeOptions;
    allowInsertFromString?: boolean;
    onInsert?: (item: T) => void;
}

// DB3 decides how to query, name, render and create rows; generic pickers own the UX.
export function useDB3SelectionSource<T extends TAnyModel>(props: DB3SelectionSourceProps<T>): SelectionSource<T> {
    if (props.view && props.view.entity.schema !== props.schema) {
        throw new Error(
            `DB3 CRUD view '${props.view.viewID}' does not belong to table '${props.schema.tableID}'.`,
        );
    }
    return {
        getKey: item => props.view?.entity.getIdentity(item) ?? props.schema.getRowInfo(item).pk,
        getLabel: item => props.schema.getRowInfo(item).name,
        matchesText: (item, text) => props.schema.doesItemExactlyMatchText(item, text),
        renderValue: item => {
            const info = props.schema.getRowInfo(item);
            return <CMChip size={props.chipSize || "small"} shape={props.chipShape || "rectangle"} color={info.color} tooltip={info.tooltip} variation={StandardVariationSpec.Strong}>{props.renderOption ? props.renderOption(item) : info.name}</CMChip>;
        },
        useOptions(filterText, enabled) {
            const publicData = useDB3Authorization();
            const dashboard = useDashboardContext();
            const mutation = useInsertMutationClient(props.schema, !props.view);
            const crudCreate = useCrudViewCreate(props.view);
            const query = fetchUnsuspended<T>({
                schema: props.schema,
                view: props.view,
                referenceProvider: dashboard.referenceStore,
                filterModel: { items: [], quickFilterValues: SplitQuickFilter(filterText) },
                queryOptions: { enabled, suspense: false, useErrorBoundary: false, keepPreviousData: true },
            });
            const canCreate = props.allowInsertFromString !== false && !!props.schema.createInsertModelFromString && props.schema.authorizeRowBeforeInsert({ publicData });
            return {
                items: query.items, isLoading: enabled && query.isLoading,
                isFetching: enabled && query.queryResult?.isFetching,
                isError: query.queryResult?.isError, isPreviousData: query.queryResult?.isPreviousData,
                refetch: query.refetch,
                createOption: canCreate ? async text => {
                    const model = props.schema.createInsertModelFromString!(text);
                    const item = crudCreate
                        ? await crudCreate.create(model) as T
                        : await mutation.doInsertMutation(model) as T;
                    if (!crudCreate) dashboard.refreshCachedData();
                    props.onInsert?.(item);
                    return item;
                } : undefined,
            };
        },
    };
}
