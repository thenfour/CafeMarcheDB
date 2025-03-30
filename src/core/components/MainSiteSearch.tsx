import { QuickSearchItemType } from 'shared/quickFilter';
import { simulateLinkClick } from './CMCoreComponents2';
import { AssociationAutocomplete } from './setlistPlan/ItemAssociation';

export const MainSiteSearch = () => {

    return <div className="MainSiteSearch">
        <AssociationAutocomplete
            allowedItemTypes={[QuickSearchItemType.event, QuickSearchItemType.song, QuickSearchItemType.wikiPage]}
            defaultValue=''
            onSelect={(newValue) => {
                if (newValue && newValue.absoluteUri) {
                    simulateLinkClick(newValue.absoluteUri);
                }
            }}
        />
    </div>;
}


