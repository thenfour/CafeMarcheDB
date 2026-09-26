import MarkdownIt from "markdown-it";
import { describe, expect, it } from "vitest";
import {
    CMDBLinkMarkdownPlugin,
    MarkdownMentionRegexWithSurroundingWhitespace,
} from "src/core/components/markdown/CMDBLinkMarkdownPlugin";
import { eventPublicId } from "./support/eventResponseFixtures";
import { songPublicId } from "./support/songFixtures";

describe("public-ID markdown mentions", () => {
    it("renders Song and Event links and recognizes a Song mention for editing", () => {
        const song = songPublicId(7);
        const event = eventPublicId(8);
        const markdown = new MarkdownIt().use(CMDBLinkMarkdownPlugin);
        const html = markdown.render(`[[song:${song}|A song]] and [[event:${event}|A concert]]`);

        expect(html).toContain(`/backstage/song/${song}`);
        expect(html).toContain(`/backstage/event/${event}`);
        expect(" before [[song:" + song + "|A song]] after ")
            .toMatch(MarkdownMentionRegexWithSurroundingWhitespace);
    });
});
