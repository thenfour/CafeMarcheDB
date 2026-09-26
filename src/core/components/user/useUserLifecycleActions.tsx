import { useMutation } from "@blitzjs/rpc";
import deactivateUser from "src/auth/mutations/deactivateUser";
import reactivateUser from "src/auth/mutations/reactivateUser";
import { kContinuityAcknowledgementErrorPrefix } from "src/auth/server/userManagementPolicy";
import { useConfirm } from "../ConfirmationDialog";
import type { UserPublicId } from "shared/publicId";

type LifecycleUser = { publicId: UserPublicId; name: string };

export const useUserLifecycleActions = () => {
    const [deactivateMutation] = useMutation(deactivateUser);
    const [reactivateMutation] = useMutation(reactivateUser);
    const confirm = useConfirm();

    const confirmContinuityRisk = (user: LifecycleUser, permissions: readonly string[]) => confirm({
        title: "Confirm continuity risk",
        description: <>
            <p>Deactivating {user.name} would leave no active non-Sysadmin user able to perform:</p>
            <ul>{permissions.map(permission => <li key={permission}>{permission}</li>)}</ul>
            <p>Continue anyway?</p>
        </>,
    });

    const deactivate = async (user: LifecycleUser, knownWarnings: readonly string[] = []): Promise<boolean> => {
        if (!await confirm({ title: "Deactivate user", description: `Deactivate ${user.name}'s account?` })) return false;
        const acknowledged = knownWarnings.length > 0 && await confirmContinuityRisk(user, knownWarnings);
        if (knownWarnings.length > 0 && !acknowledged) return false;
        try {
            await deactivateMutation({ userId: user.publicId, acknowledgeContinuityRisk: acknowledged });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const markerIndex = message.indexOf(kContinuityAcknowledgementErrorPrefix);
            if (acknowledged || markerIndex < 0) throw error;
            const warnings = message.slice(markerIndex + kContinuityAcknowledgementErrorPrefix.length)
                .split(",").map(value => value.trim()).filter(Boolean);
            if (!warnings.length) throw error;
            if (!await confirmContinuityRisk(user, warnings)) return false;
            await deactivateMutation({ userId: user.publicId, acknowledgeContinuityRisk: true });
        }
        return true;
    };

    const reactivate = async (user: LifecycleUser): Promise<boolean> => {
        if (!await confirm({
            title: "Reactivate user",
            description: `Reactivate ${user.name}'s account with its existing role? They will need to sign in again.`,
        })) return false;
        await reactivateMutation({ userId: user.publicId });
        return true;
    };

    return { deactivate, reactivate };
};
