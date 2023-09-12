import { BlitzPage } from "@blitzjs/next";
import { Button, Card, CardActionArea, CardActions, CardContent, Typography } from "@mui/material";
import { CalendarIcon } from "@mui/x-date-pickers";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { EventAttendanceAlertControl, NoninteractiveCardEvent } from "src/core/components/CMEventComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { API } from "src/core/db3/clientAPI";
import { gIconMap } from "src/core/db3/components/IconSelectDialog";
import DashboardLayout from "src/core/layouts/DashboardLayout";

{/* <MockupEventCard /> */ }
{/* <EventCard />
        <RehearsalCard />
        <EventCard /> */}

const DynamicContent = () => {

  const events = API.events.useGetEvents({});

  // what needs alerts?
  // events which expect your response but you haven't responded.
  // but also, when you answer, don't make the alert go away immediately.

  return (<>
    {/* <CMSinglePageSurface>
      <SettingMarkdown settingName="root_markdown" />
    </CMSinglePageSurface> */}

    {/* <CMSinglePageSurface> */}
    {events.items.map((row, index) => <EventAttendanceAlertControl
      key={index}
      event={row as any}
      onRefetch={() => { events.refetch() }}
    />)}
    {/* </CMSinglePageSurface > */}
    {/* 
    <CMSinglePageSurface>
      <h1>{gIconMap.CalendarMonth()} Events</h1>

      {events.items.map((row, index) => <NoninteractiveCardEvent key={index} event={row as any} />)}

    </CMSinglePageSurface > */}

    {/* 
    <CMSinglePageSurfaceCard>
      <CardContent>
        <SettingMarkdown settingName="root_markdown" />
      </CardContent>
    </CMSinglePageSurfaceCard> */}

    <CMSinglePageSurfaceCard>
      <CardContent>
        <Typography gutterBottom variant="h4" component="div">
          {gIconMap.MusicNote()} Songs
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Listen to recordings, view partitions, see set lists
        </Typography>
      </CardContent>
      <CardActions>
        <Button size="small">Share</Button>
        <Button size="small">Learn More</Button>
      </CardActions>
    </CMSinglePageSurfaceCard>

    <CMSinglePageSurfaceCard>
      <CardContent>
        <Typography gutterBottom variant="h4" component="div">
          {gIconMap.CalendarMonth()} Upcoming Events
        </Typography>
        <div className="cmcardList-vertical">
          {events.items.map((row, index) => <NoninteractiveCardEvent key={index} event={row as any} />)}
        </div>
      </CardContent>
    </CMSinglePageSurfaceCard>

    {/* {events.items.map((row, index) => <NoninteractiveCardEvent key={index} event={row as any} />)} */}

  </>
  )
};

const Home: BlitzPage = () => {
  return (
    <DashboardLayout title="Home">
      <DynamicContent />
    </DashboardLayout>
  )
}

// authenticate only works when boolean.
// https://github.com/blitz-js/blitz/issues/4155
// Home.authenticate = true;// { role: [Permission.can_edit_users] };

export default Home;
