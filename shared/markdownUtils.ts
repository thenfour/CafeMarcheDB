import { convert } from 'html-to-text';
import MarkdownIt from 'markdown-it';



// Function to convert Markdown to plain text
export const markdownToPlainText = (markdownText: string): string => {
    const md = new MarkdownIt();
    const htmlText = md.render(markdownText);

    // Convert HTML to plain text
    const plainText = convert(htmlText, {
        wordwrap: null
    });

    return plainText;
};
