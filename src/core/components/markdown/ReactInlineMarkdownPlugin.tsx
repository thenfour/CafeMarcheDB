import MarkdownIt from 'markdown-it';

// Intercepts inline text tokens and looks for patterns like {{componentName:props}}.
// Replaces these with <span data-component="..." data-props="..." data-inline="true">, so that later on, those placeholders can be transformed into React components.
// Calls onComponentAdd() whenever a match is found, so the system knows how many embedded components it needs to render.

// export function ReactInlineMarkdownPlugin(md: MarkdownIt, onComponentAdd: () => void) {
//     const defaultRender = md.renderer.rules.text || ((tokens, idx, options, env, self) => {
//         return self.renderToken(tokens, idx, options);
//     });

//     md.renderer.rules.text = (tokens, idx, options, env, self) => {
//         const token = tokens[idx];
//         const text = token.content as string;
//         // {{word:props}} or {{word}}
//         let newText = text.replace(/\{\{(\w+)(:.*?)?\}\}/g, (match, componentName, propsString = '') => {
//             if (propsString && propsString.length > 1) {
//                 propsString = propsString.slice(1).replaceAll("\\}", "}"); // chop off the colon and allow escaping } with \}
//             }

//             const span = document.createElement('span');
//             span.setAttribute("data-component", componentName);
//             span.setAttribute("data-props", propsString);
//             span.setAttribute("data-inline", "true");
//             onComponentAdd();
//             return span.outerHTML;
//         });

//         // Call default renderer for any remaining text
//         return newText === text ? defaultRender(tokens, idx, options, env, self) : newText;
//     };
// }
export function ReactInlineMarkdownPlugin(md: MarkdownIt, onComponentAdd: () => void) {
    const originalTextRule = md.renderer.rules.text ||
        ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

    md.renderer.rules.text = (tokens, idx, options, env, self) => {
        let output = originalTextRule(tokens, idx, options, env, self);

        // Then apply the `{{ ... }}` replacements
        output = output.replace(/\{\{(\w+)(:.*?)?\}\}/g, (match, componentName, propsString = '') => {
            if (propsString && propsString.length > 1) {
                propsString = propsString.slice(1).replaceAll("\\}", "}");
            }
            const span = document.createElement('span');
            span.setAttribute("data-component", componentName);
            span.setAttribute("data-props", propsString);
            span.setAttribute("data-inline", "true");
            onComponentAdd && onComponentAdd();
            return span.outerHTML;
        });
        return output;
    };
}