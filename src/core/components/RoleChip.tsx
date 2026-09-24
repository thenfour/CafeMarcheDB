import * as db3 from "src/core/db3/db3";
import { CMChipContainer, CMStandardDBChip } from "./CMChip";
import { StandardVariationSpec } from "./color/palette";
import { useDashboardContext } from "./dashboardContext/DashboardContext";

export const RoleChip = (props: { role: number | db3.RoleDisplay | null }) => {
    const dashboardContext = useDashboardContext();
    const role = typeof props.role === "number" ? dashboardContext.role.getById(props.role) : props.role;
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
