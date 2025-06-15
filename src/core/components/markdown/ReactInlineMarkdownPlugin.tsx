import { getHashedColor } from '@/shared/utils';
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
            if (componentName === "hashhighlight") {
                // Hash the text and map to a color using getHashedColor
                const text = propsString;
                const color = getHashedColor(text, { saturation: "90%", luminosity: "80%", alpha: "100%" });
                const style = `background: ${color};`;
                return `<span class="markdown-class-highlight markdown-class-hashhighlight" style="${style}">${text}</span>`;
            }
            if (componentName.startsWith("highlight")) {
                // For highlight components, we can use a specific class
                const span = document.createElement('span');
                span.className = `markdown-class-highlight markdown-class-${componentName}`;
                span.innerText = propsString;
                return span.outerHTML;
            }
            const span = document.createElement('span');
            span.className = `markdown-class-${componentName}`;
            span.innerText = propsString;
            return span.outerHTML;
        });
        return output;
    };
}