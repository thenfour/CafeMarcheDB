import React from 'react';
import { Slider } from '@mui/material';
import { styled } from '@mui/material/styles';

interface MediaPlayerSliderProps {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange: (value: number) => void;
    onChangeCommitted?: (value: number) => void;
    disabled?: boolean;
    className?: string;
    'aria-label'?: string;
}

// Styled MUI Slider to match our media player theme
const StyledSlider = styled(Slider)(({ theme }) => ({
    height: 4,
    padding: '8px 0',
    '& .MuiSlider-track': {
        border: 'none',
        backgroundColor: '#0088ff',
        height: 4,
    },
    '& .MuiSlider-rail': {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        height: 4,
        borderRadius: 2,
    },
    '& .MuiSlider-thumb': {
        height: 12,
        width: 12,
        backgroundColor: '#0088ff',
        border: '2px solid #fff',
        '&:hover': {
            backgroundColor: '#00aaff',
            boxShadow: '0 0 0 4px rgba(0, 136, 255, 0.16)',
        },
        '&:focus, &.Mui-focusVisible': {
            backgroundColor: '#00aaff',
            boxShadow: '0 0 0 4px rgba(0, 136, 255, 0.16)',
        },
        '&.Mui-active': {
            backgroundColor: '#00aaff',
            boxShadow: '0 0 0 6px rgba(0, 136, 255, 0.16)',
        },
    },
    '&:hover': {
        '& .MuiSlider-rail': {
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
        },
        '& .MuiSlider-track': {
            backgroundColor: '#00aaff',
        },
    },
    '&.Mui-disabled': {
        '& .MuiSlider-track': {
            backgroundColor: '#666',
        },
        '& .MuiSlider-rail': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
        },
        '& .MuiSlider-thumb': {
            backgroundColor: '#666',
            border: '2px solid #444',
        },
    },
}));

export const MediaPlayerSlider: React.FC<MediaPlayerSliderProps> = ({
    value,
    min = 0,
    max = 100,
    step = 1,
    onChange,
    onChangeCommitted,
    disabled = false,
    className,
    'aria-label': ariaLabel,
}) => {
    const handleChange = (event: Event, newValue: number | number[]) => {
        // MUI Slider can return array for range sliders, but we're using single value
        const singleValue = Array.isArray(newValue) ? newValue[0] : newValue;
        if (typeof singleValue === 'number') {
            onChange(singleValue);
        }
    };

    const handleChangeCommitted = (event: React.SyntheticEvent | Event, newValue: number | number[]) => {
        if (onChangeCommitted) {
            const singleValue = Array.isArray(newValue) ? newValue[0] : newValue;
            if (typeof singleValue === 'number') {
                onChangeCommitted(singleValue);
            }
        }
    };

    return (
        <StyledSlider
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={handleChange}
            onChangeCommitted={handleChangeCommitted}
            disabled={disabled}
            className={className}
            aria-label={ariaLabel}
            size="small"
        />
    );
};
