import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthenticatedSession, useAuthorizeIf } from "@blitzjs/auth";
import { CMDBRolesIsAuthorized, CMAuthorize } from "types";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { Grid, Paper, TextField } from "@mui/material";
import React from "react";

const Home: BlitzPage = () => {
  const [txt, setTxt] = React.useState("");
  return (
    <DashboardLayout title="Home">
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Paper>
            <TextField multiline={true} value={txt} onChange={(e) => setTxt(e.target.value)} />
          </Paper>
        </Grid>
        <Grid item xs={6}>
        </Grid>
      </Grid>

      <ul>
        <li>
          <ul>
            <li>WELCOME</li>
            <li>! events that need your attention</li>
            <li>- song of the week? (song + recording + partitions in your instrument)</li>
            <li>- memory of the day? (photo + description)</li>
            <li>upcoming agenda</li>
            <li>- next up (of all types, and all in the next 30 days)</li>
            <li>check out previous events and upload / see photos, videos</li>
            <li>- of all types, and in the past 30 days</li>
            <li>view the list of songs, with partitions, recordings</li>
            <li>SITE SEARCH</li>
          </ul>
        </li>

        <li>
          <ul>
            <li>STATS:</li>
            <li>Our current repertoire</li>
          </ul>
        </li>
      </ul>
    </DashboardLayout>
  )
}

// authenticate only works when boolean.
// https://github.com/blitz-js/blitz/issues/4155
// Home.authenticate = true;// { role: [Permission.can_edit_users] };

export default Home;
