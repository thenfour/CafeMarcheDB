import { BlitzPage } from "@blitzjs/next";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import React, { FC, Suspense } from "react"
import { DateCalendar, PickersDay, PickersDayProps } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { Alert, Button, ButtonGroup, Card, CardActionArea, CardActions, CardContent, CardMedia, Chip, Link, Paper, Stack, TextField, Typography } from "@mui/material";
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbsUpDownIcon from '@mui/icons-material/ThumbsUpDown';
import styled from "@emotion/styled";
import {
  DeleteOutlined as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import CheckIcon from '@mui/icons-material/Check';
import { EventAttendanceResponseInput, MockupEventCard } from "src/core/components/CMMockupComponents";
import { CMSinglePageSurface, NoninteractiveCardEvent } from "src/core/components/CMCoreComponents";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";

const applyDateRangeToEvent = () => {

};


const DynamicContent = () => {

  const tableSpec = new DB3Client.xTableClientSpec({
    table: db3.xEvent,
    columns: [
      new DB3Client.PKColumnClient({ columnName: "id" }),
      // new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 150 }),
      // new DB3Client.SlugColumnClient({ columnName: "slug", cellWidth: 150 }),
      // new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 150 }),
      //new DB3Client.BoolColumnClient({ columnName: "isPublished" }),
      //new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
      // new DB3Client.BoolColumnClient({ columnName: "isCancelled" }),
      // new DB3Client.GenericStringColumnClient({ columnName: "locationDescription", cellWidth: 150 }),
      // new DB3Client.GenericStringColumnClient({ columnName: "locationURL", cellWidth: 150 }),
      //new DB3Client.DateTimeColumn({ columnName: "cancelledAt", cellWidth: 150 }),
      //new DB3Client.CreatedAtColumn({ columnName: "createdAt", cellWidth: 150 }),
      // new DB3Client.ForeignSingleFieldClient<db3.EventTypePayload>({ columnName: "type", cellWidth: 150 }),
      // new DB3Client.ForeignSingleFieldClient<db3.EventStatusPayload>({ columnName: "status", cellWidth: 150 }),
      // new DB3Client.TagsFieldClient<db3.EventTagAssignmentModel>({ columnName: "tags", cellWidth: 150 }),
    ],
  });

  const tableClient = DB3Client.useTableRenderContext({
    requestedCaps: DB3Client.xTableClientCaps.Query,
    tableSpec,
    filterModel: {
      items: [
        { operator: "equals", field: "isDeleted", value: false },
        { operator: "equals", field: "isPublished", value: true },
      ]
    },
    paginationModel: {
      page: 0,
      pageSize: 15,
    },
  });

  // process the data payload.
  // calculate date ranges & order by date; split into future & past events
  // published

  return (
    <CMSinglePageSurface>
      <h1>Upcoming Events</h1>
      <Alert severity="error">
        <h1>Are you coming to <a href="#">Esperanzah 2023</a>?</h1>
        {/* <Link>View event details...</Link> */}
        <EventAttendanceResponseInput finalized={false} past={false} segmentCount={2} />
      </Alert>
      <MockupEventCard />
      {
        tableClient.items.map((row, index) => <NoninteractiveCardEvent key={index} event={row as any} />)
      }
      {/* 
        
        <EventCard /> */}

      <h1>Recent Events</h1>
      {/* <EventCard />
        <RehearsalCard />
        <EventCard /> */}

    </CMSinglePageSurface>
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
