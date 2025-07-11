import React from "react";

import { CoalesceBool, isValidDate } from "shared/utils";
import { gCharMap } from "../db3/components/IconMap";

/////////////////////////////////////////////////////////////////////////
export enum CMTableSlot {
    Header,
    Body,
    Footer,
}
interface CMTableColumnSpec<T extends Object> {
    memberName?: keyof T; // for now, this is required in order to sort, because our "current sort column" depends on it.
    allowSort?: boolean;
    header?: React.ReactNode;
    render?: (args: { row: T, slot: CMTableSlot, defaultRenderer: (val: any) => React.ReactNode, rowIndex: number, columnIndex: number }) => React.ReactNode;
    getRowStyle?: (args: { row: T }) => React.CSSProperties | undefined;
    /**
     * Optional custom comparison function for this column. Receives (a, b, direction).
     * Should return -1, 0, or 1 as in Array.sort.
     */
    compareFn?: (a: T, b: T, direction: 'asc' | 'desc') => number;
}

interface CMTableProps<T extends Object> {
    rows: T[];
    footerRow?: T;
    className?: string | undefined;
    getRowStyle?: (args: { row: T }) => React.CSSProperties | undefined;
    columns: CMTableColumnSpec<T>[];
}

function CMTableValueDefaultRenderer(value: any): React.ReactNode {
    if (value === null) return <span className="faded">null</span>;
    if (value === undefined) return <span className="faded">none</span>;
    if (isValidDate(value)) {
        return (value as Date).toISOString();
    }
    switch (typeof value) {
        case "number":
            return value.toLocaleString();
        case "string":
            return value;
        default:
            return String(value);
    }
}

interface CMTableRowProps<T extends Object> {
    row: T;
    slot: CMTableSlot;
    style?: React.CSSProperties | undefined;
    columns: CMTableColumnSpec<T>[];
    index?: number;
}

const CMTableRow = <T extends Object,>({ row, slot, columns, ...props }: CMTableRowProps<T>) => {
    return (
        <tr style={props.style}>
            {columns.map((column, idx) => {
                const content = column.render
                    ? column.render({ row, slot, defaultRenderer: CMTableValueDefaultRenderer, rowIndex: props.index || 0, columnIndex: idx })
                    : (column.memberName ? CMTableValueDefaultRenderer(row[column.memberName]) : "");

                const style = column.getRowStyle ? column.getRowStyle({ row }) : undefined;

                return <td key={idx} style={style}>{content}</td>;
            })}
        </tr>
    );
};

export const CMTable = <T extends Object,>({ rows, columns, ...props }: CMTableProps<T>) => {
    const [sortColumn, setSortColumn] = React.useState<keyof T | null>(null);
    const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

    const sortedRows = React.useMemo(() => {
        if (!sortColumn) return rows;
        const colSpec = columns.find(c => c.memberName === sortColumn);
        if (colSpec && colSpec.compareFn) {
            return [...rows].sort((a, b) => colSpec.compareFn!(a, b, sortDirection));
        }
        return [...rows].sort((a, b) => {
            const aValue = a[sortColumn];
            const bValue = b[sortColumn];

            if (aValue == null && bValue != null) return sortDirection === 'asc' ? -1 : 1;
            if (aValue != null && bValue == null) return sortDirection === 'asc' ? 1 : -1;
            if (aValue == null && bValue == null) return 0;

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [rows, sortColumn, sortDirection, columns]);

    const handleHeaderClick = (column: CMTableColumnSpec<T>) => {
        if (!CoalesceBool(column.allowSort, true)) return;

        if (sortColumn === column.memberName) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortColumn(column.memberName || null);
            setSortDirection('asc');
        }
    };

    return (
        <table className={props.className}>
            <thead>
                <tr>
                    {columns.map((column, idx) => (
                        <th
                            key={idx}
                            onClick={() => handleHeaderClick(column)}
                            style={{ cursor: CoalesceBool(column.allowSort, true) ? 'pointer' : 'default' }}
                            className={`${CoalesceBool(column.allowSort, true) ? 'interactable' : ''}`}
                        >
                            {column.header ?? String(column.memberName)}
                            {CoalesceBool(column.allowSort, true) && sortColumn === column.memberName && (
                                <span>{sortDirection === 'asc' ? gCharMap.UpArrow() : gCharMap.DownArrow()}</span>
                            )}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {sortedRows.map((row, idx) => {
                    const style = props.getRowStyle ? props.getRowStyle({ row }) : undefined;
                    return <CMTableRow<T> slot={CMTableSlot.Body} key={idx} row={row} columns={columns} style={style} index={idx} />;
                })}
            </tbody>
            {props.footerRow &&
                <tfoot>
                    <CMTableRow<T> slot={CMTableSlot.Footer} row={props.footerRow} columns={columns} />
                </tfoot>}
        </table>
    );
};
