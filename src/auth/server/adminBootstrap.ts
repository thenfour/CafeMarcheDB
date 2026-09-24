import { hash256 } from "@blitzjs/auth";
import { timingSafeEqual } from "crypto";

export const kMinimumAdminBootstrapSecretLength = 32;

export interface AdminBootstrapConfiguration {
    tokenHash: string;
    oneTimeUse: boolean;
}

export const getAdminBootstrapConfiguration = (): AdminBootstrapConfiguration | null => {
    const secret = process.env.CMDB_ADMIN_BOOTSTRAP_SECRET;
    if (!secret || secret.length < kMinimumAdminBootstrapSecretLength) return null;

    // For DEV environment, we bypass the minimum length check for simplicity.
    const onTimeUse = process.env.CMDB_ADMIN_BOOTSTRAP_ONE_TIME_USE !== "0";

    return {
        tokenHash: hash256(secret),
        oneTimeUse: onTimeUse,
    };
};

export const adminBootstrapSecretMatches = (
    submittedSecret: string,
    configuration: AdminBootstrapConfiguration,
): boolean => {
    const encoder = new TextEncoder();
    const submittedHash = encoder.encode(hash256(submittedSecret));
    const configuredHash = encoder.encode(configuration.tokenHash);
    return submittedHash.length === configuredHash.length
        && timingSafeEqual(submittedHash, configuredHash);
};
