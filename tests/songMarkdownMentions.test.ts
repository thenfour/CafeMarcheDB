import { parsePublicId } from "shared/publicId";
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
    it("retains band and locale on authored wiki links", () => {
        const bandPublicId = parsePublicId<"Band">("FixtureBand00001");
        const markdown = new MarkdownIt().use(CMDBLinkMarkdownPlugin, { bandPublicId, routeLocale: "fr-BE" });
        const html = markdown.render("[[handbook|Handbook]]");
        expect(html).toContain(`/backstage/wiki/handbook?bandPublicId=${bandPublicId}&routeLocale=fr-BE`);
        expect(html).toContain(">Handbook</a>");
    });

    it("renders a shared person public identity in selected-band context instead of as a Wiki slug", () => {
        const person = parsePublicId<"User">("PickerPerson0001");
        const bandPublicId = parsePublicId<"Band">("FixtureBand00001");
        const markdown = new MarkdownIt().use(CMDBLinkMarkdownPlugin, { bandPublicId, routeLocale: "nl-BE" });
        const html = markdown.render(`[[user:${person}|Authored person caption]]`);
        expect(html).toContain(`/backstage/user/${person}?bandPublicId=${bandPublicId}&routeLocale=nl-BE`);
        expect(html).toContain(">Authored person caption</a>");
        expect(html).not.toContain("/backstage/wiki/user:");
        expect(` [[user:${person}|Caption]] `).toMatch(new RegExp(MarkdownMentionRegexWithSurroundingWhitespace.source));
    });

});
