// pages/api/qr.ts
/**
 * QR Code Generation API
 * 
 * Generates QR codes in SVG or PNG format with customizable options.
 * 
 * Query Parameters:
 * - text (required): The text content to encode in the QR code
 * - type (optional): Output format - "svg" (default) or "png"
 * - errorCorrectionLevel (optional): Error correction level - "L" (Low), "M" (Medium, default), "Q" (Quartile), "H" (High)
 * - margin (optional): White space margin around the QR code in modules (default: 4)
 * - color (optional): Foreground color in hex format (default: "#000000")
 * - backgroundColor (optional): Background color in hex format (default: "#ffffff")  
 * - width (optional): Width of the generated QR code in pixels (PNG only)
 * 
 * Examples:
 * - /api/qr?text=Hello%20World
 * - /api/qr?text=https://example.com&type=png&errorCorrectionLevel=H&margin=6
 * - /api/qr?text=Custom%20QR&color=%23ff0000&backgroundColor=%23f0f0f0&width=300
 * 
 * Returns:
 * - SVG: Content-Type: image/svg+xml
 * - PNG: Content-Type: image/png
 */
import { NextApiRequest, NextApiResponse } from "next";
import QRCode from "qrcode";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const {
        text = "",
        type = "svg",
        errorCorrectionLevel = "M",
        margin = 4,
        color = "#000000",
        backgroundColor = "#ffffff",
        width
    } = req.query;

    if (typeof text !== "string" || !text) {
        res.status(400).send("Missing or invalid 'text' query parameter");
        return;
    }

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

    try {
        if (type === "svg") {
            const svg = await QRCode.toString(text, options as QRCode.QRCodeToStringOptions);
            res.setHeader("Content-Type", "image/svg+xml");
            res.send(svg);
        } else if (type === "png") {
            const buffer = await QRCode.toBuffer(text, options as QRCode.QRCodeToBufferOptions);
            res.setHeader("Content-Type", "image/png");
            res.send(buffer);
        }
    } catch (err) {
        console.error("QR code generation error:", err);
        res.status(500).send("QR code generation failed");
    }
}