import { DashboardContextDataBase } from "../../components/dashboardContext/dashboardContextTypes";

export type QrCodeErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

/**
 * QR Code content type definitions
 */
export interface QrWifiConfig {
    ssid: string;
    password?: string;
    security?: 'WPA' | 'WEP' | 'nopass';
    hidden?: boolean;
}

export interface QrContactConfig {
    firstName?: string;
    lastName?: string;
    organization?: string;
    title?: string;
    phone?: string;
    email?: string;
    url?: string;
    address?: string;
    note?: string;
}

export interface QrSmsConfig {
    phoneNumber: string;
    message?: string;
}

export interface QrEmailConfig {
    to: string;
    subject?: string;
    body?: string;
}

export interface QrLocationConfig {
    latitude: number;
    longitude: number;
    altitude?: number;
}

export type QrContentConfig =
    | { contentType: 'text'; text: string }
    | { contentType: 'url'; text: string }
    | { contentType: 'wifi'; config: QrWifiConfig }
    | { contentType: 'contact'; config: QrContactConfig }
    | { contentType: 'sms'; config: QrSmsConfig }
    | { contentType: 'email'; config: QrEmailConfig }
    | { contentType: 'location'; config: QrLocationConfig };

/**
 * Options for QR code generation
 */
export interface QrCodeOptions {
    /** The content configuration for the QR code */
    content: QrContentConfig;
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
export function generateQrApiUrl(options: QrCodeOptions, dashboardContext: DashboardContextDataBase): string {
    const {
        type = 'svg',
        errorCorrectionLevel = 'M',
        margin,// = 4,
        color,// = '#000000',
        backgroundColor,// = '#ffffff', actually i think these don't get encoded properly....
        width
    } = options;

    const t = {
        type,
        errorCorrectionLevel,
        margin: margin?.toString(),
        color,
        backgroundColor,
    } satisfies Record<string, string | undefined>;

    // remove undefined values
    const objectWithValidValues = Object.fromEntries(Object.entries(t).filter(([_, v]) => v !== undefined)) as Record<string, string>;

    const params = new URLSearchParams(objectWithValidValues);

    const content = options.content;
    params.append('contentType', content.contentType);

    switch (content.contentType) {
        case 'text':
        case 'url':
            params.append('text', content.text);
            break;
        case 'wifi':
            params.append('ssid', content.config.ssid);
            if (content.config.password) params.append('password', content.config.password);
            if (content.config.security) params.append('security', content.config.security);
            if (content.config.hidden) params.append('hidden', 'true');
            break;
        case 'contact':
            Object.entries(content.config).forEach(([key, value]) => {
                if (value) params.append(key, value);
            });
            break;
        case 'sms':
            params.append('phoneNumber', content.config.phoneNumber);
            if (content.config.message) params.append('message', content.config.message);
            break;
        case 'email':
            params.append('to', content.config.to);
            if (content.config.subject) params.append('subject', content.config.subject);
            if (content.config.body) params.append('body', content.config.body);
            break;
        case 'location':
            params.append('latitude', content.config.latitude.toString());
            params.append('longitude', content.config.longitude.toString());
            if (content.config.altitude) params.append('altitude', content.config.altitude.toString());
            break;
    }

    if (width !== undefined) {
        params.append('width', width.toString());
    }

    // Build URL manually to avoid double-encoding query parameters
    const baseUrl = dashboardContext.getAbsoluteUri('/api/qr');
    return `${baseUrl}?${params.toString()}`;
}

/**
 * Helper functions to create QR code content configurations
 */
export const QrHelpers = {
    text: (text: string): QrContentConfig => ({ contentType: 'text', text }),
    url: (url: string): QrContentConfig => ({ contentType: 'url', text: url }),
    wifi: (config: QrWifiConfig): QrContentConfig => ({ contentType: 'wifi', config }),
    contact: (config: QrContactConfig): QrContentConfig => ({ contentType: 'contact', config }),
    sms: (config: QrSmsConfig): QrContentConfig => ({ contentType: 'sms', config }),
    email: (config: QrEmailConfig): QrContentConfig => ({ contentType: 'email', config }),
    location: (config: QrLocationConfig): QrContentConfig => ({ contentType: 'location', config }),
};
