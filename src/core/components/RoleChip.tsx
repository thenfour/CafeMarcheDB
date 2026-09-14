import { Prisma } from "@prisma/client";
import { CMChipContainer, CMStandardDBChip } from "./CMChip";
import { StandardVariationSpec } from "./color/palette";
import { useDashboardContext } from "./dashboardContext/DashboardContext";

type _Role = Prisma.RoleGetPayload<{ select: { id: true, description: true, name: true, color: true, sortOrder: true, } }>;

export const RoleChip = (props: { role: number | _Role | null }) => {
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
