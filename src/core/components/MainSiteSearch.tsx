import { QuickSearchItemType } from 'shared/quickFilter';
import { AppContextMarker } from './AppContext';
import { AssociationAutocomplete } from './setlistPlan/ItemAssociation';
import { useRouter } from 'next/router';

export const MainSiteSearch = () => {
    const router = useRouter();
    return <div className="MainSiteSearch">
        <AppContextMarker name="MainSearchBar">
            <AssociationAutocomplete
                allowedItemTypes={[QuickSearchItemType.event, QuickSearchItemType.song, QuickSearchItemType.wikiPage]}
                defaultValue=''
                onSelect={async (newValue) => {
                    if (newValue && newValue.absoluteUri) {
                        router.push(newValue.absoluteUri);
                    }
                }}
            />
        </AppContextMarker>
    </div>;
}


