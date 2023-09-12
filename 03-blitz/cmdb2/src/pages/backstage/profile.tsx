import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { CardContent, Typography } from "@mui/material";
import { gIconMap } from "src/core/db3/components/IconSelectDialog";
import { ButtonSelectControl, ButtonSelectOption, MutationButtonSelectControl, MutationTextControl } from "src/core/components/CMTextField";
import { useMutation, useQuery } from "@blitzjs/rpc";
import updateName from "../api/user/mutations/updateName";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { gIconOptions } from "shared/utils";
import updateActive from "../api/user/mutations/updateActive";



export const OwnUserNameControl = () => {
    const [currentUser, { refetch }] = useCurrentUser();
    const [theMutation] = useMutation(updateName);

    return currentUser && <MutationTextControl
        initialValue={currentUser.name}
        refetch={refetch}
        onChange={async (value) => {
            await theMutation({ userId: currentUser.id, name: value || "" });
        }}
    />;
};


export const OwnActiveControl = () => {
    const [currentUser, { refetch }] = useCurrentUser();
    const [theMutation] = useMutation(updateActive);
    const options: ButtonSelectOption[] = [
        {
            value: false,
            label: "Not an active member",
            iconName: currentUser.isActive ? undefined : gIconOptions.Check,
            color: "no",
        }, {
            value: true,
            label: "active member",
            iconName: !currentUser.isActive ? undefined : gIconOptions.Check,
            color: "yes",
        }

    ];
    return <MutationButtonSelectControl
        refetch={refetch}
        options={options}
        initialValue={currentUser!.isActive}
        onChange={async (val) => {
            await theMutation({ userId: currentUser.id, isActive: val });
        }}
    />;
};




const MainContent = () => {
    return <>
        <SettingMarkdown settingName="profile_markdown"></SettingMarkdown>
        <CMSinglePageSurfaceCard>
            <CardContent>
                <Typography gutterBottom variant="h4" component="div">
                    {gIconMap.Person()} Your profile
                </Typography>

                <OwnUserNameControl />
                <OwnActiveControl />

            </CardContent>
        </CMSinglePageSurfaceCard>
    </>;
};



const ProfilePage: BlitzPage = () => {
    return (
        <DashboardLayout title="Your profile">
            <MainContent />
        </DashboardLayout>
    )
}

export default ProfilePage;
