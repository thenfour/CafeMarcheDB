
// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import React from "react";
import { ColorPaletteEntry } from 'shared/color';
import { ColorVariationOptions, GetStyleVariablesForColor } from './Color';
import db, { Prisma } from "db";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { Card } from "@mui/material";
import { TAnyModel } from "shared/utils";

// a white surface elevated from the gray base background, allowing vertical content.
// meant to be the ONLY surface
export const CMSinglePageSurfaceCard = (props: React.PropsWithChildren) => {
    return <Card className='singlePageSurface'>{props.children}</Card>;
};



////////////////////////////////////////////////////////////////
// big chip is for the "you are coming!" big status badges which are meant to be a response to user input / interactive or at least suggesting interactivity / actionability.
export interface CMBigChipProps {
    color: ColorPaletteEntry | string | null;
    variant: ColorVariationOptions;
    // put icons & text in children
};

export const CMBigChip = (props: React.PropsWithChildren<CMBigChipProps>) => {
    const style = GetStyleVariablesForColor(props.color);
    return <div className={`cmbigchip ${props.variant}`} style={style}><div className='content'>
        {props.children}
    </div></div>;
};

////////////////////////////////////////////////////////////////
// little tag chip
export interface ITagAssociation {
    id: number;
};

export interface CMTagProps<TagAssignmentModel> {
    tagAssociation: ITagAssociation;
    columnSchema: db3.TagsField<unknown>,
    colorVariant: ColorVariationOptions;
};

export const CMTag = (props: CMTagProps<TAnyModel>) => {
    return DB3Client.DefaultRenderAsChip({
        value: props.tagAssociation,
        colorVariant: props.colorVariant,
        columnSchema: props.columnSchema,
        // onclick
        // ondelete
    });
};

export interface CMTagListProps<TagAssignmentModel> {
    tagAssociations: ITagAssociation[],
    columnSchema: db3.TagsField<unknown>,
    colorVariant: ColorVariationOptions;
};


export const CMTagList = (props: CMTagListProps<TAnyModel>) => {
    //console.log(props.tagAssociations);
    return <div className="chipContainer">
        {props.tagAssociations.map(tagAssociation => <CMTag
            key={tagAssociation.id}
            tagAssociation={tagAssociation}
            columnSchema={props.columnSchema}
            //tagsFieldClient={props.tagsFieldClient}
            colorVariant={props.colorVariant}
        />)}
    </div>
};

