import { useURLState } from "src/core/components/CMCoreComponents2";
import { DiscreteCriterion, DiscreteCriterionFilterType } from "src/core/db3/shared/apiTypes";
import { SortDirection } from "shared/rootroot";
import { arraysContainSameValues } from "shared/arrayUtils";
import React from "react";
import { SnackbarContext } from "src/core/components/SnackbarContext";

export interface DiscreteFilterConfig<T extends number | boolean | string = number> {
    urlPrefix: string; // e.g., "tg" for tags, "st" for status
    db3Column: string; // e.g., "tags", "status"
    defaultBehavior: DiscreteCriterionFilterType;
    defaultOptions: T[];
    defaultEnabled: boolean;
}

export interface DiscreteFilterState<T extends number | boolean | string = number> {
    enabled: boolean;
    setEnabled: (enabled: boolean) => void;
    criterion: DiscreteCriterion;
    setCriterion: (criterion: DiscreteCriterion) => void;
    // For convenience, individual setters
    setBehavior: (behavior: DiscreteCriterionFilterType) => void;
    setOptions: (options: T[]) => void;
}

/**
 * Hook for managing discrete filter state (tags, status, type, etc.)
 * Eliminates the repetitive pattern of 3 useState calls + URL state + criterion building
 */
export function useDiscreteFilter<T extends number | boolean | string = number>(
    config: DiscreteFilterConfig<T>
): DiscreteFilterState<T> {
    const [behavior, setBehavior] = useURLState<DiscreteCriterionFilterType>(
        `${config.urlPrefix}b`,
        config.defaultBehavior
    );

    const [options, setOptions] = useURLState<T[]>(
        `${config.urlPrefix}o`,
        config.defaultOptions
    );

    const [enabled, setEnabled] = useURLState<boolean>(
        `${config.urlPrefix}e`,
        config.defaultEnabled
    );

    const criterion: DiscreteCriterion = {
        db3Column: config.db3Column,
        behavior,
        options,
    }; const setCriterion = (newCriterion: DiscreteCriterion) => {
        setBehavior(newCriterion.behavior);
        setOptions(newCriterion.options as T[]);
    };

    return {
        enabled,
        setEnabled,
        criterion,
        setCriterion,
        setBehavior,
        setOptions,
    };
}

//////////////////////////////////////////////////////////////////////////////////////////////////
// Search Page Hook - Consolidates common search page patterns
//////////////////////////////////////////////////////////////////////////////////////////////////

export interface SearchPageFilterMapping {
    filterHook: DiscreteFilterState;
    columnKey: string; // Key in the static filter spec (e.g., "tagFilter", "statusFilter")
}

export interface SearchPageConfig<TStaticFilter, TFilterSpec> {
    staticFilters: TStaticFilter[];
    defaultStaticFilter: TStaticFilter;
    sortColumnKey: keyof TStaticFilter;
    sortDirectionKey: keyof TStaticFilter;
    filterMappings: SearchPageFilterMapping[];

    // Function to build the complete filter spec from individual filters
    buildFilterSpec: (params: {
        refreshSerial: number;
        quickFilter: string;
        sortColumn: string;
        sortDirection: SortDirection;
        filterMappings: SearchPageFilterMapping[];
    }) => TFilterSpec;

    // Function to build static filter spec for copying
    buildStaticFilterSpec: (params: {
        sortColumn: string;
        sortDirection: SortDirection;
        filterMappings: SearchPageFilterMapping[];
    }) => TStaticFilter;
}

export interface SearchPageState<TStaticFilter, TFilterSpec> {
    // Sort state
    sortColumn: string;
    setSortColumn: (column: string) => void;
    sortDirection: SortDirection;
    setSortDirection: (direction: SortDirection) => void;
    sortModel: { columnName: string; direction: SortDirection };
    setSortModel: (model: { columnName: string; direction: SortDirection }) => void;

    // Filter state aggregation
    filterSpec: TFilterSpec;
    hasAnyFilters: boolean;
    hasExtraFilters: boolean;
    matchingStaticFilter: TStaticFilter | undefined;

    // Static filter management
    handleClickStaticFilter: (staticFilter: TStaticFilter) => void;
    handleCopyFilterspec: () => void;
    resetToDefaults: () => void;

    // Quick filter
    quickFilter: string;
    setQuickFilter: (filter: string) => void;

    // Refresh
    refreshSerial: number;
    setRefreshSerial: React.Dispatch<React.SetStateAction<number>>;
}

/**
 * Hook that consolidates common search page patterns:
 * - Sort state management
 * - Static filter matching and handling
 * - Filter spec building
 * - Copy functionality
 * - Reset functionality
 */
export function useSearchPage<TStaticFilter extends Record<string, any>, TFilterSpec>(
    config: SearchPageConfig<TStaticFilter, TFilterSpec>
): SearchPageState<TStaticFilter, TFilterSpec> {
    const snackbarContext = React.useContext(SnackbarContext);

    // Basic state
    const [refreshSerial, setRefreshSerial] = React.useState<number>(0);
    const [quickFilter, setQuickFilter] = useURLState<string>("qf", "");

    // Sort state
    const [sortColumn, setSortColumn] = useURLState<string>(
        "sc",
        config.defaultStaticFilter[config.sortColumnKey] as string
    );
    const [sortDirection, setSortDirection] = useURLState<SortDirection>(
        "sd",
        config.defaultStaticFilter[config.sortDirectionKey] as SortDirection
    );

    const sortModel = {
        columnName: sortColumn,
        direction: sortDirection,
    };

    const setSortModel = (model: { columnName: string; direction: SortDirection }) => {
        setSortColumn(model.columnName);
        setSortDirection(model.direction);
    };

    // Build the filter spec
    const filterSpec = config.buildFilterSpec({
        refreshSerial,
        quickFilter,
        sortColumn,
        sortDirection,
        filterMappings: config.filterMappings,
    });

    // Static filter matching
    const matchesStaticFilter = (staticFilter: TStaticFilter): boolean => {
        if (sortColumn !== staticFilter[config.sortColumnKey]) return false;
        if (sortDirection !== staticFilter[config.sortDirectionKey]) return false;

        // Check each filter mapping
        for (const mapping of config.filterMappings) {
            const enabledKey = `${mapping.columnKey}Enabled` as keyof TStaticFilter;
            const behaviorKey = `${mapping.columnKey}Behavior` as keyof TStaticFilter;
            const optionsKey = `${mapping.columnKey}Options` as keyof TStaticFilter;

            if (staticFilter[enabledKey] !== mapping.filterHook.enabled) return false;

            if (mapping.filterHook.enabled) {
                if (mapping.filterHook.criterion.behavior !== staticFilter[behaviorKey]) return false;
                const staticOptions = staticFilter[optionsKey] as number[];
                const currentOptions = mapping.filterHook.criterion.options as number[];
                if (!arraysContainSameValues(currentOptions, staticOptions)) return false;
            }
        }

        return true;
    };

    const matchingStaticFilter = config.staticFilters.find(matchesStaticFilter);

    // Filter state checks
    const hasExtraFilters = (): boolean => {
        if (!!matchingStaticFilter) return false;
        return config.filterMappings.some(mapping => mapping.filterHook.enabled);
    };

    const hasAnyFilters = hasExtraFilters();

    // Handlers
    const handleClickStaticFilter = (staticFilter: TStaticFilter) => {
        setSortColumn(staticFilter[config.sortColumnKey] as string);
        setSortDirection(staticFilter[config.sortDirectionKey] as SortDirection);

        // Apply each filter mapping
        config.filterMappings.forEach(mapping => {
            const enabledKey = `${mapping.columnKey}Enabled` as keyof TStaticFilter;
            const behaviorKey = `${mapping.columnKey}Behavior` as keyof TStaticFilter;
            const optionsKey = `${mapping.columnKey}Options` as keyof TStaticFilter;

            mapping.filterHook.setEnabled(staticFilter[enabledKey] as boolean);
            mapping.filterHook.setBehavior(staticFilter[behaviorKey] as DiscreteCriterionFilterType);
            mapping.filterHook.setOptions(staticFilter[optionsKey] as number[]);
        });
    };

    const handleCopyFilterspec = () => {
        const staticFilterSpec = config.buildStaticFilterSpec({
            sortColumn,
            sortDirection,
            filterMappings: config.filterMappings,
        });

        const txt = JSON.stringify(staticFilterSpec, null, 2);
        console.log(staticFilterSpec);
        navigator.clipboard.writeText(txt).then(() => {
            snackbarContext.showMessage({
                severity: "success",
                children: `copied ${txt.length} chars`
            });
        }).catch(() => {
            // nop
        });
    };

    const resetToDefaults = () => {
        handleClickStaticFilter(config.defaultStaticFilter);
    };

    return {
        sortColumn,
        setSortColumn,
        sortDirection,
        setSortDirection,
        sortModel,
        setSortModel,
        filterSpec,
        hasAnyFilters,
        hasExtraFilters: hasExtraFilters(),
        matchingStaticFilter,
        handleClickStaticFilter,
        handleCopyFilterspec,
        resetToDefaults,
        quickFilter,
        setQuickFilter,
        refreshSerial,
        setRefreshSerial,
    };
}
