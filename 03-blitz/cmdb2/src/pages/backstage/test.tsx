

import { BlitzPage } from "@blitzjs/next";
import * as React from 'react';
import { Suspense } from "react";


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
