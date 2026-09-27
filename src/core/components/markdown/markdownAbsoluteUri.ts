import { getDashboardContextDataSingleton } from '../dashboardContext/DashboardContext';

// Public pages can render Markdown without loading dashboard data.
export function markdownAbsoluteUri(path: string): string {
    const dashboardContext = getDashboardContextDataSingleton();
    return dashboardContext?.getAbsoluteUri(path) ?? new URL(path, window.location.origin).toString();
}
