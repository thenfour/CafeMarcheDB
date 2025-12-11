import React from 'react';
import { useDashboardContext } from './dashboardContext/DashboardContext';

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
    const dashboardContext = useDashboardContext();
    const encodedNotation = encodeURIComponent(notation);
    const apiUrl = dashboardContext.getAbsoluteUri(`/api/abc/render?notation=${encodedNotation}&width=${width}&scale=${scale}`);

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
