import { NextApiRequest, NextApiResponse } from "next";
import { JSDOM } from 'jsdom';
// @ts-ignore - abcjs may not have perfect types
import * as abcjs from 'abcjs';

// Custom ABC to SVG renderer using abcjs and jsdom
function renderAbcToSvg(abcNotation: string, options: any = {}): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            // Create a virtual DOM environment
            const dom = new JSDOM(`
                <!DOCTYPE html>
                <html>
                <body>
                    <div id="abc-target"></div>
                </body>
                </html>
            `, {
                pretendToBeVisual: true,
                resources: "usable"
            });

            // Set up global window and document for abcjs
            global.window = dom.window as any;
            global.document = dom.window.document as any;
            global.navigator = dom.window.navigator as any;

            const targetElement = dom.window.document.getElementById('abc-target');

            if (!targetElement) {
                reject(new Error('Failed to create target element'));
                return;
            }

            // Configure abcjs rendering options
            const renderOptions = {
                responsive: "resize",
                staffwidth: options.width || 740,
                scale: options.scale || 1.0,
                paddingtop: 15,
                paddingbottom: 15,
                paddingleft: 15,
                paddingright: 15,
                add_classes: true,
                ...options
            };

            // Render ABC notation
            const visualObj = abcjs.renderAbc(targetElement, abcNotation, renderOptions);            // Wait a bit for rendering to complete
            setTimeout(() => {
                try {
                    // Extract SVG content
                    const svgElements = targetElement.querySelectorAll('svg');

                    if (svgElements.length === 0) {
                        reject(new Error('No SVG generated from ABC notation'));
                        return;
                    }

                    // Get the first SVG element
                    const svgElement = svgElements[0];
                    if (!svgElement) {
                        reject(new Error('SVG element is undefined'));
                        return;
                    }

                    // Get the raw SVG content
                    let svgContent = svgElement.outerHTML;

                    // Ensure the SVG has proper attributes for standalone rendering
                    if (!svgContent.includes('xmlns=')) {
                        svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
                    }

                    // Ensure SVG has explicit width and height for img tag compatibility
                    const svgEl = svgElement as SVGSVGElement;
                    const viewBox = svgEl.getAttribute('viewBox');
                    const width = svgEl.getAttribute('width') || (options.width ? `${options.width}px` : '740px');
                    const height = svgEl.getAttribute('height') || '200px';

                    // If no width/height but has viewBox, extract dimensions
                    if ((!svgEl.getAttribute('width') || !svgEl.getAttribute('height')) && viewBox) {
                        const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number);
                        if (vbWidth && vbHeight) {
                            const scale = options.scale || 1.0;
                            const scaledWidth = Math.round(vbWidth * scale);
                            const scaledHeight = Math.round(vbHeight * scale);

                            svgContent = svgContent.replace(
                                /<svg([^>]*)>/,
                                `<svg$1 width="${scaledWidth}" height="${scaledHeight}">`
                            );
                        }
                    }

                    // Ensure we have width and height attributes
                    if (!svgContent.includes('width=')) {
                        svgContent = svgContent.replace('<svg', `<svg width="${width}"`);
                    }
                    if (!svgContent.includes('height=')) {
                        svgContent = svgContent.replace('<svg', `<svg height="${height}"`);
                    }

                    // Clean up globals
                    delete (global as any).window;
                    delete (global as any).document;
                    delete (global as any).navigator;

                    resolve(svgContent);
                } catch (extractError) {
                    reject(extractError);
                }
            }, 100); // Small delay to ensure rendering completes

        } catch (error) {
            reject(error);
        }
    });
}

// API endpoint for rendering ABC music notation to SVG
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
        res.setHeader("Allow", ["GET"]);
        return res.status(405).end("Method Not Allowed");
    } try {
        // Use our custom ABC to SVG renderer
        const renderSvg = renderAbcToSvg;

        // Extract and validate query parameters
        const { notation, width, scale } = req.query;

        if (!notation || typeof notation !== "string") {
            return res.status(400).json({
                error: "Missing or invalid 'notation' parameter. Please provide ABC notation as a query string."
            });
        }

        // Decode URL-encoded notation
        const decodedNotation = decodeURIComponent(notation);

        // Validate that the notation is not empty
        if (!decodedNotation.trim()) {
            return res.status(400).json({
                error: "Empty notation provided. Please provide valid ABC notation."
            });
        }

        // Parse optional parameters
        const renderWidth = width && typeof width === "string" ? parseInt(width, 10) : undefined;
        const renderScale = scale && typeof scale === "string" ? parseFloat(scale) : undefined;

        // Validate numeric parameters
        if (renderWidth !== undefined && (isNaN(renderWidth) || renderWidth <= 0)) {
            return res.status(400).json({
                error: "Invalid 'width' parameter. Must be a positive number."
            });
        }

        if (renderScale !== undefined && (isNaN(renderScale) || renderScale <= 0)) {
            return res.status(400).json({
                error: "Invalid 'scale' parameter. Must be a positive number."
            });
        }

        // Configure rendering options
        const options: any = {};
        if (renderWidth) {
            options.width = renderWidth;
        }
        if (renderScale) {
            options.scale = renderScale;
        }

        // Render ABC notation to SVG
        let svgContent: string;
        try {
            svgContent = await renderSvg(decodedNotation, options);
        } catch (renderError: any) {
            console.error("ABC rendering error:", renderError);
            return res.status(422).json({
                error: "Failed to render ABC notation. Please check your notation syntax.",
                details: renderError.message || "Unknown rendering error"
            });
        }

        // Validate that we got SVG content
        if (!svgContent || typeof svgContent !== "string") {
            return res.status(500).json({
                error: "Failed to generate SVG content."
            });
        }

        // Ensure the content is valid SVG
        if (!svgContent.trim().startsWith("<svg") && !svgContent.trim().startsWith("<?xml")) {
            return res.status(500).json({
                error: "Generated content is not valid SVG."
            });
        }        // Set appropriate headers for SVG response
        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross-origin requests

        // Debug: log the SVG content (first 200 chars)
        // console.log("Generated SVG preview:", svgContent.substring(0, 200) + "...");

        // Return the SVG content
        return res.status(200).send(svgContent);

    } catch (error: any) {
        console.error("ABC rendering error:", error);
        return res.status(500).json({
            error: "Internal server error while rendering ABC notation.",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
}