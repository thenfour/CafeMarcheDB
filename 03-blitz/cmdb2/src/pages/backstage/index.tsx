import { BlitzPage } from "@blitzjs/next";
import { CMSinglePageSurface, EventAttendanceAlertControl, NoninteractiveCardEvent } from "src/core/components/CMCoreComponents";
import { API } from "src/core/db3/clientAPI";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const DynamicContent = () => {

  const events = API.events.useGetEvents({});

  return (
    <CMSinglePageSurface>
      <h1>Upcoming Events</h1>

      {events.items.map((row, index) => <EventAttendanceAlertControl
        key={index}
        event={row as any}
        onRefetch={() => { events.refetch() }}
      />)}

      {/* <MockupEventCard /> */}
      {events.items.map((row, index) => <NoninteractiveCardEvent key={index} event={row as any} />)}
      <h1>Recent Events</h1>
      {/* <EventCard />
        <RehearsalCard />
        <EventCard /> */}

    </CMSinglePageSurface >
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
