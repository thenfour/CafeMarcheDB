import { slugify } from "shared/rootroot";


// export function CMDBLinkMarkdownPlugin(md) {
//     const defaultRender = md.renderer.rules.html_inline || function (tokens, idx, options, env, self) {
//         return self.renderToken(tokens, idx, options);
//     };

//     md.renderer.rules.text = function (tokens, idx, options, env, self) {
//         const token = tokens[idx];
//         // Updated regex to capture both old and new link types
//         const linkRegex = /\[\[(event|song):(\d+)\|?(.*?)\]\]/g;

//         if (token.content.match(linkRegex)) {
//             token.content = token.content.replace(linkRegex, (match, type, id, caption) => {
//                 if (id && type === 'event') {
//                     caption = caption || `Event ${id}`; // Default caption if none provided
//                     return `<a href="/backstage/event/${id}" class="wikiCMLink wikiEventLink">📅 ${caption}</a>`;
//                 }
//                 if (id && type === 'song') {
//                     caption = caption || `Song ${id}`; // Default caption if none provided
//                     return `<a href="/backstage/song/${id}" class="wikiCMLink wikiSongLink">🎵 ${caption}</a>`;
//                 }
//             });
//         }

//         const wikiRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

//         if (token.content.match(wikiRegex)) {
//             token.content = token.content.replace(wikiRegex, (match, slug, caption) => {
//                 if (slug) {
//                     caption = caption || slug;
//                     return `<a href="/backstage/wiki/${slugify(slug)}" class="wikiCMLink wikiWikiLink">${caption}</a>`;
//                 }
//             });
//         }

//         return defaultRender(tokens, idx, options, env, self);
//     };
// }

export function CMDBLinkMarkdownPlugin(md) {
    // Save the current text renderer (which might be the default, or from another plugin)
    const originalTextRule = md.renderer.rules.text ||
        function (tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };

    md.renderer.rules.text = function (tokens, idx, options, env, self) {
        // 1) First do the original render (which might do the React inline stuff)
        let output = originalTextRule(tokens, idx, options, env, self);

        // 2) Then run the wiki link replacements on whatever text was returned
        output = output.replace(/\[\[(event|song):(\d+)\|?(.*?)\]\]/g, (match, type, id, caption) => {
            if (type === 'event') {
                caption = caption || `Event ${id}`;
                return `<a href="/backstage/event/${id}" class="wikiCMLink wikiEventLink">📅 ${caption}</a>`;
            } else if (type === 'song') {
                caption = caption || `Song ${id}`;
                return `<a href="/backstage/song/${id}" class="wikiCMLink wikiSongLink">🎵 ${caption}</a>`;
            }
            return match;
        });

        output = output.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, slug, caption) => {
            if (slug) {
                caption = caption || slug;
                return `<a href="/backstage/wiki/${slug}" class="wikiCMLink wikiWikiLink">${caption}</a>`;
            }
            return match;
        });

        return output;
    };
}