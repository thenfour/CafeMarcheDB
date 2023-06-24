import { Routes, BlitzPage } from "@blitzjs/next"
import React from 'react'
import { Menu, Admin, CustomRoutes, Resource, ListGuesser, EditGuesser } from 'react-admin'
import { Route } from "react-router-dom";
import LabelIcon from '@mui/icons-material/Label';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { Title } from 'react-admin';
import { useMutation } from "@blitzjs/rpc"
import logout from "src/auth/mutations/logout"

//import fakeRestDataProvider from 'ra-data-fakerest';
//import data from './data.json'

import blitzDataProvider from '@theapexlab/ra-data-blitz';
import { invoke } from "@blitzjs/rpc"
import db, { Prisma } from "db"

// specifies search functionality of postFilters
const searchEntities = (q: string): { user: Prisma.UserWhereInput } => ({
    // / NOTE: you can provide [prismaEnitityName]:  PrismaWhereInput pairs here
    user: {
        name: {
            contains: q,
        },
    },
});


export const MyMenu = () => (
    <Menu>
        <Menu.DashboardItem />
        <Menu.ResourceItem name="posts" />
        <Menu.ResourceItem name="comments" />
        <Menu.ResourceItem name="users" />
        <Menu.ResourceItem name="questions" />
        <Menu.Item to="/" primaryText="Home" leftIcon={<LabelIcon />} />
    </Menu>
);

const DashboardMain = () => {
    //const dataProvider = fakeRestDataProvider(data, true);
    const dataProvider = blitzDataProvider({ invoke, searchEntities });
    const [logoutMutation] = useMutation(logout)

    return (
        <Admin dataProvider={dataProvider} menu={MyMenu} dashboard={() => (
            <Card>
                <Title title="Welcome to the administration" />
                <CardContent>
                    Lorem ipsum sic dolor amet...
                    <button
                        onClick={async () => {
                            await logoutMutation()
                        }}
                    >
                        Logout
                    </button>

                </CardContent>
            </Card>
        )}>
            <Resource name="posts" list={ListGuesser} edit={EditGuesser} />
            <Resource name="comments" list={ListGuesser} edit={EditGuesser} />
            <Resource name="users" list={ListGuesser} edit={EditGuesser} />
            <Resource name="questions" list={ListGuesser} edit={EditGuesser} />
            <CustomRoutes>
                <Route path="/settings" element={<div>settings</div>} />
                <Route path="/profile" element={<div>profile</div>} />
            </CustomRoutes>
        </Admin>
    );
};

export default DashboardMain;
