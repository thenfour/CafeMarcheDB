import MarkdownIt from 'markdown-it';

export function ReactInlineMarkdownPlugin(md: MarkdownIt) {
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

            span.className = `markdown-class-${componentName}`;
            span.innerText = propsString;
            return span.outerHTML;
        });
        return output;
    };
}