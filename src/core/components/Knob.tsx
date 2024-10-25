import React, { useRef, useEffect, useState, MouseEvent, TouchEventHandler, TouchEvent } from 'react';
import { clamp01, lerp, mapRange } from 'shared/utils';

interface KnobProps {
    min: number;
    max: number;
    value: number;
    step?: number;
    size?: number;
    lineWidth?: number;
    centerRadius?: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
    startAngle01?: number;
    endAngle01?: number;
}

export const Knob: React.FC<KnobProps> = ({
    min,
    max,
    value,
    step = 1,
    size = 100,
    lineWidth = 10,
    centerRadius = 20,
    onChange,
    disabled = false,
    className,
    style,
    startAngle01,
    endAngle01,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);

    // Calculate value range
    const valueRange = max - min;

    startAngle01 = startAngle01 || 0.1;
    endAngle01 = endAngle01 || 0.9;

    // Calculate angle range (e.g., from 135 degrees to 45 degrees)
    const startAngle = (startAngle01 * Math.PI * 2) + (Math.PI / 2);
    const endAngle = (endAngle01 * Math.PI * 2) + (Math.PI / 2);
    const angleRange = endAngle - startAngle;

    // Draw the knob
    const drawKnob = (val: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, size, size);

        // Calculate angle for current value
        const valueRatio = (val - min) / valueRange;
        const angle = startAngle + valueRatio * angleRange;

        // Draw track
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - lineWidth, startAngle, endAngle, false);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = '#e0e0e0';
        ctx.stroke();

        // Draw value arc
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - lineWidth, startAngle, angle, false);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = disabled ? '#a0a0a0' : '#ff9500';
        ctx.stroke();

        // Draw knob center
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, centerRadius, 0, 2 * Math.PI, false);
        ctx.fillStyle = '#0000000c';
        ctx.fill();

        // Draw value text
        ctx.font = 'bold 100px Arial';
        ctx.fillStyle = '#0002';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(val.toString(), size / 2, size / 2);
    };

    // Update the knob when value changes
    useEffect(() => {
        setCurrentValue(value);
        drawKnob(value);
    }, [value]);

    // Handle mouse events
    const handleStart = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
        if (disabled) return;
        setIsDragging(true);
        handleMove(e);
        //e.preventDefault(); // Prevent scrolling on touch devices -- actually this is better handled by touch-action css prop
    };

    const handleMove = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
        if (!isDragging) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        let clientX: number = 0;
        let clientY: number = 0;

        if ('touches' in e && e.touches) {
            // Touch event
            clientX = e.touches[0]!.clientX;
            clientY = e.touches[0]!.clientY;
        } else if ('clientX' in e && 'clientY' in e) {
            // Mouse event
            clientX = e.clientX;
            clientY = e.clientY;
        }
        else {
            throw new Error(`unexpected cursor move scenario`);
        }

        const x = clientX - rect.left - size / 2;
        const y = clientY - rect.top - size / 2;
        let angle = (Math.atan2(y, x) / (Math.PI * 2)) + 0.75;

        let angle01 = mapRange(angle % 1, startAngle01, endAngle01, 0, 1);

        let newValue = lerp(min, max, angle01);

        // Apply step
        if (step > 0) {
            newValue = Math.round(newValue / step) * step;
        }

        // Clamp value
        newValue = Math.min(Math.max(newValue, min), max);

        setCurrentValue(newValue);
        drawKnob(newValue);
        onChange(newValue);
    };

    const handleEnd = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        const handleWindowMove = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => handleMove(e);
        const handleWindowEnd = () => handleEnd();

        if (isDragging) {
            window.addEventListener('mousemove', handleWindowMove as any, { passive: false });
            window.addEventListener('mouseup', handleWindowEnd as any, { passive: false });
            window.addEventListener('touchmove', handleWindowMove as any, { passive: false });
            window.addEventListener('touchend', handleWindowEnd as any, { passive: false });
            window.addEventListener('touchcancel', handleWindowEnd as any, { passive: false });
        } else {
            window.removeEventListener('mousemove', handleWindowMove as any);
            window.removeEventListener('mouseup', handleWindowEnd as any);
            window.removeEventListener('touchmove', handleWindowMove as any);
            window.removeEventListener('touchend', handleWindowEnd as any);
            window.removeEventListener('touchcancel', handleWindowEnd as any);
        }

        return () => {
            window.removeEventListener('mousemove', handleWindowMove as any);
            window.removeEventListener('mouseup', handleWindowEnd as any);
            window.removeEventListener('touchmove', handleWindowMove as any);
            window.removeEventListener('touchend', handleWindowEnd as any);
            window.removeEventListener('touchcancel', handleWindowEnd as any);
        };
    }, [isDragging]);

    return (
        <canvas
            ref={canvasRef}
            width={size}
            height={size}
            className={className}
            style={{ cursor: disabled ? 'not-allowed' : 'pointer', touchAction: "none", ...style }}
            onMouseDown={handleStart}
            onTouchStart={handleStart}
        ></canvas>
    );
};








interface Knob2Props {
    min: number;
    max: number;
    value: number;
    step?: number;
    lineWidth?: number;
    centerRadius?: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
    startAngle01?: number;
    endAngle01?: number;
}

export const Knob2: React.FC<Knob2Props> = ({
    min,
    max,
    value,
    step = 1,
    lineWidth,
    centerRadius,
    onChange,
    disabled = false,
    className,
    style,
    startAngle01 = 0.1,
    endAngle01 = 0.9,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);

    // Calculate value range
    const valueRange = max - min;

    // Calculate angle range
    const startAngle = startAngle01 * Math.PI * 2 + Math.PI / 2;
    const endAngle = endAngle01 * Math.PI * 2 + Math.PI / 2;
    const angleRange = endAngle - startAngle;

    // Draw the knob
    const drawKnob = (val: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const size = Math.min(width, height);

        // Adjust lineWidth and centerRadius based on size
        const lineWidthScaled = lineWidth || size * 0.1; // Default to 10% of size
        const centerRadiusScaled = centerRadius || size * 0.2; // Default to 20% of size

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Calculate angle for current value
        const valueRatio = (val - min) / valueRange;
        const angle = startAngle + valueRatio * angleRange;

        // Draw track
        ctx.beginPath();
        ctx.arc(
            width / 2,
            height / 2,
            Math.max(1, size / 2 - lineWidthScaled),
            startAngle,
            endAngle,
            false
        );
        ctx.lineWidth = lineWidthScaled;
        ctx.strokeStyle = '#e0e0e0';
        ctx.stroke();

        // Draw value arc
        ctx.beginPath();
        ctx.arc(
            width / 2,
            height / 2,
            Math.max(1, size / 2 - lineWidthScaled),
            startAngle,
            angle,
            false
        );
        ctx.lineWidth = lineWidthScaled;
        ctx.strokeStyle = disabled ? '#a0a0a0' : '#ff9500';
        ctx.stroke();

        // Draw knob center
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, centerRadiusScaled, 0, 2 * Math.PI, false);
        ctx.fillStyle = '#00000004';
        ctx.fill();
    };

    // Update the knob when value changes
    useEffect(() => {
        setCurrentValue(value);
        drawKnob(value);
    }, [value]);

    // Handle mouse and touch events
    const handleStart = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
        if (disabled) return;
        setIsDragging(true);
        handleMove(e);
    };

    const handleMove = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
        if (!isDragging) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        let clientX: number = 0;
        let clientY: number = 0;

        if ('touches' in e && e.touches) {
            clientX = e.touches[0]!.clientX;
            clientY = e.touches[0]!.clientY;
        } else if ('clientX' in e && 'clientY' in e) {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const x = clientX - rect.left - rect.width / 2;
        const y = clientY - rect.top - rect.height / 2;
        let angle = Math.atan2(y, x) / (Math.PI * 2) + 0.75;

        let angle01 = ((angle % 1) - startAngle01) / (endAngle01 - startAngle01);

        let newValue = min + angle01 * valueRange;

        // Apply step
        if (step > 0) {
            newValue = Math.round(newValue / step) * step;
        }

        // Clamp value
        newValue = Math.min(Math.max(newValue, min), max);

        setCurrentValue(newValue);
        drawKnob(newValue);
        onChange(newValue);
    };

    const handleEnd = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        //const handleWindowMove = (e: MouseEvent | TouchEvent) => handleMove(e as any);
        //const handleWindowEnd = () => handleEnd();
        const handleWindowMove: any = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => handleMove(e);
        const handleWindowEnd = () => handleEnd();

        if (isDragging) {
            window.addEventListener('mousemove', handleWindowMove, { passive: false });
            window.addEventListener('mouseup', handleWindowEnd, { passive: false });
            window.addEventListener('touchmove', handleWindowMove, { passive: false });
            window.addEventListener('touchend', handleWindowEnd, { passive: false });
            window.addEventListener('touchcancel', handleWindowEnd, { passive: false });
        } else {
            window.removeEventListener('mousemove', handleWindowMove);
            window.removeEventListener('mouseup', handleWindowEnd);
            window.removeEventListener('touchmove', handleWindowMove);
            window.removeEventListener('touchend', handleWindowEnd);
            window.removeEventListener('touchcancel', handleWindowEnd);
        }

        return () => {
            window.removeEventListener('mousemove', handleWindowMove);
            window.removeEventListener('mouseup', handleWindowEnd);
            window.removeEventListener('touchmove', handleWindowMove);
            window.removeEventListener('touchend', handleWindowEnd);
            window.removeEventListener('touchcancel', handleWindowEnd);
        };
    }, [isDragging]);

    // Handle canvas resizing
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const resizeCanvas = () => {
            const width = canvas.offsetWidth;
            const height = canvas.offsetHeight;

            canvas.width = width;
            canvas.height = height;

            drawKnob(currentValue);
        };

        resizeCanvas();

        window.addEventListener('resize', resizeCanvas);

        return () => {
            window.removeEventListener('resize', resizeCanvas);
        };
    }, [currentValue]);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{
                cursor: disabled ? 'not-allowed' : 'pointer',
                touchAction: 'none',
                ...style,
            }}
            onMouseDown={handleStart}
            onTouchStart={handleStart}
        ></canvas>
    );
};