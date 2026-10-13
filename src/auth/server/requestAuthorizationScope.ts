import { AsyncLocalStorage } from "node:async_hooks";
import { NotFoundError } from "blitz";
import type { BandPublicId } from "shared/publicId";

const requestBand = new AsyncLocalStorage<BandPublicId | null>();

// like withPortalRequest but only with band.
export function withAuthorizationBandScope<T>(bandPublicId: BandPublicId | null, operation: () => Promise<T>): Promise<T> {
    assertAuthorizationBandScope(bandPublicId);
    // A nested account operation cannot erase its transport's band constraint.
    return requestBand.run(requestBand.getStore() ?? bandPublicId, operation);
}

// ensure the selected band matches the async storage context
export function assertAuthorizationBandScope(selected: BandPublicId | null | undefined): void {
    const required = requestBand.getStore();
    if (required && selected && required !== selected) {
        throw new NotFoundError();
    }
}
