

import { BlitzPage } from "@blitzjs/next";
import { Suspense } from "react";
import * as React from 'react';
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import * as DB3Client from "src/core/db3/DB3Client";
import { Button, Tooltip } from "@mui/material";
import { Clamp, formatFileSize } from "shared/utils";
import { JoystickDiv } from "src/core/components/CMCoreComponents";
import { API, HomepageContentSpec } from "src/core/db3/clientAPI"; // this line causes an exception . uh oh some circular reference.
import * as db3 from "src/core/db3/db3";
import { Coord2D, MulSize, MulSizeBySize, Size, SubCoord2D, getFileCustomData } from "src/core/db3/shared/apiTypes";
import { HomepageMain, HomepagePhotoPattern, generateHomepageId } from "src/core/components/homepageComponents";
import { nanoid } from 'nanoid';


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const MyComponent = () => {
    const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
        // Set the data and type to be transferred during the drag
        event.dataTransfer.setData('text/plain', 'drag me');
    };

    const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        // Allow dropping by preventing the default behavior
        event.preventDefault();
    };

    const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
        // Prevent default behavior to avoid unwanted actions
        event.preventDefault();
        // Get the data that was set during the drag
        const droppedData = event.dataTransfer.getData('text/plain');
        if (droppedData === 'drag me') {
            alert(`You dropped 'drag me' onto 'here'`);
        }
    };

    return (
        <div>
            {/* Draggable div */}
            <div
                draggable // Make the div draggable
                onDragStart={onDragStart} // Event when drag starts
            >
                drag me
            </div>
            {/* Div where the draggable div can be dropped */}
            <div
                onDragOver={onDragOver} // Event when something is dragged over
                onDrop={onDrop} // Event when something is dropped
            >
                here
            </div>
        </div>
    );
};

const TestPage: BlitzPage = () => {
    return <Suspense><MyComponent /></Suspense>;
}

export default TestPage;
