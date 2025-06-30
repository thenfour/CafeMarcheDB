import MarkdownIt from 'markdown-it';
import { getAbsoluteUrl } from '../../db3/clientAPILL';

// block only
export function AbcNotationMarkdownPlugin(md: MarkdownIt) {
    const defaultCodeBlockRender = md.renderer.rules.fence ||
        ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

    md.renderer.rules.fence = function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        const info = token.info ? token.info.trim() : '';

        // Check if this is an ABC notation code block
        if (info === 'abc' && token.content) {
            // Encode the ABC content for URL
            const encodedAbc = encodeURIComponent(token.content.trim());

            // Generate the image tag pointing to our ABC rendering API
            return `<img src="${getAbsoluteUrl(`/api/abc/render`)}?notation=${encodedAbc}" alt="ABC Notation" class="abc-notation-rendered" />`;
        }

        // For all other code blocks, use the default renderer
        return defaultCodeBlockRender(tokens, idx, options, env, self);
    };
}
