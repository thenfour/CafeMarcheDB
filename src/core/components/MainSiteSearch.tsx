import { QuickSearchItemType } from 'shared/quickFilter';
import { simulateLinkClick } from './CMCoreComponents2';
import { AssociationAutocomplete } from './setlistPlan/ItemAssociation';
import { useFeatureRecorder } from './DashboardContext';
import { ActivityFeature } from '../db3/shared/activityTracking';
import { AppContextMarker } from './AppContext';

export const MainSiteSearch = () => {
    const recordFeature = useFeatureRecorder();

    return <div className="MainSiteSearch">
        <AppContextMarker name="MainSearchBar">
            <AssociationAutocomplete
                allowedItemTypes={[QuickSearchItemType.event, QuickSearchItemType.song, QuickSearchItemType.wikiPage]}
                defaultValue=''
                onSelect={async (newValue, queryText) => {
                    await recordFeature({
                        feature: ActivityFeature.main_search_link_click,
                        eventId: newValue?.itemType === QuickSearchItemType.event ? newValue.id : undefined,
                        songId: newValue?.itemType === QuickSearchItemType.song ? newValue.id : undefined,
                        wikiPageId: newValue?.itemType === QuickSearchItemType.wikiPage ? newValue.id : undefined,
                        queryText,
                    });
                    if (newValue && newValue.absoluteUri) {
                        simulateLinkClick(newValue.absoluteUri);
                    }
                }}
            />
        </AppContextMarker>
    </div>;
}


