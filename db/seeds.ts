import { PrismaClient, Prisma } from '@prisma/client'
import { Permission, gPermissionOrdered } from '../shared/permissions'
const prisma = new PrismaClient()


// https://gist.github.com/codeguy/6684588
export const slugify = (...args: (string | number)[]): string => {
  const value = args.join(' ')

  return value
    .normalize('NFD') // split an accented letter in the base letter and the acent
    .replace(/[\u0300-\u036f]/g, '') // remove all previously split accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, '') // remove all chars not letters, numbers and spaces (to be replaced)
    .replace(/\s+/g, '-') // separator
}

const SeedTable = async <Ttable extends { create: (inp: { data: TuncheckedCreateInput }) => any }, TuncheckedCreateInput>(tableName: string, table: Ttable, items: TuncheckedCreateInput[]) => {
  console.log(`Seeding table ${tableName}`);

  // This array will store the original input items along with their new primary keys
  type TUpdatedItem = (TuncheckedCreateInput & { id: number });
  const updatedItems: TUpdatedItem[] = [];

  for (let i = 0; i < items.length; ++i) {
    const ret = await table.create({
      data: items[i]!
    });

    // Create a new item entry with the id added
    const updatedItem: TUpdatedItem = {
      ...items[i]!,
      id: ret.id as number // Assuming 'id' is the primary key and is returned by the create method
    };

    // Add the new item to the updatedItems array
    updatedItems.push(updatedItem);

    // Logging depending on available properties
    if (ret.name) {
      console.log(`created '${tableName}': { name:'${ret.name}', id: '${ret.id}'}`);
    } else if (ret.text) {
      console.log(`created '${tableName}': { text:'${ret.text}', id: '${ret.id}'}`);
    } else {
      console.log(`created '${tableName}': { id: '${ret.id}'}`);
    }
  }

  // Return the updated array
  return updatedItems;
};


// const SeedTable = async <Ttable extends { create: (inp: { data: TuncheckedCreateInput }) => any }, TuncheckedCreateInput>(tableName: string, table: Ttable, items: TuncheckedCreateInput[]) => {
//   console.log(`Seeding table ${tableName}`);
//   for (let i = 0; i < items.length; ++i) {
//     const ret = await table.create({
//       data: items[i]!
//     });

//     if (ret.name) {
//       console.log(`created '${tableName}': { name:'${ret.name}', id: '${ret.id}'}`);
//     } else if (ret.text) {
//       console.log(`created '${tableName}': { text:'${ret.text}', id: '${ret.id}'}`);
//     } else {
//       console.log(`created '${tableName}': { id: '${ret.id}'}`);
//     }
//   }
// };


const UpdateTable = async <Ttable extends { update: (inp: { data: TuncheckedUpdateInput, where: any }) => any }, TuncheckedUpdateInput>(tableName: string, matchField: string, table: Ttable, items: TuncheckedUpdateInput[]) => {
  for (let i = 0; i < items.length; ++i) {
    const item = items[i]!;
    const ret = await table.update({
      data: item,
      where: {
        [matchField]: item[matchField],
      }
    });

    if (ret.name) {
      console.log(`updated '${tableName}': { name:'${ret.name}', id: '${ret.id}'}`);
    } else if (ret.text) {
      console.log(`updated '${tableName}': { text:'${ret.text}', id: '${ret.id}'}`);
    } else {
      console.log(`updated '${tableName}': { id: '${ret.id}'}`);
    }
  }
};

/*
 * This seed function is executed when you run `blitz db seed`.
 *
 * Probably you want to use a library like https://chancejs.com
 * to easily generate realistic data.
 */
const main = async () => {

  const instrumentTagSeed: Prisma.InstrumentTagUncheckedCreateInput[] = [
    {
      "text": "Needs power",
      "description": "",
      "sortOrder": 0,
      "color": null,
      "significance": "NeedsPower"
    }
  ];

  await SeedTable("instrumentTag", prisma.instrumentTag, instrumentTagSeed);


  const songTagSeed: Prisma.SongTagUncheckedCreateInput[] = [
    {
      "text": "By Heart",
      "description": "",
      "sortOrder": 0,
      "color": null,
      "significance": "ByHeart",
      "showOnSongLists": true
    },
    {
      "text": "Improv",
      "description": "",
      "sortOrder": 0,
      "color": null,
      "significance": "Improvisation",
      "showOnSongLists": true
    },
    {
      "text": "Majoretteketet",
      "description": "",
      "sortOrder": 0,
      "color": null,
      "significance": "Majoretteketet",
      "showOnSongLists": true
    },
    {
      "text": "Singer",
      "description": "",
      "sortOrder": 0,
      "color": null,
      "significance": "VocalSolo",
      "showOnSongLists": true
    },
    {
      "text": "Street",
      "description": "",
      "sortOrder": 0,
      "color": null,
      "significance": "Street",
      "showOnSongLists": true
    }
  ];

  await SeedTable("songTag", prisma.songTag, songTagSeed);

  await SeedTable("fileTag", prisma.fileTag, [
    {
      "text": "Partition",
      "description": "",
      "sortOrder": 0,
      "color": null,
      "significance": "Partition"
    },
    {
      "text": "Recording",
      "description": "",
      "sortOrder": 0,
      "color": null,
      "significance": "Recording"
    },
    {
      "text": "Rider",
      "description": "",
      "sortOrder": 0,
      "color": null,
      "significance": "Rider"
    }
  ]);

  await SeedTable("eventTag", prisma.eventTag, [
    {
      "text": "Majoretteketet",
      "visibleOnFrontpage": true,
      "description": "",
      "sortOrder": 0,
      "color": null,
      "significance": "Majoretteketet"
    },
    {
      "text": "Town hall",
      "visibleOnFrontpage": false,
      "description": "",
      "sortOrder": 0,
      "color": null,
      "significance": "TownHall"
    }
  ]);

  await SeedTable("eventStatus", prisma.eventStatus,
    [
      {
        "label": "New",
        "description": "The initial status for events before any confirmations or actions.",
        "sortOrder": 0,
        "color": "purple",
        "significance": "New",
        "iconName": "AutoAwesome"
      },
      {
        "label": "Checking Attendance",
        "description": "",
        "sortOrder": 30,
        "color": "red",
        "significance": null,
        "iconName": "Campaign"
      },
      {
        "label": "Finalizing",
        "description": "We have attendance, but need to finalize details before ",
        "sortOrder": 50,
        "color": "gold",
        "significance": null,
        "iconName": null
      },
      {
        "label": "Confirmed",
        "description": "The event requires no further confirmations; it's happening or has happened.",
        "sortOrder": 61,
        "color": "green",
        "significance": "FinalConfirmation",
        "iconName": "Done"
      },
      {
        "label": "Cancelled",
        "description": "The event is abandoned / cancelled. It's not happening.",
        "sortOrder": 100,
        "color": "light_gray",
        "significance": "Cancelled",
        "iconName": "Cancel"
      }
    ]
  );

  await SeedTable("eventType", prisma.eventType,
    [
      {
        "text": "Concert",
        "description": "",
        "sortOrder": 0,
        "color": "light_blue",
        "significance": "Concert",
        "iconName": "MusicNote"
      },
      {
        "text": "Meeting",
        "description": "",
        "sortOrder": 0,
        "color": "teal",
        "significance": null,
        "iconName": "Group"
      },
      {
        "text": "Rehearsal",
        "description": "",
        "sortOrder": 0,
        "color": "light_brown",
        "significance": "Rehearsal",
        "iconName": "MusicNote"
      },
      {
        "text": "Weekend",
        "description": "",
        "sortOrder": 0,
        "color": "light_purple",
        "significance": "Weekend",
        "iconName": "Celebration"
      }
    ]
  );


  await SeedTable("eventAttendance", prisma.eventAttendance,
    [
      {
        "text": "No",
        "personalText": "you're not going",
        "pastText": "xyz",
        "pastPersonalText": "xyz",
        "description": "You can't make it",
        "iconName": "ThumbDown",
        "color": "attendance_no",
        "strength": 0,
        "sortOrder": 0
      },
      {
        "text": "Probably not",
        "personalText": "you're probably not going",
        "pastText": "snth",
        "pastPersonalText": "snth",
        "description": "You probably can't make it; we won't count on you for final head count or reserving things like meals",
        "iconName": "ThumbDown",
        "color": "attendance_no_maybe",
        "strength": 33,
        "sortOrder": 33
      },
      {
        "text": "Probably",
        "personalText": "you're probably going",
        "pastText": "snth",
        "pastPersonalText": "snth",
        "description": "We will assume you're coming, even if you're not certain you can come. We will include you for final head count and reserving things like meals.",
        "iconName": "ThumbUp",
        "color": "attendance_yes_maybe",
        "strength": 66,
        "sortOrder": 66
      },
      {
        "text": "Yes",
        "personalText": "You're going!",
        "pastText": "snth",
        "pastPersonalText": "snth",
        "description": "We'll count you in!",
        "iconName": "ThumbUp",
        "color": "attendance_yes",
        "strength": 100,
        "sortOrder": 100
      }
    ]
  );








  await SeedTable("songCreditType", prisma.songCreditType, [
    {
      "text": "Arranger",
      "description": "",
      "sortOrder": 0,
      "color": null
    },
    {
      "text": "Composer",
      "description": "",
      "sortOrder": 0,
      "color": null
    },
    {
      "text": "Lyrics",
      "description": "",
      "sortOrder": 0,
      "color": null
    }
  ]);

  let instrumentOrder: number = 0;

  // const GenerateInstrumentAndFunctionalGroupSeed = (instrumentName: string, functionalGroupName?: string): Prisma.InstrumentCreateInput => {
  //   functionalGroupName = functionalGroupName || instrumentName;
  //   console.log(`Generating seed for instrument ${instrumentName} and group ${functionalGroupName}, order ${instrumentOrder}`);
  //   instrumentOrder += 10;
  //   return {
  //     name: instrumentName,
  //     sortOrder: instrumentOrder,
  //     functionalGroup: {
  //       connectOrCreate: {
  //         where: {
  //           name: functionalGroupName,
  //         },
  //         create: {
  //           name: functionalGroupName,
  //           description: "",
  //           color: "olive",
  //           sortOrder: instrumentOrder,
  //         },
  //       }
  //     }
  //   };
  // };

  // const instrumentSeed: Prisma.InstrumentCreateInput[] = [
  //   GenerateInstrumentAndFunctionalGroupSeed("Flute"),
  //   GenerateInstrumentAndFunctionalGroupSeed("Clarinet"),
  //   GenerateInstrumentAndFunctionalGroupSeed("Bass Clarinet"),
  //   GenerateInstrumentAndFunctionalGroupSeed("Soprano sax"),
  //   GenerateInstrumentAndFunctionalGroupSeed("Alto sax"),
  //   GenerateInstrumentAndFunctionalGroupSeed("Tenor sax"),
  //   GenerateInstrumentAndFunctionalGroupSeed("Bari sax"),
  //   GenerateInstrumentAndFunctionalGroupSeed("Trumpet"),
  //   GenerateInstrumentAndFunctionalGroupSeed("Tenor Trombone"),
  //   GenerateInstrumentAndFunctionalGroupSeed("Bass Tuba"),
  //   GenerateInstrumentAndFunctionalGroupSeed("Violin"),
  //   GenerateInstrumentAndFunctionalGroupSeed("Accordion"),
  //   GenerateInstrumentAndFunctionalGroupSeed("Guitar"),
  //   GenerateInstrumentAndFunctionalGroupSeed("Snare drum"),
  //   GenerateInstrumentAndFunctionalGroupSeed("Bass drum"),
  //   GenerateInstrumentAndFunctionalGroupSeed("Percussion"),

  //   GenerateInstrumentAndFunctionalGroupSeed("Oboe", "Flute"),
  //   GenerateInstrumentAndFunctionalGroupSeed("Djembe", "Percussion"),
  // ];

  const functionalGroupSeed = [
    {
      "name": "Bass guitar",
      "description": "",
      "color": "dark_gray",
      "sortOrder": 135
    },
    {
      "name": "Oboe",
      "description": "",
      "color": "light_gold",
      "sortOrder": 15
    },
    {
      "name": "Flute",
      "description": "",
      "color": "gold",
      "sortOrder": 10
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
      "name": "Trombone",
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
      "name": "Accordion",
      "description": "",
      "color": "light_green",
      "sortOrder": 120
    },
    {
      "name": "Guitar",
      "description": "",
      "color": "green",
      "sortOrder": 130
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
    }
  ];

  const functionalGroupsResult = await SeedTable("instrumentFunctionalGroup", prisma.instrumentFunctionalGroup, functionalGroupSeed);

  await SeedTable("instrument", prisma.instrument,
    functionalGroupSeed.map(g => ({
      name: g.name,
      slug: slugify(g.name),
      description: "",
      sortOrder: g.sortOrder,
      functionalGroupId: functionalGroupsResult.find(x => x.name === g.name)!.id
    }))
  );

  const adminRoleName = "Admin";
  const publicRoleName = "Public";

  await SeedTable("role", prisma.role,
    [
      {
        "name": "Public",
        "description": "not even logged in",
        "isRoleForNewUsers": false,
        "isPublicRole": true,
        "sortOrder": 0,
        "color": "citron",
        "significance": null
      },
      {
        "name": "Limited Users",
        "description": "logged-in users with no rights",
        "isRoleForNewUsers": true,
        "isPublicRole": false,
        "sortOrder": 10,
        "color": "green",
        "significance": null
      },
      {
        "name": "Normal Users",
        "description": "login with granted normal rights",
        "isRoleForNewUsers": false,
        "isPublicRole": false,
        "sortOrder": 40,
        "color": "blue",
        "significance": null
      },
      {
        "name": "Editors",
        "description": "",
        "isRoleForNewUsers": false,
        "isPublicRole": false,
        "sortOrder": 60,
        "color": "gold",
        "significance": null
      },
      {
        "name": "Moderators",
        "description": "just below site admin",
        "isRoleForNewUsers": false,
        "isPublicRole": false,
        "sortOrder": 80,
        "color": "purple",
        "significance": null
      },
      {
        "name": "Admin",
        "description": "technical admin",
        "isRoleForNewUsers": false,
        "isPublicRole": false,
        "sortOrder": 100,
        "color": "black",
        "significance": null
      }
    ]
  );

  //const codePermissions = PermissionOrdered;Object.values(Permission);
  for (let i = 0; i < gPermissionOrdered.length; ++i) {
    const codePermission = gPermissionOrdered[i]!;
    await prisma.permission.create({
      data: {
        name: codePermission,
        description: `auto-inserted by server`,
        sortOrder: i * 10,
        isVisibility: codePermission.startsWith("visibility_")
      },
    });
  }

  await UpdateTable("permission", "name", prisma.permission, [
    {
      "name": "visibility_editors",
      "description": `Restricted visibility: This is visible only to site editors`,
      //"sortOrder": 1300,
      //"isVisibility": true,
      "color": "orange",
      "iconName": "Lock"
    },
    {
      "name": "visibility_members",
      "description": `Semi-public visibility: this is visible to all members.`,
      // "sortOrder": 1200,
      // "isVisibility": true,
      "color": "gold",
      "iconName": "Security"
    },
    {
      "name": "visibility_logged_in_users",
      "description": `Semi-public visibility: This is visible to all logged-in users`,
      // "sortOrder": 1100,
      // "isVisibility": true,
      "color": "blue",
      "iconName": "Person"
    },
    {
      "name": "visibility_public",
      "description": "Public visibility: Everyone can see this.",
      // "sortOrder": 1000,
      // "isVisibility": true,
      "color": "green",
      "iconName": "Public"
    },
  ]);

  const rolePermissionAssignments =
    [
      ["Public", "always_grant"],
      ["Limited Users", "always_grant"],
      ["Normal Users", "always_grant"],
      ["Editors", "always_grant"],
      ["Moderators", "always_grant"],
      ["Admin", "always_grant"],
      ["Normal Users", "view_events_nonpublic"],
      ["Editors", "view_events_nonpublic"],
      ["Moderators", "view_events_nonpublic"],
      ["Admin", "view_events_nonpublic"],
      ["Public", "public"],
      ["Limited Users", "public"],
      ["Normal Users", "public"],
      ["Editors", "public"],
      ["Moderators", "public"],
      ["Admin", "public"],
      ["Limited Users", "login"],
      ["Normal Users", "login"],
      ["Editors", "login"],
      ["Moderators", "login"],
      ["Admin", "login"],
      ["Limited Users", "basic_trust"],
      ["Normal Users", "basic_trust"],
      ["Editors", "basic_trust"],
      ["Moderators", "basic_trust"],
      ["Admin", "basic_trust"],
      ["Admin", "sysadmin"],
      ["Editors", "content_admin"],
      ["Moderators", "content_admin"],
      ["Admin", "content_admin"],
      ["Admin", "impersonate_user"],
      ["Editors", "visibility_editors"],
      ["Moderators", "visibility_editors"],
      ["Admin", "visibility_editors"],
      ["Normal Users", "visibility_members"],
      ["Editors", "visibility_members"],
      ["Moderators", "visibility_members"],
      ["Admin", "visibility_members"],
      ["Limited Users", "visibility_logged_in_users"],
      ["Normal Users", "visibility_logged_in_users"],
      ["Editors", "visibility_logged_in_users"],
      ["Moderators", "visibility_logged_in_users"],
      ["Admin", "visibility_logged_in_users"],
      ["Public", "visibility_public"],
      ["Limited Users", "visibility_public"],
      ["Normal Users", "visibility_public"],
      ["Editors", "visibility_public"],
      ["Moderators", "visibility_public"],
      ["Admin", "visibility_public"],
      ["Editors", "edit_public_homepage"],
      ["Moderators", "edit_public_homepage"],
      ["Admin", "edit_public_homepage"],
      ["Moderators", "admin_events"],
      ["Admin", "admin_events"],
      ["Editors", "manage_events"],
      ["Moderators", "manage_events"],
      ["Admin", "manage_events"],
      ["Public", "view_events"],
      ["Limited Users", "view_events"],
      ["Normal Users", "view_events"],
      ["Editors", "view_events"],
      ["Moderators", "view_events"],
      ["Admin", "view_events"],
      ["Normal Users", "respond_to_events"],
      ["Editors", "respond_to_events"],
      ["Moderators", "respond_to_events"],
      ["Admin", "respond_to_events"],
      ["Moderators", "admin_songs"],
      ["Admin", "admin_songs"],
      ["Editors", "manage_songs"],
      ["Moderators", "manage_songs"],
      ["Admin", "manage_songs"],
      ["Normal Users", "view_songs"],
      ["Editors", "view_songs"],
      ["Moderators", "view_songs"],
      ["Admin", "view_songs"],
      ["Moderators", "admin_files"],
      ["Admin", "admin_files"],
      ["Editors", "manage_files"],
      ["Moderators", "manage_files"],
      ["Admin", "manage_files"],
      ["Public", "view_files"],
      ["Limited Users", "view_files"],
      ["Normal Users", "view_files"],
      ["Editors", "view_files"],
      ["Moderators", "view_files"],
      ["Admin", "view_files"],
      ["Normal Users", "upload_files"],
      ["Editors", "upload_files"],
      ["Moderators", "upload_files"],
      ["Admin", "upload_files"],
      ["Moderators", "admin_instruments"],
      ["Admin", "admin_instruments"],
      ["Editors", "manage_instruments"],
      ["Moderators", "manage_instruments"],
      ["Admin", "manage_instruments"],
      ["Admin", "admin_users"],
      ["Moderators", "manage_users"],
      ["Admin", "manage_users"],
      ["Normal Users", "view_custom_links"],
      ["Editors", "view_custom_links"],
      ["Moderators", "view_custom_links"],
      ["Admin", "view_custom_links"],
      ["Editors", "manage_custom_links"],
      ["Moderators", "manage_custom_links"],
      ["Admin", "manage_custom_links"]
    ]
    ;

  console.log(`Seeding role-permission assignments`);
  for (let i = 0; i < rolePermissionAssignments.length; ++i) {
    const assignment = rolePermissionAssignments[i]!;
    const role = await prisma.role.findFirstOrThrow({
      where: { name: assignment[0] }
    });
    const permission = await prisma.permission.findFirstOrThrow({
      where: { name: assignment[1] }
    });
    const ass = await prisma.rolePermission.create({
      data: {
        permissionId: permission.id,
        roleId: role.id,
      }
    });
    console.log(`-> assId:${ass.id} ${role.id}(${role.name}) - ${permission.id}(${permission.name})`);
  }


  // // grant all perms to admin
  // const adminRole = await prisma.role.findFirst({ where: { name: adminRoleName } });
  // if (!adminRole) throw new Error(`why wasn't the admin role created??? changed the way you seed roles maybe?`);
  // const allPermissions = await prisma.permission.findMany();

  // for (const perm of allPermissions) {
  //   await prisma.rolePermission.create({
  //     data: {
  //       permissionId: perm.id,
  //       roleId: adminRole.id,
  //     }
  //   });
  // }

  // todo: grant public perms to public, remaining mappings
  // 

  await SeedTable("setting", prisma.setting,
    [
      {
        "name": "EnableNewPublicHomepageBackstageLink",
        "value": "0"
      },
      {
        "name": "EnableOldPublicHomepageBackstageLink",
        "value": "1"
      },
      {
        "name": "EditEventDialogDescription",
        "value": "edit events here."
      },
      {
        "name": "EventSegment",
        "value": "The time span for this segment. \"TBD\" = \"To be decided\""
      },
      {
        "name": "EventSegment.startsAt.DescriptionMarkdown",
        "value": "srsrchsrch"
      },
      {
        "name": "File.visiblePermission.SelectStyle",
        "value": "inline"
      },
      {
        "name": "MarkdownHelpPage",
        "value": "\n\"Markdown\" is a way of adding basic formatting and rich content to text.\n\n[Click here for markdown syntax guide](https://www.markdownguide.org/basic-syntax/)"
      },
      {
        "name": "NewEventSegmentDialogDescription",
        "value": "\"Segments\" are subdivisions of events, so people can specify they're coming only to a part of the show. For example the Weekend this could be one \"segment\" per day. Or for a concert with multiple sets. For simplicity, only create more segments when it's important to know if people can only attend for part of the event."
      },
      {
        "name": "NewEventSegmentDialogTitle",
        "value": "Edit event segment"
      },
      {
        "name": "Song.visiblePermission.SelectStyle",
        "value": "inline"
      },
      {
        "name": "event.expectedAttendanceUserTag.SelectStyle",
        "value": "inline"
      },
      {
        "name": "event.status.SelectStyle",
        "value": "inline"
      },
      {
        "name": "event.type.SelectStyle",
        "value": "inline"
      },
      {
        "name": "event.visiblePermission.SelectStyle",
        "value": "inline"
      },
      {
        "name": "eventSegmentUserResponse.attendance.SelectStyle",
        "value": "inline"
      },
      {
        "name": "info_text",
        "value": "todo: general info about Café Marché or this website here."
      },
      {
        "name": "profile_markdown",
        "value": "here's your profile; check it out."
      },
      {
        "name": "songCredit.type.SelectStyle",
        "value": "inline"
      },
      {
        "name": "textPalette",
        "value": "#000\n#444\n#666\n#888\n#aaa\n#ccc\n#ddd\n#eee\n#fff\n\n-\n// near-black\n-- // {\"c\":[\"hsl(232deg 17% 50%)\",\"white\",\"black\"],\"m\":\"lab\",\"z\":2,\"op\":\"column rev\"}\nx#000000\nx#262732\n#474a61\n#6a7095\n\n;-- // {\"c\":[\"hsl(232deg 17% 50%)\",\"white\",\"black\"],\"m\":\"lab\",\"z\":7,\"op\":\"row\"}\nx#7c81a2\n#8e92af\nx#a0a3bc\n#b3b5c9\nx#c6c7d6\n#d8d9e4\nx#ececf1\n\n\n// lime green\n\n-- // {\"c\":[\"hsl(72deg 100% 35%)\",\"white\",\"black\"],\"m\":\"lab\",\"z\":3,\"op\":\"TL\"}\nx#272d10\n#475614\n#6a8311\n#8fb300\n#afc657\n#ccd98f\n#e6ecc7\n\n// green\n-- // {\"c\":[\"hsl(120deg 100% 35%)\",\"white\",\"black\"],\"m\":\"lab\",\"z\":3,\"op\":\"TL\"}\nx#152d0f\n#1b5613\n#198310\n#00b300\n#69c755\n#a0db8e\n#d0edc6\n\n// teal\n;-- // {\"c\":[\"hsl(173deg 100% 35%)\",\"white\",\"black\"],\"m\":\"lab\",\"z\":3,\"op\":\"TL\"}\nx#152d28\n#1b564d\n#198374\n#00b39e\n#68c7b5\n#9edacd\n#cfede6\n\n// blue\n-- // {\"c\":[\"hsl(212deg 100% 50%)\",\"white\",\"black\"],\"m\":\"lab\",\"z\":3,\"op\":\"TL\"}\nx#19203c\n#213b77\n#1f58b9\n#0077ff\n#7696ff\n#abb8ff\n#d7dbff\n\n// purple\n;-- // {\"c\":[\"#92d\",\"white\",\"black\"],\"m\":\"lab\",\"z\":3,\"op\":\"TL\"}\nx#291435\n#4c1c69\n#7221a1\n#9922dd\n#b865e7\n#d399f0\n#eaccf8\n\n\n\n\n-- // {\"c\":[\"#e00000\",\"white\",\"black\"],\"m\":\"rgb\",\"z\":5,\"op\":\"TL\"}\n;#4b0000\n#600000\n;#950000\n#900\n#e00000\n#f77\n#faa\n#fdd\n;#ea5555\n;#f08080\n;#f5aaaa\n;#fad5d5\n\n\n\n// maroon\n;-- // {\"c\":[\"hsl(342deg 60% 50%)\",\"white\",\"black\"],\"m\":\"lab\",\"z\":3,\"op\":\"TL\"}\nx#33161c\n#622131\n#962b49\n#cc3361\n#df6e86\n#ee9fac\n#f9cfd5\n\n\n// orange\n- // {\"c\":[\"#f70\",\"white\",\"black\"],\"m\":\"lab\",\"z\":3,\"op\":\"TL\"}\nx#3e210e\n#793c11\n#ba590e\n#ff7700\n#ff9a51\n#ffbc8a\n#ffddc4\n\n\n// brown\n// interestingly generated by\n// taking diag from\n// {\"c\":[\"red\",\"white\",\"black\",\"green\"],\"m\":\"lab\",\"z\":3,\"op\":\"diagBL\"}\n\n;-- // {\"c\":[\"hsl(36deg 46% 50%)\",\"white\",\"black\"],\"m\":\"lab\",\"z\":3,\"op\":\"TL\"}\nx#2f2517\n#5a4426\n#886635\n#ba8b45\n#cea772\n#e1c3a0\n#f1e1cf\n\n\n// ochre yellow\n-- // {\"c\":[\"#fc0\",\"white\",\"black\"],\"m\":\"lab\",\"z\":3,\"op\":\"TL\"}\nx#3d3112\n#786117\n#ba9415\n#ffcc00\n#ffd85f\n#ffe596\n#fff2cb\n\n// light yellow\n// {\"c\":[\"#ef0\",\"white\",\"black\"],\"m\":\"lab\",\"z\":3,\"op\":\"TL\"}\nx#3a3b15\n#71771b\n#adb918\n#eeff00\nx#f7ff67\n#fdff9d\nx#ffffcf\n"
      }
    ]
  );


  await SeedTable("userTag", prisma.userTag,
    [
      {
        "text": "board",
        "description": "",
        "sortOrder": 0,
        "color": "light_teal",
        "significance": null
      },
      {
        "text": "board",
        "description": "",
        "sortOrder": 0,
        "color": "light_teal",
        "significance": null
      },
      {
        "text": "musician",
        "description": "",
        "sortOrder": 0,
        "color": "light_teal",
        "significance": null
      }
    ]
  );

}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

