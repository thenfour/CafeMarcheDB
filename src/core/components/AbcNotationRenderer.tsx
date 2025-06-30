import React from 'react';
import { getAbsoluteUrl } from '../db3/clientAPILL';

interface AbcNotationRendererProps {
    notation: string;
    width?: number;
    scale?: number;
    className?: string;
    style?: React.CSSProperties;
    alt?: string;
}

export const AbcNotationRenderer: React.FC<AbcNotationRendererProps> = ({
    notation,
    width,
    scale,
    className,
    style,
    alt = "Music notation",
}) => {
    const encodedNotation = encodeURIComponent(notation);
    const apiUrl = getAbsoluteUrl(`/api/abc/render?notation=${encodedNotation}&width=${width}&scale=${scale}`);

    return (
        <img
            src={apiUrl}
            alt={alt}
            className={className}
            style={style}
        />
    );
};

export default AbcNotationRenderer;
