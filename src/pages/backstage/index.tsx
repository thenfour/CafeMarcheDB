import { CMSmallButton, KeyValueTable } from "@/src/core/components/CMCoreComponents2";
import { useMediaPlayer } from "@/src/core/components/mediaPlayer/MediaPlayerContext";
import { BlitzPage } from "@blitzjs/next";
import { Suspense } from "react";
import { Permission } from "shared/permissions";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { AppContextMarker } from "src/core/components/AppContext";
import { CMSinglePageSurfaceCard, PermissionBoundary } from "src/core/components/CMCoreComponents";
import { useDashboardContext } from "src/core/components/DashboardContext";
import { BigEventCalendar } from "src/core/components/EventCalendar";
import { RelevantEvents } from "src/core/components/RelevantEvents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { WikiStandaloneControl } from "src/core/components/WikiStandaloneComponents";
import { gIconMap } from "src/core/db3/components/IconMap";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const HomepageBigEventCalendar = () => {
  const dashboardContext = useDashboardContext();
  if (!dashboardContext) return null;
  return <BigEventCalendar />;
  //return <BigEventCalendar selectedEventId={dashboardContext.relevantEventIds[0]} />;
};

const MediaPlayerTest = () => {
  const mediaPlayer = useMediaPlayer();

  return (<div>
    <CMSmallButton
      onClick={() => {
        mediaPlayer.playUri(`https://citizen-dj.labs.loc.gov/audio/samplepacks/loc-fma/Chillin-Poupi_fma-169768_002_00-00-31.mp3`);
      }}
    >
      [sample A]
    </CMSmallButton>
    <CMSmallButton
      onClick={() => {
        mediaPlayer.playUri(`https://cafemarche.be/api/files/download/o0Faqsf5AnnWlFrxSpAWh.mp3/the-scout.mp3`);
      }}
    >
      [sample B]
    </CMSmallButton>
    <CMSmallButton
      onClick={() => {
        mediaPlayer.setPlaylist([
          {
            url: `https://citizen-dj.labs.loc.gov/audio/samplepacks/loc-fma/Chillin-Poupi_fma-169768_002_00-00-31.mp3`,
          },
          {
            url: `https://cafemarche.be/api/files/download/o0Faqsf5AnnWlFrxSpAWh.mp3/the-scout.mp3`,
          },
        ], undefined);
      }}
    >
      [sample 2-song playlist]
    </CMSmallButton>
    <CMSmallButton onClick={() => {
      mediaPlayer.unpause();
    }}>play</CMSmallButton>
    <CMSmallButton onClick={() => {
      mediaPlayer.pause();
    }}>pause</CMSmallButton>
    <CMSmallButton onClick={() => {
      mediaPlayer.setPlaylist([], undefined);
    }}>
      {"clear playlist"}
    </CMSmallButton>
    <KeyValueTable
      data={{
        "playlist length": mediaPlayer.playlist.length,
        "current index": mediaPlayer.currentIndex,
        "is playing": mediaPlayer.isPlaying,
        "audio time": mediaPlayer.playheadSeconds.toFixed(2),
        "audio duration": mediaPlayer.lengthSeconds.toFixed(2),
      }}
    />
  </div>
  );
}

const DynamicContent = () => {
  const [currentUser] = useCurrentUser();
  let noInstrumentsWarning = (currentUser?.instruments?.length || 0) < 1;
  let limitedAccountWarning = !!(currentUser?.role?.isRoleForNewUsers);

  return (<Suspense>
    <AppContextMarker name="backstage home">

      {limitedAccountWarning && <CMSinglePageSurfaceCard className="noInstrumentsWarning">
        <div>{gIconMap.ErrorOutline()}</div>
        <div>Your account has limited access; please contact a site admin to grant you access 😊.
        </div>
      </CMSinglePageSurfaceCard>}

      {noInstrumentsWarning && <CMSinglePageSurfaceCard className="noInstrumentsWarning">
        <div>{gIconMap.ErrorOutline()}</div>
        <div>You have no instruments assigned; please go to
          &nbsp;<a href="/backstage/profile">your profile</a>&nbsp;
          and specify your instruments.
        </div>
      </CMSinglePageSurfaceCard>}

      <div className="DashboardHeader">
        <SettingMarkdown setting="BackstageFrontpageHeaderMarkdown" />
      </div>
      <MediaPlayerTest />

      <WikiStandaloneControl
        canonicalWikiPath="special/announcements"
        className="contentSection announcementMarkdown"
        floatingHeader={true}
      />

      <PermissionBoundary permission={Permission.view_events_nonpublic}>
        <RelevantEvents />
        <HomepageBigEventCalendar />
      </PermissionBoundary>

      <SettingMarkdown setting="BackstageFrontpageMarkdown" />

    </AppContextMarker>
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
