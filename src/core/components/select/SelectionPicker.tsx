import AddIcon from "@mui/icons-material/Add";
import { Alert, Box, CircularProgress, List, RadioGroup, Typography } from "@mui/material";
import React from "react";
import { CMButton } from "../CMCoreComponents2";
import { SelectionDialog, SelectionSummary } from "./SelectionDialog";
import { SelectionActionRow, SelectionCheckboxRow, SelectionRadioRow, SelectionValue, SelectionValueList } from "./SelectionOptions";
import { SelectionQuery, SelectionSource } from "./selectionSource";

export const SelectionQueryStatus = <T,>({ query }: { query: SelectionQuery<T> }) => <>
    {query.isFetching && <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1, px: 3, py: 2 }}>
        <CircularProgress size={18} /><Typography variant="body2" color="text.secondary">{query.isLoading ? "Loading options..." : "Updating options..."}</Typography>
    </Box>}
    {query.isError && <Alert severity="error" sx={{ m: 2 }} action={<CMButton type="button" onClick={query.refetch}>Retry</CMButton>}>
        Could not load options. Your selection is still here.
    </Alert>}
</>;

export interface SelectionPickerProps<T> {
    source: SelectionSource<T>;
    value: T[];
    multiple?: boolean;
    closeOnSelect?: boolean;
    onAccept: (value: T[]) => void;
    onCancel: () => void;
    title: React.ReactNode;
    description?: React.ReactNode;
    allowQuickFilter?: boolean;
    onOptionsChanged?: () => void;
}

export function SelectionPicker<T>(props: SelectionPickerProps<T>) {
    const [value, setValue] = React.useState(props.value);
    const [filterText, setFilterText] = React.useState("");
    const [creating, setCreating] = React.useState(false);
    const [createError, setCreateError] = React.useState<string | null>(null);
    const pending = React.useRef(false);
    const query = props.source.useOptions(filterText, true);
    const { source } = props;
    const keys = new Set(value.map(source.getKey));
    const initialKeys = new Set(props.value.map(source.getKey));
    const changed = keys.size !== initialKeys.size || value.some(item => !initialKeys.has(source.getKey(item)));
    const immediate = !props.multiple && props.closeOnSelect !== false;

    const select = (item: T) => {
        if (props.multiple) {
            setValue(previous => {
                const key = source.getKey(item);
                if (previous.some(selected => source.getKey(selected) === key)) return previous.filter(selected => source.getKey(selected) !== key);
                const original = props.value.findIndex(selected => source.getKey(selected) === key);
                return [...previous, original >= 0 ? props.value[original]! : item];
            });
        } else {
            setValue([item]);
            if (immediate) props.onAccept([item]);
        }
    };
    const allowCreate = !!query.createOption && !!filterText.trim() && !query.isFetching && !query.isLoading && !query.isError && !query.isPreviousData
        && !query.items.some(item => source.matchesText?.(item, filterText.trim()));
    const create = async () => {
        if (!allowCreate || pending.current) return;
        pending.current = true;
        setCreating(true);
        setCreateError(null);
        let item: T;
        try { item = await query.createOption!(filterText.trim()); }
        catch { setCreateError("Could not create the option. Please try again."); return; }
        finally { pending.current = false; setCreating(false); }
        query.refetch();
        props.onOptionsChanged?.();
        if (props.multiple) setValue(previous => previous.some(selected => source.getKey(selected) === source.getKey(item)) ? previous : [...previous, item]);
        else select(item);
    };
    const list = <List disablePadding aria-label="Available options" aria-busy={query.isFetching}>
        {!query.isError && query.items.map(item => {
            const selected = keys.has(source.getKey(item));
            const rowProps = { label: source.getLabel(item), selected, disabled: creating || !!query.isPreviousData || !!query.isLoading };
            const content = source.renderOption ? source.renderOption(item, selected) : source.renderValue(item);
            return props.multiple ? <SelectionCheckboxRow key={source.getKey(item)} {...rowProps} onToggle={() => select(item)}>{content}</SelectionCheckboxRow>
                : immediate ? <SelectionActionRow key={source.getKey(item)} {...rowProps} onSelect={() => select(item)}>{content}</SelectionActionRow>
                    : <SelectionRadioRow key={source.getKey(item)} {...rowProps} value={String(source.getKey(item))} onSelect={() => select(item)}>{content}</SelectionRadioRow>;
        })}
    </List>;
    return <SelectionDialog
        title={props.title}
        description={props.description || (props.multiple ? "Choose one or more options." : immediate ? "Choose an option to use it." : "Choose one option, then apply your change.")}
        filterText={filterText} onFilterTextChange={setFilterText} allowQuickFilter={props.allowQuickFilter}
        onCancel={props.onCancel} busy={creating}
        onApply={immediate ? undefined : () => props.onAccept(value)}
        applyDisabled={!changed || (!props.multiple && value.length === 0)}
        summary={props.multiple ? <SelectionSummary count={value.length}>
            <SelectionValueList value={value} getKey={source.getKey} getLabel={source.getLabel} renderValue={source.renderValue} disabled={creating}
                onRemove={item => setValue(previous => previous.filter(selected => source.getKey(selected) !== source.getKey(item)))} />
        </SelectionSummary> : <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, minHeight: 44, maxHeight: 112, overflowY: "auto" }}>
            <Typography variant="body2" color="text.secondary">Selected:</Typography>
            <SelectionValue>{value.length ? source.renderValue(value[0]!) : <Typography variant="body2" color="text.secondary">None selected</Typography>}</SelectionValue>
        </Box>}
    >
        <SelectionQueryStatus query={query} />
        {createError && <Alert severity="error" sx={{ m: 2 }}>{createError}</Alert>}
        {allowCreate && <Box sx={{ px: 3, py: 2 }}>
            <CMButton type="button" startIcon={<AddIcon />} onClick={() => { void create(); }} disabled={creating}>{creating ? "Creating..." : `Create '${filterText.trim()}'`}</CMButton>
            <Typography variant="caption" display="block" color="text.secondary">New options are created immediately.</Typography>
        </Box>}
        {!props.multiple && !immediate ? <RadioGroup aria-label="Choose one option" value={value.length ? String(source.getKey(value[0]!)) : ""}>{list}</RadioGroup> : list}
        {!query.isFetching && !query.isLoading && !query.isError && !(query.hasMatches ?? query.items.length > 0) && <Box role="status" sx={{ px: 3, py: 4 }}>
            <Typography color="text.secondary">{filterText.trim() ? "No matching options" : "No options available"}</Typography>
            {filterText.trim() && <Typography variant="body2" color="text.secondary">Try a different search.</Typography>}
        </Box>}
    </SelectionDialog>;
}
