// avoiding circular dependencies by breaking this up a bit.
// this will be LOWER level than CMCoreComponents.
import { useSession } from "@blitzjs/auth";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, CircularProgress, CircularProgressProps, SvgIcon, Typography } from "@mui/material";
import React from "react";

import { useRouter } from "next/router";
import { CalcRelativeTiming, DateTimeRange } from "shared/time";
import { CoalesceBool, IsNullOrWhitespace, arraysContainSameValues, isValidDate, lerp } from "shared/utils";
import { UrlObject } from "url";
import { gCharMap, gIconMap } from "../db3/components/IconMap";
import * as db3 from "../db3/db3";

export function GoogleIconSmall() {
    return <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /><path d="M1 1h22v22H1z" fill="none" /></svg>;
}


export function SetlistBreakIcon(props) {
    return (
        <SvgIcon {...props} viewBox="0 0 24 24">
            <path d="M4 20 L20 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </SvgIcon>
    );
}



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


/////////////////////////////////////////////////////////////////////////
export enum CMTableSlot {
    Header,
    Body,
    Footer,
}
interface CMTableColumnSpec<T extends Object> {
    memberName?: keyof T;
    allowSort?: boolean;
    header?: React.ReactNode;
    render?: (args: { row: T, slot: CMTableSlot, defaultRenderer: (val: any) => React.ReactNode }) => React.ReactNode;
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
    slot: CMTableSlot;
    style?: React.CSSProperties | undefined;
    columns: CMTableColumnSpec<T>[];
}

const CMTableRow = <T extends Object,>({ row, slot, columns, ...props }: CMTableRowProps<T>) => {
    return (
        <tr style={props.style}>
            {columns.map((column, idx) => {
                const content = column.render
                    ? column.render({ row, slot, defaultRenderer: CMTableValueDefaultRenderer })
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
                    return <CMTableRow<T> slot={CMTableSlot.Body} key={idx} row={row} columns={columns} style={style} />;
                })}
            </tbody>
            {props.footerRow &&
                <tfoot>
                    <CMTableRow<T> slot={CMTableSlot.Footer} row={props.footerRow} columns={columns} />
                </tfoot>}
        </table>
    );
};



interface CMTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    autoHeight?: boolean | undefined;
    autoFocus?: boolean | undefined;
};

export const CMTextarea: React.FC<CMTextareaProps> = ({ autoHeight = true, autoFocus = false, ...props }) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea && autoHeight) {
            // Reset height to allow shrinking
            textarea.style.height = 'auto';
            const newHeight = textarea.scrollHeight + 3; // at least on chrome we need a bit of margin to get rid of initial scrollbar.
            textarea.style.height = `${newHeight}px`;
        }
        if (textarea && autoFocus) {
            textarea.focus();
        }
    }, [props.value]);

    return <textarea ref={textareaRef} {...props} />;
};
