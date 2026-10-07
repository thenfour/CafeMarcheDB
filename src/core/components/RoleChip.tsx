// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/components/RoleChip.tsx:1-23
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 5c2da24485e9b8f46fff79953c6a76a9748d5ead6f7d2f2cc0fb7c099735702c
// MIGRATION_REFERENCE_BEGIN
// import * as db3 from "src/core/db3/db3";
// import type { RolePublicId } from "shared/publicId";
// import { CMChipContainer, CMStandardDBChip } from "./CMChip";
// import { StandardVariationSpec } from "./color/palette";
// import { useDashboardContext } from "./dashboardContext/DashboardContext";
//
// export const RoleChip = (props: { role: RolePublicId | db3.RoleDisplay | null }) => {
//     const dashboardContext = useDashboardContext();
//     const role = db3.xRole.isIdentity(props.role)
//         ? dashboardContext.role.getById(props.role)
//         : props.role;
//     return (
//         <CMChipContainer>
//             <CMStandardDBChip
//                 size='small'
//                 shape="rectangle"
//                 model={role}
//                 variation={StandardVariationSpec.Strong}
//                 getTooltip={(_) => role?.description || null}
//             />
//         </CMChipContainer>
//     );
// };
// MIGRATION_REFERENCE_END
