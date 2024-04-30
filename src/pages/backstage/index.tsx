import { BlitzPage } from "@blitzjs/next";
import { EventDashboard } from "src/core/components/EventComponents";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import React, { Suspense } from "react";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { gIconMap } from "src/core/db3/components/IconSelectDialog";
import { useRouter } from "next/router";
import { CurrentSongsDashboard, CurrentSongsDashboardItem } from "src/core/components/SongComponents";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from "src/core/db3/clientAPI";
import { DateSubtractInDays, Timing, floorLocalToLocalDay } from "shared/time";
import { Tab, Tabs } from "@mui/material";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { Permission } from "shared/permissions";
import { DebugCollapsibleText } from "src/core/components/CMCoreComponents2";


// const DashboardInner = () => {
//   const [currentUser] = useCurrentUser();
//   const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary', currentUser };
//   const eventMaxAge = API.settings.useNumberSetting("BackstageFrontpageEventMaxAgeDays", 6); // expire after 1 week ago (so you don't see multiple rehearsals)
//   const currentSongMaxAge = API.settings.useNumberSetting("BackstageFrontpageCurrentSongMaxAgeDays", 13); // expire after 2 weeks ago
//   const queryMaxAge = Math.max(eventMaxAge, currentSongMaxAge);
//   const today = floorLocalToLocalDay(new Date());
//   const minDate = floorLocalToLocalDay(new Date()); // avoid tight loop where date changes every render, by flooring to day.
//   const futureDate = floorLocalToLocalDay(new Date());

//   const [selectedTab, setSelectedTab] = React.useState<"songs" | "events">("events");

//   minDate.setDate(minDate.getDate() - queryMaxAge);
//   futureDate.setDate(futureDate.getDate() + 365);

//   const eventsTableParams: db3.EventTableParams = {
//     minDate,
//   };

//   if (!useAuthorization("backstage dashboard - events", Permission.view_events_nonpublic)) {
//     return null;
//   }
//   if (!useAuthorization("backstage dashboard - songs", Permission.view_songs)) {
//     return null;
//   }


//   const eventsClient = DB3Client.useTableRenderContext({
//     tableSpec: new DB3Client.xTableClientSpec({
//       table: db3.xEventVerbose,
//       columns: [
//         new DB3Client.PKColumnClient({ columnName: "id" }),
//       ],
//     }),
//     filterModel: {
//       items: [],
//       tableParams: eventsTableParams,
//     },
//     requestedCaps: DB3Client.xTableClientCaps.Query,
//     clientIntention,
//   });

//   const events = eventsClient.items as db3.EventClientPayload_Verbose[];

//   //console.log(`------------------`);

//   const currentSongs: CurrentSongsDashboardItem[] = [];
//   const currentEvents: db3.EventClientPayload_Verbose[] = [];
//   for (var i = 0; i < events.length; ++i) {
//     const event = events[i]!;
//     const eventDate = event.endDateTime || futureDate; // fallback to date; makes calculation simpler
//     const eventAgeDays = DateSubtractInDays(today, eventDate);
//     const timing = API.events.getEventTiming(event);

//     //console.log(`event ${event.name} is age ${eventAgeDays}`);

//     if (eventAgeDays < eventMaxAge) {
//       currentEvents.push(event);
//     }

//     // calculate song
//     for (var isl = 0; isl < event.songLists.length; ++isl) {
//       const songList = event.songLists[isl]!;
//       for (var ientry = 0; ientry < songList.songs.length; ++ientry) {
//         const entry = songList.songs[ientry]!;
//         const song = entry.song;
//         const existingIndex = currentSongs.findIndex(s => s.songId === song.id);
//         if (existingIndex === -1) {
//           // new song to add
//           currentSongs.push({
//             songId: song.id,
//             mostRecentAppearance: eventDate,
//             appearsInPresentOrFutureEvents: (timing === Timing.Future) || (timing === Timing.Present),
//             appearsInEvents: [event],
//           });
//         } else {
//           const existing = currentSongs[existingIndex]!;
//           if (eventDate > existing.mostRecentAppearance) existing.mostRecentAppearance = eventDate;
//           // also make sure we don't register the event multiple times
//           if (!existing.appearsInEvents.some(e => e.id === event.id)) {
//             existing.appearsInEvents.push(event);
//           }
//         }
//       }
//     }
//   }

//   // take only songs of certain max age
//   const currentSongsFiltered = currentSongs.filter(s => {
//     if (s.appearsInPresentOrFutureEvents) return true;
//     const ageDays = DateSubtractInDays(today, s.mostRecentAppearance);
//     return (ageDays <= currentSongMaxAge);
//   });

//   // sort by if it's future or not, then by usages
//   currentSongsFiltered.sort((a, b) => {
//     if (a.appearsInPresentOrFutureEvents !== b.appearsInPresentOrFutureEvents) {
//       return a.appearsInPresentOrFutureEvents ? -1 : 1;
//     }
//     return a.appearsInEvents.length - b.appearsInEvents.length;
//   });

//   // sort events from old (closest to now) to new
//   currentEvents.sort((a, b) => {
//     if (a.startsAt === null || b.startsAt === null) {
//       return a.startsAt === null ? 1 : -1;
//     }
//     return a.startsAt!.valueOf() - b.startsAt!.valueOf();
//   });

//   return <div className="dashboardStatsContainer">

//     <Tabs
//       className="dashboardStatsTabButtonContainer"
//       value={selectedTab}
//       onChange={(e, v) => setSelectedTab(v as any)}
//     >
//       <Tab label="What's on the agenda?" value={"events"} />
//       <Tab label="What are we playing?" value={"songs"} />
//     </Tabs>

//     {selectedTab === "songs" && <div className="dashboardStatsTabContent songs">
//       <SettingMarkdown setting="DashboardStats_SongsMarkdown" />
//       <CurrentSongsDashboard songs={currentSongs} />
//     </div>
//     }

//     {selectedTab === "events" && <div className="dashboardStatsTabContent events">
//       <SettingMarkdown setting="DashboardStats_EventsMarkdown" />
//       <EventDashboard items={currentEvents} tableClient={eventsClient} />
//     </div>
//     }


//   </div>;
// };


const DynamicContent = () => {
  const [currentUser] = useCurrentUser();
  let noInstrumentsWarning = (currentUser?.instruments?.length || 0) < 1;
  let limitedAccountWarning = !!(currentUser?.role?.isRoleForNewUsers);

  return (<Suspense>
    <SettingMarkdown setting="BackstageFrontpageMarkdown" />

    {limitedAccountWarning && <CMSinglePageSurfaceCard className="noInstrumentsWarning">
      <div>{gIconMap.ErrorOutline()}</div>
      <div>By default your account has limited access. Please contact an admin to gain access to all site features.
      </div>
    </CMSinglePageSurfaceCard>}

    {noInstrumentsWarning && <CMSinglePageSurfaceCard className="noInstrumentsWarning">
      <div>{gIconMap.ErrorOutline()}</div>
      <div>You have no instruments assigned; please go to
        &nbsp;<a href="/backstage/profile">your profile</a>&nbsp;
        and specify your instruments.
      </div>
    </CMSinglePageSurfaceCard>}


    {/* <DashboardInner /> */}
  </Suspense>
  )
};

const Home: BlitzPage = () => {
  return (
    <DashboardLayout title="Home">
      <DynamicContent />
    </DashboardLayout>
  )
}

export default Home;
