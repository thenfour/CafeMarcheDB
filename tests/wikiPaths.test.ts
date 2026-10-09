import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import {
    getFileUploadContext,
    wikiMakeRelativeURI,
    wikiMakeWikiPathFromEventDescription,
    wikiParseCanonicalWikiPath,
    wikiParsePathComponents,
} from "src/core/wiki/shared/wikiUtils";

describe("wiki path composition", () => {
    it("slugifies a top-level page independently of path structure", () => {
        expect(wikiParsePathComponents(["Safety / Rules"])).toMatchObject({
            namespace: null,
            slugWithoutNamespace: "safety-rules",
            canonicalWikiPath: "safety-rules",
            uriRelativeToHost: "/backstage/wiki/safety-rules",
        });
    });

    it("slugifies namespace and page names separately before joining them", () => {
        const path = wikiParsePathComponents(["Brass / Wind", "Safety / Rules"]);
        expect(path).toMatchObject({
            namespace: "brass-wind",
            slugWithoutNamespace: "safety-rules",
            canonicalWikiPath: "brass-wind/safety-rules",
            uriRelativeToHost: "/backstage/wiki/brass-wind/safety-rules",
        });
        expect(wikiParseCanonicalWikiPath(path.canonicalWikiPath)).toEqual(path);
    });

    it("normalizes namespaced menu destinations without flattening their path", () => {
        expect(wikiMakeRelativeURI("Band Notes/Réhearsal Rules")).toBe("/backstage/wiki/band-notes/rehearsal-rules");
        expect(wikiMakeRelativeURI("Welcome")).toBe("/backstage/wiki/welcome");
    });

    it("keeps aesthetic names in a single trailing segment", () => {
        expect(wikiMakeRelativeURI("band-notes/rehearsal", "Concert / Repetitie 2"))
            .toBe("/backstage/wiki/band-notes/rehearsal/concert-repetitie-2");
        expect(wikiParsePathComponents(["band-notes", "rehearsal", "Concert / Repetitie 2"]).aestheticSlug)
            .toBe("concert-repetitie-2");
    });

    const eventId = parsePublicId<"Event">("AbCdEf0123456_-9");
    it.each(["EventDescription", "eventdescription", "EVENTDESCRIPTION"])("preserves case-sensitive event IDs under %s", namespace => {
        const path = wikiParsePathComponents([namespace, eventId]);
        expect(path).toMatchObject({
            namespace: "EventDescription",
            slugWithoutNamespace: eventId,
            canonicalWikiPath: `EventDescription/${eventId}`,
        });
        expect(wikiMakeRelativeURI(`${namespace}/${eventId}`)).toBe(`/backstage/wiki/EventDescription/${eventId}`);
        expect(wikiParseCanonicalWikiPath(path.canonicalWikiPath)).toEqual(path);
        expect(getFileUploadContext(undefined, path).taggedEventId).toBe(eventId);
    });

    it("keeps event-description identity separate from its slash-containing display name", () => {
        const path = wikiMakeWikiPathFromEventDescription({ publicId: eventId, name: "Concert / Repetitie 2" });
        expect(path.canonicalWikiPath).toBe(`EventDescription/${eventId}`);
        expect(path.aestheticSlug).toBe("concert-repetitie-2");
        expect(path.uriRelativeToHost).toBe(`/backstage/wiki/EventDescription/${eventId}`);
    });
});
