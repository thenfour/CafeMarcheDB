import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { makeServerSidePermissionGuard } from "src/auth/server/serverPageAuthorization";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { AttendanceScenarioPage } from "src/core/components/event/AttendanceScenarioPage";

const AttendanceTestPage: BlitzPage = () => <DashboardLayout title="Attendance scenarios">
    <AttendanceScenarioPage />
</DashboardLayout>;

export default AttendanceTestPage;
export const getServerSideProps = makeServerSidePermissionGuard(Permission.sysadmin);
