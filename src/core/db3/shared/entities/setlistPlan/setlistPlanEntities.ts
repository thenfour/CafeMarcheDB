import { defineEntity } from "../../core/db3Entity";
import { xSetlistPlanGroup } from "../../schema/setlistPlan";

export const setlistPlanGroupEntity = defineEntity({
    schema: xSetlistPlanGroup,
    getIdentity: (group: { id: number }) => group.id,
});
