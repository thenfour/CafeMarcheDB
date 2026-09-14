import { AuthenticationError, AuthorizationError, NotFoundError } from "blitz";

export class UserMergeError extends Error {
    name = "UserMergeError";
}

// Database errors can contain query arguments, including credential hashes or
// response contents. Never serialize those errors through the merge endpoints.
export async function publicMergeResponse<T>(operation: () => Promise<T>): Promise<T> {
    try {
        return await operation();
    }
    catch (error) {
        if (error instanceof AuthenticationError || error instanceof AuthorizationError
            || error instanceof NotFoundError || error instanceof UserMergeError)//
        {
            // rethrow for certain known errors
            throw error;
        }
        throw new UserMergeError("Unable to complete this merge request. Refresh the report and try again.");
    }
}
