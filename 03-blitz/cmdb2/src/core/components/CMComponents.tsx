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
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

export const EventAttendanceResponseInput = () => {

    return <div className="attendanceResponseInput">
        <div className="segmentList">
            <div className="segment">
                <div className="segmentName">Saturday (23 Sept 14-16u)</div>
                {/* <ButtonGroup size="small"> */}
                {/* <Button endIcon={<ThumbUpIcon />} className="yes notSelected">yep!</Button>
          <Button endIcon={<ThumbUpIcon />} className="yes_maybe notSelected">probably</Button> */}
                {/* <Button variant="text" endIcon={<ThumbDownIcon />} className="no_maybe selected">probably not</Button> */}
                {/* <Button endIcon={<ThumbDownIcon />} className="no notSelected">nope</Button> */}
                {/* </ButtonGroup> */}
                <div className="selectedValue yes_maybe">
                    <div className="textWithIcon">
                        <ThumbUpIcon className="icon" />
                        <span className="text">You are probably going</span>
                        <Button startIcon={<EditIcon />}></Button>
                    </div>
                    <div className="flexVerticalCenter">
                        {/* <input type="text" className="add_comment" placeholder="Add a comment..." /> */}
                        <div className="placeholderText">
                            <EditIcon className="icon" />
                            <span>Add a comment...</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="segment">
                <div className="segmentName">Sunday (24 Sept 14-16u)</div>
                <div className="prompt">Are you going?</div>
                <ButtonGroup >
                    <Button endIcon={<ThumbUpIcon />} className="yes noSelection">yep!</Button>
                    <Button endIcon={<ThumbUpIcon />} className="yes_maybe noSelection">probably</Button>
                    <Button endIcon={<ThumbDownIcon />} className="no_maybe noSelection">probably not</Button>
                    <Button endIcon={<ThumbDownIcon />} className="no noSelection">nope</Button>
                    <Button className="null noSelection">no answer</Button>
                </ButtonGroup>
            </div>
        </div>
    </div>;
};

export const EventCard = () => {

    const maxRotation = 2;
    const rotate = `${((Math.random() * maxRotation)) - (maxRotation * .5)}deg`;
    const maxMargin = 30;
    const marginLeft = `${(Math.random() * maxMargin) + 25}px`;

    return <Card className="cmcard concert" elevation={5} style={{ rotate, marginLeft }}>
        <CardActionArea className="actionArea">
            <div className="cardContent">
                <div className="left"><div className="leftVertText">2023</div></div>
                <div className="image"></div>
                <div className="hcontent">
                    <div className="date">23-26 June 2023</div>
                    <div className="name">Esperanzah! 2023</div>
                    <div className="status confirmed">
                        <CheckIcon />
                        Confirmed
                    </div>
                    <div className="attendance yes">
                        <div className="chip">
                            <ThumbUpIcon />
                            You are coming!
                        </div>
                    </div>
                    <div className="info">43 photos uploaded</div>
                    <div className="chipContainer">
                        <Chip className="chip" size="small" label={"Majorettes snths nth "} />
                        <Chip className="chip" size="small" label={"Festival"} />
                        <Chip className="chip" size="small" label={"Concert"} />
                    </div>
                </div>
            </div>
        </CardActionArea>
    </Card>
};


export const RehearsalCard = () => {

    const maxRotation = 2;
    const rotate = `${((Math.random() * maxRotation)) - (maxRotation * .5)}deg`;
    const maxMargin = 30;
    const marginLeft = `${(Math.random() * maxMargin) + 25}px`;

    return <Card className="cmcard rehearsal" elevation={5} style={{ rotate, marginLeft }}>
        <CardActionArea className="actionArea">
            <div className="cardContent">
                <div className="left"><div className="leftVertText">2023</div></div>
                <div className="image"></div>
                <div className="hcontent">
                    <div className="date">17 August 2023</div>
                    <div className="name">Rehearsal</div>
                    <div className="info">Recording available!</div>
                    <div className="chipContainer">
                    </div>
                </div>
            </div>
        </CardActionArea>
    </Card>



};


