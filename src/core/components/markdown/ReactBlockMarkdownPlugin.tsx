import MarkdownIt from 'markdown-it';
import { markdownReactPlugins } from './MarkdownReactPlugins';


// export function ReactBlockMarkdownPlugin(md: MarkdownIt, onComponentAdd: () => void) {
//     function render(tag: string, content: string) {
//         const div = document.createElement("div");
//         div.setAttribute("data-component", tag);
//         div.setAttribute("data-props", content.trim());
//         onComponentAdd();
//         return div.outerHTML;
//     }

//     // Block ABCjs rule
//     md.core.ruler.after('block', 'abc', function (state) {
//         state.tokens.forEach(token => {
//             if (token.type !== 'fence') return;
//             // token.info is the little tag. like ```tag
//             if (!markdownReactPlugins.some(p => p.componentName === token.info)) return;
//             //if (token.info !== 'abc') return; 

//             token.type = 'html_block';
//             token.content = render(token.info, token.content);
//             token.tag = '';
//             token.nesting = 0;
//             token.attrs = null;
//             token.map = null;
//             token.children = null;
//         });
//     });
// }



export function ReactBlockMarkdownPlugin(md: MarkdownIt, onComponentAdd: () => void) {
    // Store the original fence renderer, or use a default
    const originalFenceRule = md.renderer.rules.fence ||
        function (tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };

    // Override the fence rule
    md.renderer.rules.fence = function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        // info is the language specifier after the backticks ```abc
        const info = (token.info || '').trim();

        // If this code fence matches one of our custom component names...
        const plugin = markdownReactPlugins.find(p => p.componentName === info);
        if (plugin) {
            // Instead of returning a <pre><code> block, return a <div> placeholder
            const div = document.createElement('div');
            div.setAttribute('data-component', info);
            // Pass the raw code block content as "data-props"
            div.setAttribute('data-props', token.content.trim());
            onComponentAdd();
            return div.outerHTML;
        }

        // Otherwise, let the original fence rule do its normal job
        return originalFenceRule(tokens, idx, options, env, self);
    };
}

