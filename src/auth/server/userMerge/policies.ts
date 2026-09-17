import { authoredContentPolicy } from "./policies/authoredContent";
import { eventResponsesPolicy } from "./policies/eventResponses";
import { filesPolicy } from "./policies/files";
import { historyPolicy } from "./policies/history";
import { instrumentsPolicy } from "./policies/instruments";
import { profilePolicy } from "./policies/profile";
import { segmentAttendancePolicy } from "./policies/segmentAttendance";
import { setlistReferencesPolicy } from "./policies/setlistReferences";
import { signInMethodsPolicy } from "./policies/signInMethods";
import { songCreditsPolicy } from "./policies/songCredits";
import { userTagsPolicy } from "./policies/userTags";
import type { MergePolicy } from "./types";

// Bump when decisions or report meaning changes. Previously reviewed plans expire.
export const USER_MERGE_POLICY_VERSION = 1;

// Execution order is intentional: segment attendance revises event responses
// after event-level responses have reached their final owner.
export const userMergePolicies: readonly MergePolicy[] = [
    profilePolicy,
    signInMethodsPolicy,
    eventResponsesPolicy,
    segmentAttendancePolicy,
    songCreditsPolicy,
    userTagsPolicy,
    instrumentsPolicy,
    filesPolicy,
    authoredContentPolicy,
    historyPolicy,
    setlistReferencesPolicy,
];
