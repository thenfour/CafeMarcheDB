import * as db3 from "src/core/db3/db3";
import type { RolePublicId } from "shared/publicId";
import { CMChipContainer, CMStandardDBChip } from "./CMChip";
import { StandardVariationSpec } from "./color/palette";
import { useDashboardContext } from "./dashboardContext/DashboardContext";

export const RoleChip = (props: { role: RolePublicId | db3.RoleDisplay | null }) => {
    const dashboardContext = useDashboardContext();
    const role = db3.xRole.isIdentity(props.role)
        ? dashboardContext.role.getById(props.role)
        : props.role;
    return (
        <CMChipContainer>
            <CMStandardDBChip
                size='small'
                shape="rectangle"
                model={role}
                variation={StandardVariationSpec.Strong}
                getTooltip={(_) => role?.description || null}
            />
        </CMChipContainer>
    );
};
