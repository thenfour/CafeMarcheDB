import React from 'react';
import { shellSearchItemTypes } from 'src/core/db3/shared/quickSearchTypes';
import { Permission } from 'shared/permissions';
import { useLocale } from 'src/locale/components/useLocale';
import { useDashboardContext } from '../dashboardContext/DashboardContext';
import { AppContextMarker } from '../AppContext';
import { AssociationAutocomplete } from '../ItemAssociation';
import { useRouter } from 'next/router';

export const MainSiteSearch = () => {
    const router = useRouter();
    const dashboard = useDashboardContext();
    const locale = useLocale();
    if (!dashboard.authorizationContext?.bandPublicId || !dashboard.isAuthorized(Permission.login)) {
        return null;
    }
    return <div className="MainSiteSearch">
        <AppContextMarker name="MainSearchBar">
            <AssociationAutocomplete
                allowedItemTypes={shellSearchItemTypes}
                permissionPolicy="omitUnavailable"
                searchEnabled
                placeholder={locale.getPlainString("search.shell.placeholder")}
                defaultValue=''
                onSelect={async (newValue) => {
                    if (newValue && newValue.absoluteUri) {
                        void router.push(newValue.absoluteUri);
                    }
                }}
            />
        </AppContextMarker>
    </div>;
}


