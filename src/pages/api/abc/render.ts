import { NextApiRequest, NextApiResponse } from "next";
import { JSDOM } from 'jsdom';
// @ts-ignore - abcjs may not have perfect types
import * as abcjs from 'abcjs';
import { Stopwatch } from "@/shared/rootroot";

// Function to crop SVG to actual content bounds using coordinate parsing
function cropSvgToContent(svgElement: Element): string {
    try {
        // Get all elements that might contain coordinates
        const contentElements = svgElement.querySelectorAll('path, circle, rect, text, line, g');

        if (contentElements.length === 0) {
            return svgElement.outerHTML;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        // Parse coordinates from various element types
        contentElements.forEach(element => {
            // Handle text elements
            if (element.tagName === 'text') {
                const x = parseFloat(element.getAttribute('x') || '0');
                const y = parseFloat(element.getAttribute('y') || '0');
                if (!isNaN(x) && !isNaN(y)) {
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x + 50); // Estimate text width
                    minY = Math.min(minY, y - 10); // Text baseline adjustment
                    maxY = Math.max(maxY, y + 5);
                }
            }

            // Handle path elements (most musical notation)
            if (element.tagName === 'path') {
                const d = element.getAttribute('d');
                if (d) {
                    // Extract all numbers from path data
                    const coords = d.match(/[-+]?[0-9]*\.?[0-9]+/g); if (coords) {
                        for (let i = 0; i < coords.length - 1; i += 2) {
                            const xStr = coords[i];
                            const yStr = coords[i + 1];
                            if (xStr && yStr) {
                                const x = parseFloat(xStr);
                                const y = parseFloat(yStr);
                                if (!isNaN(x) && !isNaN(y)) {
                                    minX = Math.min(minX, x);
                                    maxX = Math.max(maxX, x);
                                    minY = Math.min(minY, y);
                                    maxY = Math.max(maxY, y);
                                }
                            }
                        }
                    }
                }
            }

            // Handle simple shapes (rect, circle, line)
            const x = parseFloat(element.getAttribute('x') || element.getAttribute('cx') || element.getAttribute('x1') || '0');
            const y = parseFloat(element.getAttribute('y') || element.getAttribute('cy') || element.getAttribute('y1') || '0');
            if (!isNaN(x) && !isNaN(y)) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        });

        // If no valid coordinates found, return original
        if (minX === Infinity || minY === Infinity) {
            return svgElement.outerHTML;
        }

        // Add padding
        const padding = 0;
        const newX = Math.max(0, minX - padding);
        const newY = Math.max(0, minY - padding);
        const newWidth = maxX - minX + (padding * 2);
        const newHeight = maxY - minY + (padding * 2);

        // Update SVG attributes
        svgElement.setAttribute('viewBox', `${newX} ${newY} ${newWidth} ${newHeight}`);
        svgElement.setAttribute('width', newWidth.toString());
        svgElement.setAttribute('height', newHeight.toString());

        return svgElement.outerHTML;
    } catch (error) {
        console.warn('SVG cropping failed, returning original:', error);
        return svgElement.outerHTML;
    }
}

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
                staffwidth: options.width || 540,
                scale: options.scale || 1.0,
                // paddingtop: 15,
                // paddingbottom: 15,
                // paddingleft: 15,
                // paddingright: 15,
                add_classes: true,
                ...options
            };

            // Render ABC notation
            const visualObj = abcjs.renderAbc(targetElement, abcNotation, renderOptions);

            // Poll for SVG completion with early exit and max timeout
            const pollInterval = 20; // Check every
            const maxTimeout = 2000; // Maximum wait time of 2 seconds
            const startTime = Date.now();

            const pollForSvg = () => {
                try {
                    // Check if SVG has been generated
                    const svgElements = targetElement.querySelectorAll('svg');

                    if (svgElements.length > 0) {
                        // SVG found! Process it immediately
                        const svgElement = svgElements[0];
                        if (!svgElement) {
                            reject(new Error('SVG element is undefined'));
                            return;
                        }

                        // Crop SVG to content bounds
                        const croppedSvg = cropSvgToContent(svgElement);

                        // Ensure the SVG has proper attributes for standalone rendering
                        let svgContent = croppedSvg;
                        if (!svgContent.includes('xmlns=')) {
                            svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
                        }

                        // Clean up globals
                        delete (global as any).window;
                        delete (global as any).document;
                        delete (global as any).navigator;

                        resolve(svgContent);
                        return;
                    }

                    // Check if we've exceeded the maximum timeout
                    if (Date.now() - startTime > maxTimeout) {
                        reject(new Error('Timeout: No SVG generated from ABC notation within 2 seconds'));
                        return;
                    }

                    // Continue polling
                    setTimeout(pollForSvg, pollInterval);

                } catch (extractError) {
                    reject(extractError);
                }
            };

            // Start polling
            pollForSvg();

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
        const sw = new Stopwatch();

        // Extract and validate query parameters
        const { notation, width, scale, crop } = req.query;

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
        const cropEnabled = crop !== "false" && crop !== "0"; // Default to true unless explicitly disabled

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
        const options: any = {
            crop: cropEnabled
        };
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
        //console.log(`ABC SVG response time: ${sw.ElapsedMillis} ms`);
        return res.status(200).send(svgContent);

    } catch (error: any) {
        console.error("ABC rendering error:", error);
        return res.status(500).json({
            error: "Internal server error while rendering ABC notation.",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
}