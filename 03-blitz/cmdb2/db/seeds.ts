import { PrismaClient, Prisma } from '@prisma/client'
import { Permission } from '../shared/permissions'
const prisma = new PrismaClient()




const SeedTable = async <Ttable extends { create: (inp: { data: TuncheckedCreateInput }) => any }, TuncheckedCreateInput>(tableName: string, table: Ttable, items: TuncheckedCreateInput[]) => {
  for (let i = 0; i < items.length; ++i) {
    const ret = await table.create({
      data: items[i]!
    });

    if (ret.name) {
      console.log(`created '${tableName}': { name:'${ret.name}', id: '${ret.id}'}`);
    } else if (ret.text) {
      console.log(`created '${tableName}': { text:'${ret.text}', id: '${ret.id}'}`);
    } else {
      console.log(`created '${tableName}': { id: '${ret.id}'}`);
    }
  }
};


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

  await SeedTable("eventStatus", prisma.eventStatus, [
    {
      "isDeleted": false,
      "label": "Cancelled",
      "description": "",
      "sortOrder": 100,
      "color": null,
      "significance": "Cancelled",
      "iconName": "Cancel"
    },
    {
      "isDeleted": false,
      "label": "Confirmed",
      "description": "",
      "sortOrder": 50,
      "color": null,
      "significance": "FinalConfirmation",
      "iconName": "Schedule"
    },
    {
      "isDeleted": false,
      "label": "Checking musician availability",
      "description": "",
      "sortOrder": 30,
      "color": null,
      "significance": null,
      "iconName": "Campaign"
    },
    {
      "isDeleted": false,
      "label": "New",
      "description": "The initial status for events before any confirmations or actions.",
      "sortOrder": 0,
      "color": null,
      "significance": "New",
      "iconName": "AutoAwesome"
    }
  ]);

  await SeedTable("eventType", prisma.eventType, [
    {
      "isDeleted": false,
      "text": "Concert",
      "description": "",
      "sortOrder": 0,
      "color": null,
      "significance": "Concert",
      "iconName": "MusicNote"
    },
    {
      "isDeleted": false,
      "text": "Rehearsal",
      "description": "",
      "sortOrder": 0,
      "color": null,
      "significance": "Rehearsal",
      "iconName": "MusicNote"
    },
    {
      "isDeleted": false,
      "text": "Weekend",
      "description": "",
      "sortOrder": 0,
      "color": null,
      "significance": "Weekend",
      "iconName": null
    }
  ]);


  await SeedTable("eventAttendance", prisma.eventAttendance, [
    {
      "text": "Going!",
      "personalText": "You're going!",
      "description": "",
      "color": null,
      "strength": 100,
      "sortOrder": 100,
      "isDeleted": false
    },
    {
      "text": "Probably going",
      "personalText": "you're probably going",
      "description": "",
      "color": null,
      "strength": 66,
      "sortOrder": 66,
      "isDeleted": false
    },
    {
      "text": "Probably not going",
      "personalText": "you're probably not going",
      "description": "",
      "color": null,
      "strength": 33,
      "sortOrder": 33,
      "isDeleted": false
    },
    {
      "text": "Not going",
      "personalText": "you're not going",
      "description": "",
      "color": null,
      "strength": 0,
      "sortOrder": 0,
      "isDeleted": false
    }
  ]);

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

  const GenerateInstrumentAndFunctionalGroupSeed = (instrumentName: string, functionalGroupName?: string): Prisma.InstrumentCreateInput => {
    functionalGroupName = functionalGroupName || instrumentName;
    console.log(`Generating seed for instrument ${instrumentName} and group ${functionalGroupName}, order ${instrumentOrder}`);
    instrumentOrder += 10;
    return {
      name: instrumentName,
      sortOrder: instrumentOrder,
      functionalGroup: {
        connectOrCreate: {
          where: {
            name: functionalGroupName,
          },
          create: {
            name: functionalGroupName,
            description: "",
            color: null,
            sortOrder: instrumentOrder,
          },
        }
      }
    };
  };

  const instrumentSeed: Prisma.InstrumentCreateInput[] = [
    GenerateInstrumentAndFunctionalGroupSeed("Flute"),
    GenerateInstrumentAndFunctionalGroupSeed("Clarinet"),
    GenerateInstrumentAndFunctionalGroupSeed("Bass Clarinet"),
    GenerateInstrumentAndFunctionalGroupSeed("Soprano sax"),
    GenerateInstrumentAndFunctionalGroupSeed("Alto sax"),
    GenerateInstrumentAndFunctionalGroupSeed("Tenor sax"),
    GenerateInstrumentAndFunctionalGroupSeed("Bari sax"),
    GenerateInstrumentAndFunctionalGroupSeed("Trumpet"),
    GenerateInstrumentAndFunctionalGroupSeed("Tenor Trombone"),
    GenerateInstrumentAndFunctionalGroupSeed("Bass Tuba"),
    GenerateInstrumentAndFunctionalGroupSeed("Violin"),
    GenerateInstrumentAndFunctionalGroupSeed("Accordion"),
    GenerateInstrumentAndFunctionalGroupSeed("Guitar"),
    GenerateInstrumentAndFunctionalGroupSeed("Snare drum"),
    GenerateInstrumentAndFunctionalGroupSeed("Bass drum"),
    GenerateInstrumentAndFunctionalGroupSeed("Percussion"),

    GenerateInstrumentAndFunctionalGroupSeed("Oboe", "Flute"),
    GenerateInstrumentAndFunctionalGroupSeed("Djembe", "Percussion"),
  ];

  await SeedTable("instrument", prisma.instrument, instrumentSeed);

  const adminRoleName = "Admin";

  await SeedTable("role", prisma.role, [
    {
      "name": adminRoleName,
      "description": "technical admin",
      "isRoleForNewUsers": false,
      "sortOrder": 100
    },
    {
      "name": "Moderators",
      "description": "just below site admin",
      "isRoleForNewUsers": false,
      "sortOrder": 80
    },
    {
      "name": "Editors",
      "description": "",
      "isRoleForNewUsers": false,
      "sortOrder": 60
    },
    {
      "name": "Normal Users",
      "description": "login with granted normal rights",
      "isRoleForNewUsers": false,
      "sortOrder": 40
    },
    {
      "name": "Limited Users",
      "description": "logged-in users with no rights",
      "isRoleForNewUsers": true,
      "sortOrder": 10
    },
    {
      "name": "Public",
      "description": "not even logged in",
      "isRoleForNewUsers": false,
      "sortOrder": 0
    }
  ]);

  for (const codePermission of Object.values(Permission)) {
    await prisma.permission.create({
      data: {
        name: codePermission,
        description: `auto-inserted by server`,
        isVisibility: codePermission.startsWith("visibility_")
      },
    });
  }

  await UpdateTable("permission", "name", prisma.permission, [
    {
      "name": "visibility_editors",
      "description": `Restricted visibility: This is visible only to site editors`,
      "sortOrder": 130,
      "isVisibility": true,
      "color": null,
      "iconName": "Lock"
    },
    {
      "name": "visibility_members",
      "description": `Semi-public visibility: this is visible to all members.`,
      "sortOrder": 120,
      "isVisibility": true,
      "color": null,
      "iconName": "Public"
    },
    {
      "name": "visibility_logged_in_users",
      "description": `Semi-public visibility: This is visible to all logged-in users`,
      "sortOrder": 110,
      "isVisibility": true,
      "color": null,
      "iconName": "Public"
    },
    {
      "name": "visibility_public",
      "description": "Public visibility: Everyone can see this.",
      "sortOrder": 100,
      "isVisibility": true,
      "color": null,
      "iconName": "Public"
    },
  ]);

  // grant all perms to admin
  const adminRole = await prisma.role.findFirst({ where: { name: adminRoleName } });
  if (!adminRole) throw new Error(`why wasn't the admin role created??? changed the way you seed roles maybe?`);
  const allPermissions = await prisma.permission.findMany();

  for (const perm of allPermissions) {
    await prisma.rolePermission.create({
      data: {
        permissionId: perm.id,
        roleId: adminRole.id,
      }
    });
  }

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

