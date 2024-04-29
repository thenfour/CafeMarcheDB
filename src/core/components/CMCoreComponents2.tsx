// avoiding circular dependencies by breaking this up a bit.
// this will be LOWER level than CMCoreComponents.
import { useSession } from "@blitzjs/auth";
import { Box, Button, CircularProgress, CircularProgressProps, Typography } from "@mui/material";
import React from "react";

import { IsNullOrWhitespace } from "shared/utils";
import * as db3 from "../db3/db3";

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// local versions of clientAPI fns
export function useIsShowingAdminControls() {
    const sess = useSession(); // use existing session. don't call useAuthenticatedSession which will throw if you're not authenticated. we want the ability to just return "no" without killing the user's request
    return sess.isSysAdmin && sess.showAdminControls;
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
    onClick?: () => void;
    variant?: "framed" | "default";
};

export const CMSmallButton = (props: React.PropsWithChildren<CMSmallButtonProps>) => {
    return <div className={`variant_${props.variant || "default"} interactable freeButton CMSmallButton`} onClick={() => { props.onClick && props.onClick() }}>
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
type KeyValueDisplayValueType = string | null | undefined | number;
type KeyValueDisplayProps = {
    data: Record<string, KeyValueDisplayValueType>;
};

export const KeyValueDisplay: React.FC<KeyValueDisplayProps> = ({ data }) => {
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
            } else {
                valueStr = "unknown datatype";
            }
            return <div key={index}>
                {key.padEnd(maxKeyLength, ' ')} : {valueStr}
            </div>
        });
    };

    return (
        <pre>
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
