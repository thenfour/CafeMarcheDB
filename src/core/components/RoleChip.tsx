import { Prisma } from "@prisma/client";
import { CMChipContainer, CMStandardDBChip } from "./CMChip";
import { StandardVariationSpec } from "./color/palette";

type _Role = Prisma.RoleGetPayload<{ select: { id: true, description: true, name: true, color: true, sortOrder: true, } }>;

export const RoleChip = ({ role }: { role: _Role | null }) => {
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
