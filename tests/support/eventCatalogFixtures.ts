import type { EventAttendancePublicId, EventStatusPublicId, EventTypePublicId } from "shared/publicId";
import type { StringResolution } from "src/locale/shared/stringResolution";
import { eventAttendanceEditorView, eventStatusEditorView, eventTypeEditorView } from "src/core/db3/shared/entities/event/eventCatalogs";

export function globalTextFixture<const TMember extends string>(member: TMember, value: string) {
    const resolution: StringResolution = { value, localeTag: "en-US", scope: "global", source: "stored", reason: "exact", requestedTag: "en-US" };
    return { [member]: value, [`${member}Resolution`]: resolution, [`${member}StringPublicId`]: null };
}

export function eventStatusDtoFixture(publicId: EventStatusPublicId, name = "Confirmed") {
    return eventStatusEditorView.parseDto({
        publicId, ...globalTextFixture("name", name), ...globalTextFixture("description", "Public display metadata"),
        color: "green", sortOrder: 1, iconName: null, isDeleted: false, significance: "FinalConfirmation",
    });
}
export function eventTypeDtoFixture(publicId: EventTypePublicId, name = "Concert") {
    return eventTypeEditorView.parseDto({
        publicId, ...globalTextFixture("name", name), ...globalTextFixture("description", "Public concert"),
        color: "green", sortOrder: 1, iconName: null, isDeleted: false, significance: "Concert",
    });
}

export function eventAttendanceDtoFixture(publicId: EventAttendancePublicId) {
    return eventAttendanceEditorView.parseDto({
        publicId, ...globalTextFixture("buttonCaption", "Going"), ...globalTextFixture("personalCaption", "You are going"),
        ...globalTextFixture("pastCaption", "Went"), ...globalTextFixture("personalPastCaption", "You went"),
        ...globalTextFixture("description", "Confirmed attendance"),
        color: "green", sortOrder: 1, iconName: "Check", isDeleted: false, isActive: true, strength: 100,
    });
}
