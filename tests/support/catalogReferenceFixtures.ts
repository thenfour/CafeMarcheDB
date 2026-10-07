import type { InstrumentPublicId, InstrumentFunctionalGroupPublicId, PermissionPublicId, SongTagPublicId, UserTagPublicId } from "shared/publicId";
import type { StringResolution } from "src/locale/shared/stringResolution";
import { hydrateView } from "src/core/db3/shared/core/db3View";
import { instrumentDashboardView, instrumentFunctionalGroupDashboardView, permissionDashboardView, songTagDashboardView, userTagDashboardView,
    createDashboardReferenceStore, registerDashboardReferences } from "src/core/db3/shared/references/dashboardReferences";

function resolution(value: string): StringResolution {
    return { value, localeTag: "en-US", scope: "band", source: "stored", reason: "exact", requestedTag: "en-US" };
}

function commonFields(name: string, description: string, sortOrder: number) {
    return { name, description, sortOrder, nameResolution: resolution(name), descriptionResolution: resolution(description),
        nameStringPublicId: null, descriptionStringPublicId: null, sortOrderOverride: sortOrder,
        sortOrderInheritedValue: null, isHidden: false, globalPublicId: null };
}

export function groupReferenceFixture(publicId: InstrumentFunctionalGroupPublicId) {
    const dto = instrumentFunctionalGroupDashboardView.parseDto({
        ...commonFields("Brass", "Brass instruments", 1), publicId,
        color: "orange", colorOverride: "orange", colorInheritedValue: null, globalFunctionalGroup: null,
    });
    return hydrateView(instrumentFunctionalGroupDashboardView, dto, createDashboardReferenceStore());
}

export function instrumentDtoFixture(publicId: InstrumentPublicId, functionalGroupId: InstrumentFunctionalGroupPublicId) {
    return instrumentDashboardView.parseDto({
        ...commonFields("Trumpet", "", 1), publicId, functionalGroupId, globalInstrument: null,
        autoAssignFileLeafRegex: null, autoAssignFileLeafRegexOverride: null, autoAssignFileLeafRegexInheritedValue: null,
    });
}

export function instrumentReferenceFixture(publicId: InstrumentPublicId, group: ReturnType<typeof groupReferenceFixture>) {
    const references = createDashboardReferenceStore();
    registerDashboardReferences(references, { instrumentFunctionalGroup: [group] });
    return hydrateView(instrumentDashboardView, instrumentDtoFixture(publicId, group.publicId), references);
}

export function songTagReferenceFixture(publicId: SongTagPublicId) {
    const dto = songTagDashboardView.parseDto({
        ...commonFields("March", "", 1), publicId, color: null, colorOverride: null, colorInheritedValue: null,
        globalSongTag: null, group: null, groupOverride: null, groupInheritedValue: null,
        indicator: null, indicatorOverride: null, indicatorInheritedValue: null,
        indicatorCssClass: null, indicatorCssClassOverride: null, indicatorCssClassInheritedValue: null,
    });
    return hydrateView(songTagDashboardView, dto, createDashboardReferenceStore());
}

export function permissionReferenceFixture(publicId: PermissionPublicId) {
    const dto = permissionDashboardView.parseDto({
        publicId, name: "members", description: "", descriptionStringPublicId: null,
        descriptionResolution: { ...resolution(""), scope: "global" },
        isVisibility: true, sortOrder: 1, significance: null, color: null, iconName: null,
    });
    return hydrateView(permissionDashboardView, dto, createDashboardReferenceStore());
}

export function userTagReferenceFixture(publicId: UserTagPublicId, name: string) {
    const dto = userTagDashboardView.parseDto({
        ...commonFields(name, "", 1), publicId, color: null, colorOverride: null, colorInheritedValue: null,
        globalUserTag: null, cssClass: null, cssClassOverride: null, cssClassInheritedValue: null,
        significance: null, significanceOverride: null, significanceInheritedValue: null,
    });
    return hydrateView(userTagDashboardView, dto, createDashboardReferenceStore());
}
