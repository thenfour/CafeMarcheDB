import { hash256 } from "@blitzjs/auth";
import { timingSafeEqual } from "crypto";
import { UserEmailSchema } from "../schemas";

export const kMinimumAdminBootstrapSecretLength = 32;

export interface AdminBootstrapConfiguration {
    email: string;
    tokenHash: string;
}

export const getAdminBootstrapTargetEmail = (): string | null => {
    const parsed = UserEmailSchema.safeParse(process.env.CMDB_ADMIN_BOOTSTRAP_EMAIL);
    return parsed.success ? parsed.data : null;
};

export const getAdminBootstrapConfiguration = (): AdminBootstrapConfiguration | null => {
    const email = getAdminBootstrapTargetEmail();
    const secret = process.env.CMDB_ADMIN_BOOTSTRAP_SECRET;
    if (!email || !secret || secret.length < kMinimumAdminBootstrapSecretLength) return null;

    return {
        email,
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
