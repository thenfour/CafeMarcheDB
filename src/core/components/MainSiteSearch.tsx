import { QuickSearchItemType } from 'shared/quickFilter';
import { AppContextMarker } from './AppContext';
import { simulateLinkClick } from './CMCoreComponents2';
import { AssociationAutocomplete } from './setlistPlan/ItemAssociation';

export const MainSiteSearch = () => {
    return <div className="MainSiteSearch">
        <AppContextMarker name="MainSearchBar">
            <AssociationAutocomplete
                allowedItemTypes={[QuickSearchItemType.event, QuickSearchItemType.song, QuickSearchItemType.wikiPage]}
                defaultValue=''
                onSelect={async (newValue) => {
                    if (newValue && newValue.absoluteUri) {
                        simulateLinkClick(newValue.absoluteUri);
                    }
                }}
            />
        </AppContextMarker>
    </div>;
}


