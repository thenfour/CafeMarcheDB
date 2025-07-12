// pages/api/qr.ts
/**
 * QR Code Generation API
 * 
 * Generates QR codes in SVG or PNG format with customizable options.
 * Supports various content types: text, url, wifi, contact, sms, email, location
 * 
 * Query Parameters:
 * - contentType (optional): Type of content - "text" (default), "url", "wifi", "contact", "sms", "email", "location"
 * - text (required for text/url): The text content to encode
 * - type (optional): Output format - "svg" (default) or "png"
 * - errorCorrectionLevel (optional): Error correction level - "L", "M" (default), "Q", "H"
 * - margin (optional): White space margin around the QR code in modules (default: 4)
 * - color (optional): Foreground color in hex format (default: "#000000")
 * - backgroundColor (optional): Background color in hex format (default: "#ffffff")  
 * - width (optional): Width of the generated QR code in pixels (PNG only)
 * 
 * WiFi Parameters (contentType=wifi):
 * - ssid (required): WiFi network name
 * - password (optional): WiFi password
 * - security (optional): Security type - "WPA" (default), "WEP", "nopass"
 * - hidden (optional): Whether network is hidden - "true" or "false" (default)
 * 
 * Contact Parameters (contentType=contact):
 * - firstName, lastName, organization, title, phone, email, url, address, note (all optional)
 * 
 * SMS Parameters (contentType=sms):
 * - phoneNumber (required): Phone number
 * - message (optional): SMS message text
 * 
 * Email Parameters (contentType=email):
 * - to (required): Email address
 * - subject, body (optional): Email subject and body
 * 
 * Location Parameters (contentType=location):
 * - latitude, longitude (required): Geographic coordinates
 * - altitude (optional): Altitude in meters
 * 
 * Examples:
 * - /api/qr?text=Hello%20World
 * - /api/qr?contentType=wifi&ssid=MyWiFi&password=secret&security=WPA
 * - /api/qr?contentType=contact&firstName=John&lastName=Doe&phone=555-1234&email=john@example.com
 * - /api/qr?contentType=sms&phoneNumber=555-1234&message=Hello
 * - /api/qr?contentType=email&to=test@example.com&subject=Hello&body=Test%20message
 * - /api/qr?contentType=location&latitude=37.7749&longitude=-122.4194
 */
import { NextApiRequest, NextApiResponse } from "next";
import QRCode from "qrcode";

function generateQrContent(req: NextApiRequest): string {
    const { contentType = 'text', text } = req.query;

    switch (contentType) {
        case 'text':
        case 'url':
            if (typeof text !== 'string' || !text) {
                throw new Error('Missing or invalid "text" parameter');
            }
            return text;

        case 'wifi': {
            const { ssid, password = '', security = 'WPA', hidden = 'false' } = req.query;
            if (typeof ssid !== 'string' || !ssid) {
                throw new Error('Missing or invalid "ssid" parameter for WiFi QR code');
            }
            const escapedSsid = ssid.replace(/[\\";,]/g, '\\$&');
            const escapedPassword = (password as string).replace(/[\\";,]/g, '\\$&');
            return `WIFI:T:${security};S:${escapedSsid};P:${escapedPassword};H:${hidden === 'true'};;`;
        }

        case 'contact': {
            const { firstName, lastName, organization, title, phone, email, url, address, note } = req.query;
            const lines = ['BEGIN:VCARD', 'VERSION:3.0'];

            if (firstName || lastName) {
                const fullName = [firstName, lastName].filter(Boolean).join(' ');
                lines.push(`FN:${fullName}`);
                lines.push(`N:${lastName || ''};${firstName || ''};;;`);
            }

            if (organization) lines.push(`ORG:${organization}`);
            if (title) lines.push(`TITLE:${title}`);
            if (phone) lines.push(`TEL:${phone}`);
            if (email) lines.push(`EMAIL:${email}`);
            if (url) lines.push(`URL:${url}`);
            if (address) lines.push(`ADR:;;${address};;;;`);
            if (note) lines.push(`NOTE:${note}`);

            lines.push('END:VCARD');
            return lines.join('\n');
        }

        case 'sms': {
            const { phoneNumber, message = '' } = req.query;
            if (typeof phoneNumber !== 'string' || !phoneNumber) {
                throw new Error('Missing or invalid "phoneNumber" parameter for SMS QR code');
            }
            return `SMS:${phoneNumber}:${message}`;
        }

        case 'email': {
            const { to, subject = '', body = '' } = req.query;
            if (typeof to !== 'string' || !to) {
                throw new Error('Missing or invalid "to" parameter for email QR code');
            }
            const params = new URLSearchParams();
            if (subject) params.append('subject', subject as string);
            if (body) params.append('body', body as string);

            const queryString = params.toString();
            return `mailto:${to}${queryString ? `?${queryString}` : ''}`;
        }

        case 'location': {
            const { latitude, longitude, altitude } = req.query;
            if (typeof latitude !== 'string' || typeof longitude !== 'string' ||
                !latitude || !longitude) {
                throw new Error('Missing or invalid "latitude" and "longitude" parameters for location QR code');
            }
            const lat = parseFloat(latitude);
            const lng = parseFloat(longitude);
            if (isNaN(lat) || isNaN(lng)) {
                throw new Error('Invalid latitude or longitude values');
            }
            return `geo:${lat},${lng}${altitude ? `,${altitude}` : ''}`;
        }

        default:
            throw new Error(`Unsupported content type: ${contentType}`);
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const {
        type = "svg",
        errorCorrectionLevel = "M",
        margin = 4,
        color = "#000000",
        backgroundColor = "#ffffff",
        width
    } = req.query;

    try {
        // Generate the QR code content based on the content type
        const qrContent = generateQrContent(req);

        // Validate parameters
        if (typeof type !== "string" || !["svg", "png"].includes(type)) {
            res.status(400).send("Invalid type. Use 'svg' or 'png'.");
            return;
        }

        if (typeof errorCorrectionLevel !== "string" || !["L", "M", "Q", "H"].includes(errorCorrectionLevel)) {
            res.status(400).send("Invalid error correction level. Use 'L', 'M', 'Q', or 'H'.");
            return;
        }

        const options: QRCode.QRCodeToStringOptions | QRCode.QRCodeToBufferOptions = {
            type: type as "svg" | "png",
            errorCorrectionLevel: errorCorrectionLevel as "L" | "M" | "Q" | "H",
            margin: parseInt(margin as string, 10) || 4,
            color: {
                dark: color as string,
                light: backgroundColor as string,
            },
        };

        if (width && !isNaN(parseInt(width as string, 10))) {
            (options as any).width = parseInt(width as string, 10);
        }

        if (type === "svg") {
            const svg = await QRCode.toString(qrContent, options as QRCode.QRCodeToStringOptions);
            res.setHeader("Content-Type", "image/svg+xml");
            res.send(svg);
        } else if (type === "png") {
            const buffer = await QRCode.toBuffer(qrContent, options as QRCode.QRCodeToBufferOptions);
            res.setHeader("Content-Type", "image/png");
            res.send(buffer);
        }
    } catch (err) {
        console.error("QR code generation error:", err);
        const errorMessage = err instanceof Error ? err.message : "QR code generation failed";
        res.status(400).send(errorMessage);
    }
}