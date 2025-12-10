import { Button, DialogContent, DialogTitle, ListItemIcon, MenuItem } from '@mui/material';
import React, { useState } from 'react';
import { gIconMap } from '../db3/components/IconMap';
import { generateQrApiUrl, QrCodeErrorCorrectionLevel, QrContentConfig, QrHelpers } from '../db3/shared/qrApi';
import { CMSinglePageSurfaceCard } from './CMCoreComponents';
import { DialogActionsCM, DotMenu } from './CMCoreComponents2';
import { ReactiveInputDialog } from './ReactiveInputDialog';
import { ActivityFeature } from './featureReports/activityTracking';
import { useClientTelemetryEvent } from './dashboardContext/DashboardContext';

interface QrCodeProps {
    content: QrContentConfig;

    size?: number;
    className?: string;
    style?: React.CSSProperties;
    errorCorrectionLevel?: QrCodeErrorCorrectionLevel;
    margin?: number;
    color?: string;
    backgroundColor?: string;
    width?: number;
}

export const QrCode: React.FC<QrCodeProps> = ({
    content,
    //text,
    size,
    className = '',
    style = {},
    errorCorrectionLevel = 'M',
    margin = 4,
    color = '#000000',
    backgroundColor = '#ffffff',
    width
}) => {
    const options = { content, errorCorrectionLevel, margin, color, backgroundColor, width };
    const apiUrl = generateQrApiUrl(options);

    // Generate display text for alt attribute
    const displayText = (content.contentType === 'text' || content.contentType === 'url' ? content.text : `${content.contentType} QR code`);

    return (
        <img
            src={apiUrl}
            alt={`QR Code for: ${displayText}`}
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
interface QrCodeButtonProps {
    // New content-based props
    content: QrContentConfig;

    buttonText?: string;
    buttonClassName?: string;
    buttonStyle?: React.CSSProperties;

    // QR code options
    qrSize?: number;
    errorCorrectionLevel?: QrCodeErrorCorrectionLevel;
    margin?: number;
    color?: string;
    backgroundColor?: string;
    width?: number;

    // Modal options
    title?: string;
    description?: React.ReactNode;

    // Render props pattern for custom button
    renderButton?: (props: { onClick: () => void }) => React.ReactNode;
}

export const QrCodeButton = (props: QrCodeButtonProps) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const recordFeatureUse = useClientTelemetryEvent();

    const handleOpen = () => {
        void recordFeatureUse({
            feature: ActivityFeature.qr_code_generate,
            context: "QrCodeButton",
        });
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

    // Generate display text for modal
    const displayText = (props.content.contentType === 'text' || props.content.contentType === 'url' ? props.content.text : `${props.content.contentType} QR code`);

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
                                content={props.content}
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
                            {displayText}
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
            <p>Test various QR code content types:</p>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {/* Legacy text format */}
                <QrCodeButton
                    content={QrHelpers.text('https://example.com')}
                    buttonText="Text/URL (Legacy)"
                    qrSize={256}
                    title="Simple Text QR Code"
                    description="Using the legacy text format"
                />

                {/* WiFi QR Code */}
                <QrCodeButton
                    content={QrHelpers.wifi({
                        ssid: 'MyWiFi',
                        password: 'password123',
                        security: 'WPA'
                    })}
                    buttonText="WiFi QR"
                    qrSize={256}
                    title="WiFi Network QR Code"
                    description="Scan to connect to WiFi network"
                />

                {/* Contact QR Code */}
                <QrCodeButton
                    content={QrHelpers.contact({
                        firstName: 'John',
                        lastName: 'Doe',
                        phone: '555-1234',
                        email: 'john.doe@example.com',
                        organization: 'Example Corp'
                    })}
                    buttonText="Contact QR"
                    qrSize={256}
                    title="Contact Information"
                    description="Scan to add contact"
                />

                {/* SMS QR Code */}
                <QrCodeButton
                    content={QrHelpers.sms({
                        phoneNumber: '555-1234',
                        message: 'Hello from QR code!'
                    })}
                    buttonText="SMS QR"
                    qrSize={256}
                    title="SMS QR Code"
                    description="Scan to send SMS"
                />

                {/* Email QR Code */}
                <QrCodeButton
                    content={QrHelpers.email({
                        to: 'test@example.com',
                        subject: 'Hello from QR',
                        body: 'This email was generated from a QR code!'
                    })}
                    buttonText="Email QR"
                    qrSize={256}
                    title="Email QR Code"
                    description="Scan to send email"
                />

                {/* Location QR Code */}
                <QrCodeButton
                    content={QrHelpers.location({
                        latitude: 37.7749,
                        longitude: -122.4194
                    })}
                    buttonText="Location QR"
                    qrSize={256}
                    title="Location QR Code"
                    description="Scan to view location (San Francisco)"
                />
            </div>

            <h3>Menu Integration Example</h3>
            <DotMenu setCloseMenuProc={(newProc) => setCloseMenuProc(() => newProc)}>
                <MenuItem onClick={async () => { closeMenuProc(); }}>
                    <ListItemIcon>{gIconMap.ContentCopy()}</ListItemIcon>
                    Regular menu item
                </MenuItem>

                <QrCodeButton
                    content={QrHelpers.wifi({
                        ssid: 'CafeWiFi',
                        password: 'freewifi123',
                        security: 'WPA'
                    })}
                    buttonText="WiFi QR Code"
                    qrSize={256}
                    title="Cafe WiFi"
                    description="Scan to connect to our WiFi"
                    renderButton={({ onClick }) => (
                        <MenuItem onClick={() => { onClick(); closeMenuProc(); }}>
                            <ListItemIcon>{gIconMap.Share()}</ListItemIcon>
                            Share WiFi QR
                        </MenuItem>
                    )}
                />

                <MenuItem onClick={async () => { closeMenuProc(); }}>
                    <ListItemIcon>{gIconMap.ContentCopy()}</ListItemIcon>
                    Another menu item
                </MenuItem>
            </DotMenu>
        </CMSinglePageSurfaceCard>
    );
};