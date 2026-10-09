

import type MarkdownIt from "markdown-it";
import type { DB3QueryContextInput } from "../../db3/components/useDB3Context";
import { withMemberPresentation } from "../user/bandMemberLinks";

export function ImageDimensionsMarkdownPlugin(md: MarkdownIt, presentation: DB3QueryContextInput = {}) {
    const defaultRender = md.renderer.rules.image || function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
    };

    md.renderer.rules.image = function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        const srcIndex = token.attrIndex('src');

        if (srcIndex >= 0) {
            const srcAttr = token.attrs[srcIndex][1];

            // Match the dimension query in the format "?<number>" at the end of the URL
            const dimensionMatch = srcAttr.match(/^(.*?)(\?\d+)$/);

            if (dimensionMatch && dimensionMatch.length > 2) {
                const url = dimensionMatch[1]; // The actual URL without the dimension part
                const dimension = dimensionMatch[2].substring(1); // Remove the '?' to get the dimension

                // Update the src attribute to the clean URL without the dimension query
                token.attrs[srcIndex][1] = url;

                // Apply the dimension as a style for both max-width and max-height
                token.attrPush(['style', `max-width: ${dimension}px; max-height: ${dimension}px;`]);
            }
        }

        // lsmb todo: use a real routing mechanism, not ad-hoc parsing
        const source = token.attrGet("src");
        if (source?.startsWith("/api/files/download/")) {
            token.attrSet("src", withMemberPresentation(source, presentation));
        }
        return defaultRender(tokens, idx, options, env, self);
    };
};

