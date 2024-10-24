// avoiding circular dependencies by breaking this up a bit.
// this will be LOWER level than CMCoreComponents.
import { useSession } from "@blitzjs/auth";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, CircularProgress, CircularProgressProps, Typography } from "@mui/material";
import React, { Suspense } from "react";

import { useRouter } from "next/router";
import { CalcRelativeTiming, DateTimeRange } from "shared/time";
import { CoalesceBool, IsNullOrWhitespace, arraysContainSameValues, isValidDate, lerp } from "shared/utils";
import { UrlObject } from "url";
import { gCharMap, gIconMap } from "../db3/components/IconMap";
import * as db3 from "../db3/db3";





type PreProps = {
    text: string;
    className?: string;
    style?: React.CSSProperties;
    wrap?: boolean;
    //maxHeight?: string;
};

export const Pre: React.FC<PreProps> = ({ text, className, style, wrap = true }) => {
    const preStyle = {
        whiteSpace: wrap ? 'pre-wrap' : 'pre',
        //overflowY: maxHeight ? 'auto' : undefined,
        //maxHeight,
        ...style,
    };

    return (
        <pre className={className} style={preStyle}>{text}</pre>
    );
};





interface AnimatedCircularProgressProps {
    value: number;
    duration?: number; // Duration of the animation in milliseconds
    size?: string | number | undefined;
}

export const AnimatedCircularProgress: React.FC<AnimatedCircularProgressProps> = ({ value, duration = 1000, size }) => {
    const [progress, setProgress] = React.useState(0);

    React.useEffect(() => {
        let start: number;
        let animationFrameId: number;

        const startValue = progress;
        const delta = value - startValue;

        const animateProgress = (timestamp: number) => {
            if (!start) start = timestamp;
            const elapsed = timestamp - start;
            const t = Math.min(elapsed / duration, 1); // Ensure t is between 0 and 1

            const newProgress = lerp(startValue, value, t);
            setProgress(newProgress);

            if (t < 1) {
                animationFrameId = requestAnimationFrame(animateProgress);
            }
        };

        animationFrameId = requestAnimationFrame(animateProgress);

        return () => cancelAnimationFrame(animationFrameId);
    }, [value, duration]);

    return <CircularProgress variant="determinate" size={size} value={progress} className="CMAnimatedCircularProgress" />;
};




//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// local versions of clientAPI fns
export function useIsShowingAdminControls() {
    const sess = useSession(); // use existing session. don't call useAuthenticatedSession which will throw if you're not authenticated. we want the ability to just return "no" without killing the user's request
    return sess.isSysAdmin && sess.showAdminControls;
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

type Url = string | UrlObject;

const formatUrl = (url: UrlObject): string => {
    const { pathname = '', query = {}, hash = '' } = url;
    const searchParams = new URLSearchParams(query as Record<string, string>).toString();
    return `${pathname}${searchParams ? `?${searchParams}` : ''}${hash ? `#${hash}` : ''}`;
};

export const simulateLinkClick = (url: Url, as?: Url, options?: any) => {
    let href: string;

    if (typeof url === 'string') {
        href = url;
    } else {
        href = formatUrl(url);
    }

    if (as) {
        if (typeof as === 'string') {
            href = as;
        } else {
            href = formatUrl(as);
        }
    }

    const link = document.createElement('a');
    link.href = href;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const DebugCollapsibleText = ({ text, caption, obj }: { text?: string, caption?: string, obj?: any }) => {
    const [open, setOpen] = React.useState<boolean>(false);
    return <div>
        <Button onClick={() => setOpen(!open)}>{caption || "expand>"}</Button>
        {open && (text !== undefined) && <pre>{text}</pre>}
        {open && (obj !== undefined) && <pre>{JSON.stringify(obj, undefined, 2)}</pre>}
    </div>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const DebugCollapsibleAdminText = ({ text, caption, obj }: { text?: string, caption?: string, obj?: any }) => {
    const adminShowing = useIsShowingAdminControls();
    const [open, setOpen] = React.useState<boolean>(false);
    return <>{adminShowing && <div>
        <Button onClick={() => setOpen(!open)}>{caption || "expand>"}</Button>
        {open && (text !== undefined) && <pre>{text}</pre>}
        {open && (obj !== undefined) && <pre>{JSON.stringify(obj, undefined, 2)}</pre>}
    </div>}</>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface CMSmallButtonProps {
    onClick?: (e: React.MouseEvent<HTMLElement>) => void;
    variant?: "framed" | "default";
    className?: string;
    style?: React.CSSProperties;
};

export const CMSmallButton = (props: React.PropsWithChildren<CMSmallButtonProps>) => {
    return <div style={props.style} className={`variant_${props.variant || "default"} interactable freeButton CMSmallButton ${props.className}`} onClick={(e) => { props.onClick && props.onClick(e) }}>
        {props.children}
    </div>;
};

// replacement for <DialogContentText> that doesn't emit a <p>; thus allowing <div> children.
export const CMDialogContentText = (props: React.PropsWithChildren<{}>) => {
    return <div className="CMDialogContentText">{props.children}</div>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface NameValuePairPropsBase {
    name: React.ReactNode;
    description?: React.ReactNode;
    value: React.ReactNode;
    isReadOnly?: boolean;
    className?: string;
};

// Variant where validationResult is not provided, fieldName is optional
interface NameValuePairPropsWithoutValidation extends NameValuePairPropsBase {
    validationResult?: undefined;
    fieldName?: string; // Optional because validationResult is not provided
};
interface NameValuePairPropsWithValidation extends NameValuePairPropsBase {
    validationResult: db3.ValidateAndComputeDiffResult;
    fieldName: string; // Required because validationResult is provided
};

type NameValuePairProps = NameValuePairPropsWithoutValidation | NameValuePairPropsWithValidation;

export const NameValuePair = (props: NameValuePairProps) => {
    const validationError = props.validationResult?.getErrorForField(props.fieldName) || null;

    return <div className={`BasicNameValuePairContainer ${props.className} ${props.isReadOnly ? "readOnly" : "editable"} ${(props.validationResult && !!validationError) ? "validationError" : "validationSuccess"}`}>
        {!IsNullOrWhitespace(props.name) && <div className="name">{props.name}</div>}
        {props.description && <div className="description">{props.description}</div>}
        <div className="value">{props.value}</div>
        {(props.validationResult && !!validationError) && <div className="validationResult">{validationError}</div>}
    </div>;
}

type KeyValueDisplayValueType = string | null | undefined | number | Date | boolean | React.ReactNode;
type KeyValueDisplayProps = {
    data: Record<string, KeyValueDisplayValueType>;
    className?: string;
};

export const KeyValueDisplay: React.FC<KeyValueDisplayProps> = ({ data, className }) => {
    // Function to calculate the maximum key length for alignment
    const getMaxKeyLength = (data: Record<string, KeyValueDisplayValueType>): number => {
        return Math.max(...Object.keys(data).map(key => key.length));
    };

    // Render the key-value pairs with alignment
    const renderKeyValuePairs = (data: Record<string, KeyValueDisplayValueType>): JSX.Element[] => {
        const maxKeyLength = getMaxKeyLength(data);
        return Object.entries(data).map(([key, value], index) => {
            let displayValue: React.ReactNode;
            if (value === null || value === undefined) {
                displayValue = value === null ? "<null>" : "";
            } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                displayValue = value.toString();
            } else if (value instanceof Date) {
                displayValue = value.toISOString();
            } else if (React.isValidElement(value)) {
                displayValue = value; // Directly use the React node
            } else {
                displayValue = "unknown datatype";
            }
            return <div key={index} style={{ whiteSpace: 'pre' }}>
                {`${key}:`.padEnd(maxKeyLength + 2, ' ')}{displayValue}
            </div>
        });
    };
    return (
        <pre className={className}>
            {renderKeyValuePairs(data)}
        </pre>
    );
};

////////////////////////////////////////////////////////////////
// table instead of <pre>

export const KeyValueTable: React.FC<KeyValueDisplayProps> = ({ data, className }) => {
    // Render the key-value pairs in table rows
    const renderKeyValueRows = (data: Record<string, KeyValueDisplayValueType>): JSX.Element[] => {
        return Object.entries(data).map(([key, value], index) => {
            let displayValue: React.ReactNode;
            if (value === null || value === undefined) {
                displayValue = value === null ? "<null>" : "";
            } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                displayValue = value.toString();
            } else if (value instanceof Date) {
                displayValue = value.toISOString();
            } else if (React.isValidElement(value)) {
                displayValue = value; // Directly use the React node
            } else {
                displayValue = "unknown datatype";
            }
            return (
                <tr key={index}>
                    <td>{key}</td>
                    <td>{displayValue}</td>
                </tr>
            );
        });
    };

    return (
        <table className={className}>
            <tbody>
                {renderKeyValueRows(data)}
            </tbody>
        </table>
    );
};

////////////////////////////////////////////////////////////////
export function CircularProgressWithLabel(props: CircularProgressProps & { value: number, size?: number }) {
    //props.size = props.size || 70;
    //props.thickness = props.thickness || 7;
    return (
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <CircularProgress variant="determinate" {...props} style={{ color: "#0a0" }} size={props.size} thickness={7} />
            <Box
                sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Typography
                    variant="caption"
                    component="div"
                    color="text.secondary"
                >{`${Math.round(props.value)}%`}</Typography>
            </Box>
        </Box>
    );
}




////////////////////////////////////////////////////////////////
interface EventDateFieldProps {
    dateRange: DateTimeRange;
    className?: string;
};

export const EventDateField = (props: React.PropsWithChildren<EventDateFieldProps>) => {
    const relativeTiming = CalcRelativeTiming(new Date(), props.dateRange);

    return <div className={`${props.className} ${relativeTiming.bucket} EventDateField container`}>
        {gIconMap.CalendarMonth()}
        <span className={`DatePart`}>{props.dateRange.toString()}</span>
        <span className={`RelativeIndicator`}>{relativeTiming.label}</span>
        {props.children}
    </div>;
};

////////////////////////////////////////////////////////////////

type Serializable = string | number | boolean | null | undefined | Serializable[] | { [key: string]: Serializable };
//type Serializable = any; // we're using JSON.stringify so we could justify using the same argument type if ever needed.

export function useURLState<T extends Serializable>(
    key: string,
    initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
    const router = useRouter();
    const [state, setState] = React.useState<T>(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const value = params.get(key);
            return value !== null ? JSON.parse(value) as T : initialValue;
        }
        return initialValue;
    });

    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);

            let isEqual = (state === initialValue);
            if (Array.isArray(state) && Array.isArray(initialValue)) {
                isEqual = arraysContainSameValues(state, initialValue);
            }

            if (isEqual) {
                params.delete(key);
            } else {
                params.set(key, JSON.stringify(state));
            }
            const href = `${window.location.pathname}?${params}`;
            if (href !== router.asPath) {
                void router.replace(href, undefined, { shallow: true });
            }
        }
    }, [router, key, state, initialValue]);

    return [state, setState];
}


interface CMAccordionProps {
    thisTabId: number;
    selectedTabId: number;
    handleTabChange: (e: React.SyntheticEvent, newTabId: number) => void;

    summaryIcon: React.ReactNode;
    summaryTitle: React.ReactNode;
    summarySubtitle?: React.ReactNode;
};

export const CMAccordion = (props: React.PropsWithChildren<CMAccordionProps>) => {
    return <Accordion
        TransitionProps={{
            timeout: 100
        }}
        disableGutters
        elevation={1}
        onChange={(e, expanded) => props.handleTabChange(e, expanded ? props.thisTabId : -1)}
        expanded={props.selectedTabId === props.thisTabId}>
        <AccordionSummary expandIcon={gIconMap.ExpandMore()}>
            <div className='EventAccordionSummaryTitle'>
                {props.summaryIcon}
                <div className='title'>{props.summaryTitle}</div>
                {props.summarySubtitle && <div className='subtitle'>{props.summarySubtitle}</div>}
            </div>
        </AccordionSummary>
        <AccordionDetails>
            {props.children}
        </AccordionDetails>
    </Accordion>
};



interface CMTabProps {
    thisTabId: string | number | undefined | null;
    summaryIcon?: React.ReactNode;
    summaryTitle?: React.ReactNode;
    summarySubtitle?: React.ReactNode;
};

export const CMTab = (props: React.PropsWithChildren<CMTabProps>) => {
    return <Suspense>{props.children}</Suspense>;
};

const CMTabHeader = (props: CMTabProps & {
    selected: boolean,
    onClick: (e: React.MouseEvent<HTMLLIElement>) => void
}) => {
    return <li
        key={props.thisTabId}
        onClick={props.onClick}
        className={`CMTabHeaderRoot ${props.selected ? "selected" : "notselected"}`}
    >
        <div className="CMTabHeaderL2">
            {(props.summaryIcon !== undefined) && <div className="CMTabHeaderIcon">{props.summaryIcon}</div>}
            {(props.summaryTitle !== undefined) && <div className="CMTabHeaderTitle">{props.summaryTitle}</div>}
            {(props.summarySubtitle !== undefined) && <div className="CMTabHeaderSubtitle">{props.summarySubtitle}</div>}
        </div>
    </li>
};

interface CMTabPanelProps {
    selectedTabId: string | number | undefined | null;
    handleTabChange: (e: React.SyntheticEvent, newTabId: string | number | undefined | null) => void;
    className?: string | undefined;
    style?: React.CSSProperties | undefined;
    children: React.ReactElement<React.PropsWithChildren<CMTabProps>>[];
};

export const CMTabPanel = (props: CMTabPanelProps) => {
    const handleTabHeaderClick = (ch: React.ReactElement<React.PropsWithChildren<CMTabProps>>, e: React.MouseEvent<HTMLLIElement>) => {
        props.handleTabChange(e, ch.props.thisTabId);
    };
    const selectedChild = props.children.find(tab => tab.props.thisTabId === props.selectedTabId);
    return <div className={`CMTabPanel ${props.className}`} style={props.style}>
        <div className="CMTabHeader">
            <ul className="CMTabList">
                {
                    props.children.map(tab => <CMTabHeader key={tab.props.thisTabId} {...tab.props} onClick={e => handleTabHeaderClick(tab, e)} selected={props.selectedTabId === tab.props.thisTabId} />)
                }
            </ul>
        </div>
        {selectedChild &&
            <div className="CMTabExpanded">
                {selectedChild}
            </div>}
    </div>;
};

/////////////////////////////////////////////////////////////////////////
interface CMTableColumnSpec<T extends Object> {
    memberName?: keyof T;
    allowSort?: boolean;
    header?: React.ReactNode;
    render?: (args: { row: T }) => React.ReactNode;
    getRowStyle?: (args: { row: T }) => React.CSSProperties | undefined;
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
    style?: React.CSSProperties | undefined;
    columns: CMTableColumnSpec<T>[];
}

const CMTableRow = <T extends Object,>({ row, columns, ...props }: CMTableRowProps<T>) => {
    return (
        <tr style={props.style}>
            {columns.map((column, idx) => {
                const content = column.render
                    ? column.render({ row })
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
    }, [rows, sortColumn, sortDirection]);

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
                    return <CMTableRow<T> key={idx} row={row} columns={columns} style={style} />;
                })}
            </tbody>
            {props.footerRow &&
                <tfoot>
                    <CMTableRow<T> row={props.footerRow} columns={columns} />
                </tfoot>}
        </table>
    );
};

