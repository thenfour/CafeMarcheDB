import { useURLState } from "src/core/components/CMCoreComponents2";
import { DiscreteCriterion, DiscreteCriterionFilterType } from "src/core/db3/shared/apiTypes";

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
