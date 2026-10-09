// Fixed content restored from the pre-migration seed. Song-tag significance was removed by the schema.
interface CatalogPresentation { name: string; description: string; sortOrder: number; color: string | null; }
interface SongTagDefinition extends CatalogPresentation { group?: string; indicator?: string; indicatorCssClass?: string; }
interface SignificantDefinition extends CatalogPresentation { significance: string | null; iconName?: string | null; visibleOnFrontpage?: boolean; }
interface AttendanceDefinition extends CatalogPresentation { personalText: string; pastText: string; pastPersonalText: string; iconName: string; strength: number; }
interface InstrumentDefinition extends CatalogPresentation { autoAssignFileLeafRegex: string; }
interface SeedCatalogDefinitions {
    songTag: readonly SongTagDefinition[];
    fileTag: readonly SignificantDefinition[];
    eventTag: readonly SignificantDefinition[];
    eventStatus: readonly SignificantDefinition[];
    eventType: readonly SignificantDefinition[];
    eventAttendance: readonly AttendanceDefinition[];
    songCreditType: readonly CatalogPresentation[];
    instrumentFunctionalGroup: readonly CatalogPresentation[];
    instrument: readonly InstrumentDefinition[];
}

export const catalogDefinitions: SeedCatalogDefinitions = {
    "songTag": [
        {
            "description": "",
            "sortOrder": 0,
            "color": null,
            "name": "By Heart"
        },
        {
            "description": "",
            "sortOrder": 1,
            "color": null,
            "indicator": "impro",
            "name": "Improv"
        },
        {
            "description": "",
            "sortOrder": 2,
            "color": null,
            "indicator": "M",
            "name": "Majoretteketet"
        },
        {
            "description": "",
            "sortOrder": 3,
            "color": null,
            "name": "Singer"
        },
        {
            "description": "",
            "sortOrder": 4,
            "color": null,
            "name": "Street"
        },
        {
            "description": "",
            "sortOrder": 5,
            "color": null,
            "group": "pombaton",
            "indicator": "🔴",
            "indicatorCssClass": "bare",
            "name": "Pompoms"
        },
        {
            "description": "",
            "sortOrder": 6,
            "color": null,
            "group": "pombaton",
            "indicator": "🔵",
            "indicatorCssClass": "bare",
            "name": "Batons"
        }
    ],
    "fileTag": [
        {
            "description": "",
            "sortOrder": 0,
            "color": null,
            "significance": "Partition",
            "name": "Partition"
        },
        {
            "description": "",
            "sortOrder": 0,
            "color": null,
            "significance": "Recording",
            "name": "Recording"
        },
        {
            "description": "",
            "sortOrder": 0,
            "color": null,
            "significance": "Rider",
            "name": "Rider"
        }
    ],
    "eventTag": [
        {
            "visibleOnFrontpage": true,
            "description": "",
            "sortOrder": 0,
            "color": null,
            "significance": "Majoretteketet",
            "name": "Majoretteketet"
        },
        {
            "visibleOnFrontpage": false,
            "description": "",
            "sortOrder": 0,
            "color": null,
            "significance": "TownHall",
            "name": "Town hall"
        }
    ],
    "eventStatus": [
        {
            "description": "The initial status for events before any confirmations or actions.",
            "sortOrder": 0,
            "color": "purple",
            "significance": "New",
            "iconName": "AutoAwesome",
            "name": "New"
        },
        {
            "description": "",
            "sortOrder": 30,
            "color": "red",
            "significance": null,
            "iconName": "Campaign",
            "name": "Checking Attendance"
        },
        {
            "description": "We have attendance, but need to finalize details before ",
            "sortOrder": 50,
            "color": "gold",
            "significance": null,
            "iconName": null,
            "name": "Finalizing"
        },
        {
            "description": "The event requires no further confirmations; it's happening or has happened.",
            "sortOrder": 61,
            "color": "green",
            "significance": "FinalConfirmation",
            "iconName": "Done",
            "name": "Confirmed"
        },
        {
            "description": "The event isn't happening.",
            "sortOrder": 100,
            "color": "light_gray",
            "significance": "Cancelled",
            "iconName": "Cancel",
            "name": "Cancelled"
        }
    ],
    "eventType": [
        {
            "description": "",
            "sortOrder": 0,
            "color": "light_blue",
            "significance": "Concert",
            "iconName": "MusicNote",
            "name": "Concert"
        },
        {
            "description": "",
            "sortOrder": 0,
            "color": "teal",
            "significance": null,
            "iconName": "Group",
            "name": "Meeting"
        },
        {
            "description": "",
            "sortOrder": 0,
            "color": "light_brown",
            "significance": "Rehearsal",
            "iconName": "MusicNote",
            "name": "Rehearsal"
        },
        {
            "description": "",
            "sortOrder": 0,
            "color": "light_purple",
            "significance": "Weekend",
            "iconName": "Celebration",
            "name": "Weekend"
        }
    ],
    "eventAttendance": [
        {
            "personalText": "you're not going",
            "pastText": "xyz",
            "pastPersonalText": "xyz",
            "description": "You can't make it",
            "iconName": "ThumbDown",
            "color": "attendance_no",
            "strength": 0,
            "sortOrder": 0,
            "name": "No"
        },
        {
            "personalText": "you're probably not going",
            "pastText": "snth",
            "pastPersonalText": "snth",
            "description": "You probably can't make it; we won't count on you for final head count or reserving things like meals",
            "iconName": "ThumbDown",
            "color": "attendance_no_maybe",
            "strength": 33,
            "sortOrder": 33,
            "name": "Probably not"
        },
        {
            "personalText": "you're probably going",
            "pastText": "snth",
            "pastPersonalText": "snth",
            "description": "We will assume you're coming, even if you're not certain you can come. We will include you for final head count and reserving things like meals.",
            "iconName": "ThumbUp",
            "color": "attendance_yes_maybe",
            "strength": 66,
            "sortOrder": 66,
            "name": "Probably"
        },
        {
            "personalText": "You're going!",
            "pastText": "snth",
            "pastPersonalText": "snth",
            "description": "We'll count you in!",
            "iconName": "ThumbUp",
            "color": "attendance_yes",
            "strength": 100,
            "sortOrder": 100,
            "name": "Yes"
        }
    ],
    "songCreditType": [
        {
            "description": "",
            "sortOrder": 0,
            "color": null,
            "name": "Arranger"
        },
        {
            "description": "",
            "sortOrder": 0,
            "color": null,
            "name": "Composer"
        },
        {
            "description": "",
            "sortOrder": 0,
            "color": null,
            "name": "Lyrics"
        }
    ],
    "instrumentFunctionalGroup": [
        {
            "name": "Voice",
            "description": "",
            "color": "citron",
            "sortOrder": 8
        },
        {
            "name": "Flute",
            "description": "",
            "color": "gold",
            "sortOrder": 10
        },
        {
            "name": "Oboe",
            "description": "",
            "color": "light_gold",
            "sortOrder": 15
        },
        {
            "name": "Clarinet",
            "description": "",
            "color": "brown",
            "sortOrder": 20
        },
        {
            "name": "Bass Clarinet",
            "description": "",
            "color": "light_brown",
            "sortOrder": 30
        },
        {
            "name": "Soprano sax",
            "description": "",
            "color": "light_orange",
            "sortOrder": 40
        },
        {
            "name": "Alto sax",
            "description": "",
            "color": "orange",
            "sortOrder": 50
        },
        {
            "name": "Tenor sax",
            "description": "",
            "color": "orange",
            "sortOrder": 60
        },
        {
            "name": "Bari sax",
            "description": "",
            "color": "purple",
            "sortOrder": 70
        },
        {
            "name": "Trumpet",
            "description": "",
            "color": "maroon",
            "sortOrder": 80
        },
        {
            "name": "Tenor brass",
            "description": "",
            "color": "maroon",
            "sortOrder": 90
        },
        {
            "name": "Bass Tuba",
            "description": "",
            "color": "dark_gray",
            "sortOrder": 100
        },
        {
            "name": "Violin",
            "description": "",
            "color": "light_gold",
            "sortOrder": 110
        },
        {
            "name": "Viola",
            "description": "",
            "color": "light_gold",
            "sortOrder": 112
        },
        {
            "name": "Cello",
            "description": "",
            "color": "light_gold",
            "sortOrder": 114
        },
        {
            "name": "Accordion",
            "description": "",
            "color": "light_green",
            "sortOrder": 120
        },
        {
            "name": "Piano",
            "description": "",
            "color": "light_teal",
            "sortOrder": 128
        },
        {
            "name": "Guitar",
            "description": "",
            "color": "green",
            "sortOrder": 130
        },
        {
            "name": "Bass guitar",
            "description": "",
            "color": "dark_gray",
            "sortOrder": 135
        },
        {
            "name": "Snare drum",
            "description": "",
            "color": "blue",
            "sortOrder": 140
        },
        {
            "name": "Bass drum",
            "description": "",
            "color": "blue",
            "sortOrder": 150
        },
        {
            "name": "Percussion",
            "description": "",
            "color": "light_blue",
            "sortOrder": 160
        },
        {
            "name": "Special/other",
            "description": "For things like one-off instruments like hangdrum, synthesizer, etc.",
            "color": null,
            "sortOrder": 500
        }
    ],
    "instrument": [
        {
            "name": "Voice",
            "description": "",
            "autoAssignFileLeafRegex": "Voice",
            "sortOrder": 8,
            "color": null
        },
        {
            "name": "Flute",
            "description": "",
            "autoAssignFileLeafRegex": "Flute",
            "sortOrder": 10,
            "color": null
        },
        {
            "name": "Oboe",
            "description": "",
            "autoAssignFileLeafRegex": "Oboe",
            "sortOrder": 15,
            "color": null
        },
        {
            "name": "Clarinet",
            "description": "",
            "autoAssignFileLeafRegex": "Clarinet",
            "sortOrder": 20,
            "color": null
        },
        {
            "name": "Bass Clarinet",
            "description": "",
            "autoAssignFileLeafRegex": "Bass Clarinet",
            "sortOrder": 30,
            "color": null
        },
        {
            "name": "Soprano sax",
            "description": "",
            "autoAssignFileLeafRegex": "Soprano sax",
            "sortOrder": 40,
            "color": null
        },
        {
            "name": "Alto sax",
            "description": "",
            "autoAssignFileLeafRegex": "Alto sax",
            "sortOrder": 50,
            "color": null
        },
        {
            "name": "Tenor sax",
            "description": "",
            "autoAssignFileLeafRegex": "Tenor sax",
            "sortOrder": 60,
            "color": null
        },
        {
            "name": "Bari sax",
            "description": "",
            "autoAssignFileLeafRegex": "Bari sax",
            "sortOrder": 70,
            "color": null
        },
        {
            "name": "Trumpet",
            "description": "",
            "autoAssignFileLeafRegex": "Trumpet",
            "sortOrder": 80,
            "color": null
        },
        {
            "name": "Tenor brass",
            "description": "",
            "autoAssignFileLeafRegex": "Tenor brass",
            "sortOrder": 90,
            "color": null
        },
        {
            "name": "Bass Tuba",
            "description": "",
            "autoAssignFileLeafRegex": "Bass Tuba",
            "sortOrder": 100,
            "color": null
        },
        {
            "name": "Violin",
            "description": "",
            "autoAssignFileLeafRegex": "Violin",
            "sortOrder": 110,
            "color": null
        },
        {
            "name": "Viola",
            "description": "",
            "autoAssignFileLeafRegex": "Viola",
            "sortOrder": 112,
            "color": null
        },
        {
            "name": "Cello",
            "description": "",
            "autoAssignFileLeafRegex": "Cello",
            "sortOrder": 114,
            "color": null
        },
        {
            "name": "Accordion",
            "description": "",
            "autoAssignFileLeafRegex": "Accordion",
            "sortOrder": 120,
            "color": null
        },
        {
            "name": "Piano",
            "description": "",
            "autoAssignFileLeafRegex": "Piano",
            "sortOrder": 128,
            "color": null
        },
        {
            "name": "Guitar",
            "description": "",
            "autoAssignFileLeafRegex": "Guitar",
            "sortOrder": 130,
            "color": null
        },
        {
            "name": "Bass guitar",
            "description": "",
            "autoAssignFileLeafRegex": "Bass guitar",
            "sortOrder": 135,
            "color": null
        },
        {
            "name": "Snare drum",
            "description": "",
            "autoAssignFileLeafRegex": "Snare drum",
            "sortOrder": 140,
            "color": null
        },
        {
            "name": "Bass drum",
            "description": "",
            "autoAssignFileLeafRegex": "Bass drum",
            "sortOrder": 150,
            "color": null
        },
        {
            "name": "Percussion",
            "description": "",
            "autoAssignFileLeafRegex": "Percussion",
            "sortOrder": 160,
            "color": null
        },
        {
            "name": "Special/other",
            "description": "",
            "autoAssignFileLeafRegex": "Special/other",
            "sortOrder": 500,
            "color": null
        }
    ]
};
