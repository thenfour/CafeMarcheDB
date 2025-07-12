import React, { useState } from 'react';
import { Button, DialogContent, DialogTitle, ListItemIcon, MenuItem } from '@mui/material';
import { DialogActionsCM, DotMenu } from './CMCoreComponents2';
import { ReactiveInputDialog } from './ReactiveInputDialog';
import { CMSinglePageSurfaceCard } from './CMCoreComponents';
import { MenuLinkItem } from './MenuLinkComponents';
import { gIconMap } from '../db3/components/IconMap';

export type QrCodeErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

/**
 * Options for QR code generation
 */
export interface QrCodeOptions {
    /** The text content to encode in the QR code */
    text: string;
    /** Output format - "svg" or "png" */
    type?: 'svg' | 'png';
    /** Error correction level - L (Low), M (Medium), Q (Quartile), H (High) */
    errorCorrectionLevel?: QrCodeErrorCorrectionLevel;
    /** White space margin around the QR code in modules */
    margin?: number;
    /** Foreground color in hex format */
    color?: string;
    /** Background color in hex format */
    backgroundColor?: string;
    /** Width of the generated QR code in pixels */
    width?: number;
}

/**
 * Generates a URL for the QR code API with properly encoded parameters
 * @param options - QR code generation options
 * @returns The complete API URL with query parameters
 */
export function generateQrApiUrl(options: QrCodeOptions): string {
    const {
        text,
        type = 'svg',
        errorCorrectionLevel = 'M',
        margin = 4,
        color = '#000000',
        backgroundColor = '#ffffff',
        width
    } = options;

    if (!text) {
        throw new Error('Text is required for QR code generation');
    }

    const params = new URLSearchParams({
        text,
        type,
        errorCorrectionLevel,
        margin: margin.toString(),
        color,
        backgroundColor,
    });

    if (width !== undefined) {
        params.append('width', width.toString());
    }

    return `/api/qr?${params.toString()}`;
}

interface QrCodeProps extends Omit<QrCodeOptions, 'type'> {
    size?: number;
    className?: string;
    style?: React.CSSProperties;
}

export const QrCode: React.FC<QrCodeProps> = ({
    text,
    size,
    className = '',
    style = {},
    errorCorrectionLevel = 'M',
    margin = 4,
    color = '#000000',
    backgroundColor = '#ffffff',
    width
}) => {
    const apiUrl = generateQrApiUrl({
        text,
        errorCorrectionLevel,
        margin,
        color,
        backgroundColor,
        width
    });

    return (
        <img
            src={apiUrl}
            alt={`QR Code for: ${text}`}
            className={`qr-code ${className}`}
            style={{
                width: size,
                height: size,
                ...style
            }}
        />
    );
};


// this component will render a button (could be a button, menuitem, ...) which
// when clicked, opens a modal which displays the QR code clearly and prominently.
interface QrCodeButtonProps extends Omit<QrCodeOptions, 'type'> {
    buttonText?: string;
    buttonClassName?: string;
    buttonStyle?: React.CSSProperties;

    // QR code options
    qrSize?: number;

    // Modal options
    title?: string;
    description?: React.ReactNode;

    // Render props pattern for custom button
    renderButton?: (props: { onClick: () => void }) => React.ReactNode;
}

export const QrCodeButton = (props: QrCodeButtonProps) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);

    const handleOpen = () => {
        setIsOpen(true);
    };

    const handleClose = () => {
        setIsOpen(false);
    };

    const renderButton = () => {
        if (props.renderButton) {
            return props.renderButton({ onClick: handleOpen });
        }

        return (
            <Button
                onClick={handleOpen}
                className={props.buttonClassName}
                style={props.buttonStyle}
            >
                {props.buttonText || 'Show QR Code'}
            </Button>
        );
    };

    return (
        <>
            {renderButton()}

            {isOpen && (
                <ReactiveInputDialog onCancel={handleClose}>
                    <DialogTitle>
                        {props.title || 'QR Code'}
                    </DialogTitle>
                    <DialogContent dividers>
                        {props.description && (
                            <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                                {props.description}
                            </div>
                        )}

                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: '16px'
                        }}>
                            <QrCode
                                text={props.text}
                                size={props.qrSize || 300}
                                errorCorrectionLevel={props.errorCorrectionLevel}
                                margin={props.margin}
                                color={props.color}
                                backgroundColor={props.backgroundColor}
                                width={props.width}
                            />
                        </div>

                        <div style={{
                            marginTop: '16px',
                            textAlign: 'center',
                            wordBreak: 'break-all',
                            fontSize: '12px',
                            color: '#666',
                            maxHeight: '100px',
                            overflow: 'auto'
                        }}>
                            {props.text}
                        </div>

                        <DialogActionsCM>
                            <Button onClick={handleClose}>Close</Button>
                        </DialogActionsCM>
                    </DialogContent>
                </ReactiveInputDialog>
            )}
        </>
    );
};

export const QrTester = () => {
    const [closeMenuProc, setCloseMenuProc] = useState<() => void>(() => () => { });
    return (
        <CMSinglePageSurfaceCard>
            <h2>QR Code Tester</h2>
            <p>Use the QR Code Button component to test QR code generation.</p>
            <QrCodeButton
                text="https://example.com"
                buttonText="Show Example QR Code"
                qrSize={256}
                title="Example QR Code"
                description="This is a sample QR code for https://example.com"
            />

            {/* now render as a list / list item */}

            <DotMenu setCloseMenuProc={(newProc) => setCloseMenuProc(() => newProc)}>
                <MenuItem onClick={async () => { closeMenuProc(); }}>
                    <ListItemIcon>{gIconMap.ContentCopy()}</ListItemIcon>
                    menu item example 1
                </MenuItem>

                <QrCodeButton
                    text="https://example.com"
                    buttonText="Show Example QR Code"
                    qrSize={256}
                    title="Example QR Code"
                    description="This is a sample QR code for https://example.com"
                    renderButton={({ onClick }) => (
                        <MenuItem onClick={() => { onClick(); closeMenuProc(); }}>
                            <ListItemIcon>{gIconMap.ContentCopy()}</ListItemIcon>
                            qr menu item
                        </MenuItem>
                    )}
                />

                <MenuItem onClick={async () => { closeMenuProc(); }}>
                    <ListItemIcon>{gIconMap.ContentCopy()}</ListItemIcon>
                    menu item example 2
                </MenuItem>

            </DotMenu>
        </CMSinglePageSurfaceCard>
    );
};