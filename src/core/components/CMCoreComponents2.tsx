// avoiding circular dependencies by breaking this up a bit.
// this will be LOWER level than CMCoreComponents.
import { useSession } from "@blitzjs/auth";
import { Box, Button, CircularProgress, CircularProgressProps, Typography } from "@mui/material";
import React from "react";

import { useRouter } from "next/router";
import { CalcRelativeTiming, DateTimeRange } from "shared/time";
import { IsNullOrWhitespace, arraysContainSameValues, lerp } from "shared/utils";
import * as db3 from "../db3/db3";
import { gIconMap } from "../db3/components/IconMap";
import { RouteUrlObject } from "blitz";
import { UrlObject } from "url";





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
};

export const CMSmallButton = (props: React.PropsWithChildren<CMSmallButtonProps>) => {
    return <div className={`variant_${props.variant || "default"} interactable freeButton CMSmallButton ${props.className}`} onClick={(e) => { props.onClick && props.onClick(e) }}>
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

// Define TypeScript type for the props
type KeyValueDisplayValueType = string | null | undefined | number | Date | boolean;
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
            let valueStr = "";
            if (value === null) valueStr = "<null>";
            else if (value === undefined) {
                return <React.Fragment key={index} />;
            }
            else if (typeof value === 'string') {
                valueStr = value;
            } else if (typeof value === 'number') {
                valueStr = value.toString();
            } else if (typeof value === 'boolean') {
                valueStr = value.toString();
            } else if (value.toISOString) {
                valueStr = value.toISOString();
            } else {
                valueStr = "unknown datatype";
            }
            return <div key={index}>
                {key.padEnd(maxKeyLength, ' ')} : {valueStr}
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
