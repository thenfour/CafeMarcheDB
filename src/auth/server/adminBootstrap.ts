import { hash256 } from "@blitzjs/auth";
import { timingSafeEqual } from "crypto";

export const kMinimumAdminBootstrapSecretLength = 32;

export interface AdminBootstrapConfiguration {
    tokenHash: string;
}

export const getAdminBootstrapConfiguration = (): AdminBootstrapConfiguration | null => {
    const secret = process.env.CMDB_ADMIN_BOOTSTRAP_SECRET;
    if (!secret || secret.length < kMinimumAdminBootstrapSecretLength) return null;

    return {
        tokenHash: hash256(secret),
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
