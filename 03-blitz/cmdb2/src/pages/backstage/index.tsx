import { BlitzPage } from "@blitzjs/next";
import { Button, Card, CardActionArea, CardActions, CardContent, Typography } from "@mui/material";
import { CalendarIcon } from "@mui/x-date-pickers";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { EventAttendanceAlertControl } from "src/core/components/EventAttendanceComponents";
import { NoninteractiveCardEvent } from "src/core/components/EventComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { API } from "src/core/db3/clientAPI";
import { gIconMap } from "src/core/db3/components/IconSelectDialog";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";

{/* <MockupEventCard /> */ }
{/* <EventCard />
        <RehearsalCard />
        <EventCard /> */}

const DynamicContent = () => {

  const tableClient = DB3Client.useTableRenderContext({
    requestedCaps: DB3Client.xTableClientCaps.Mutation | DB3Client.xTableClientCaps.Query,
    clientIntention: { intention: "user", mode: 'primary' },
    tableSpec: new DB3Client.xTableClientSpec({
      table: db3.xEvent,
      columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
      ],
    }),


  });


  // what needs alerts?
  // events which expect your response but you haven't responded.
  // but also, when you answer, don't make the alert go away immediately.

  return (<>

    {/* <CMSinglePageSurface>
      <SettingMarkdown settingName="root_markdown" />
    </CMSinglePageSurface> */}

    {/* <CMSinglePageSurface> */}
    {(tableClient.items as db3.EventPayloadClient[]).filter(event => event.segments.length > 0).map((row, index) => <EventAttendanceAlertControl
      key={index}
      event={row as any}
      onRefetch={tableClient.refetch}
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
      <div className="content">
        <Typography gutterBottom variant="h4" component="div">
          {gIconMap.MusicNote()} Songs
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Listen to recordings, view partitions, see set lists
        </Typography>
      </div>
      <Button size="small">Share</Button>
      <Button size="small">Learn More</Button>
    </CMSinglePageSurfaceCard>

    <CMSinglePageSurfaceCard>
      <div className="content">
        <Typography gutterBottom variant="h4" component="div">
          {gIconMap.CalendarMonth()} Upcoming Events
        </Typography>
        <div className="cmcardList-vertical">
          {tableClient.items.map((row, index) => <NoninteractiveCardEvent key={index} event={row as any} />)}
        </div>
      </div>
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
