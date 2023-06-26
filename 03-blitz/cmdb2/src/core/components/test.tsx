import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import ReactDOM from 'react-dom/client';
import { Suspense } from "react"
import Link from "next/link"
import Layout from "src/core/layouts/Layout"
import { useCurrentUser } from "src/users/hooks/useCurrentUser"
import logout from "src/auth/mutations/logout"
import { useMutation } from "@blitzjs/rpc"
import { Routes, BlitzPage } from "@blitzjs/next"
import { LoginForm } from "src/auth/components/LoginForm"
import { useRouter } from "next/router"
import Dashboard2 from "src/core/components/Dashboard2"
import Dashboard3 from "src/core/components/Dashboard3"
import UserAppBarIcon from "src/core/components/UserAppBarIcon";
import Typography from '@mui/material/Typography';
import CssBaseline from "@material-ui/core/CssBaseline";
import Button from '@mui/material/Button';
import { Paper } from '@material-ui/core';


const Test = () => {
    return (
        <Card sx={{ minWidth: 275, maxWidth: 585 }}>
            <CardContent>
                <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
                    Word of the Day
                </Typography>
                <Typography variant="h5" component="div">
                    benevolent
                </Typography>
                <Typography sx={{ mb: 1.5 }} color="text.secondary">
                    adjective
                </Typography>
                <Typography variant="body2">
                    well meaning and kindly.
                    <br />
                    {'"a benevolent smile"'}
                </Typography>
            </CardContent>
            <CardActions>
                <Button size="small">Learn More</Button>
                <UserAppBarIcon></UserAppBarIcon>
            </CardActions>
        </Card>
    );
};

export default Test;