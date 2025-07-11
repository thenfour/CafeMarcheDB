import React, { MouseEvent, TouchEvent, useEffect, useRef, useState } from 'react';

interface KnobSegment {
    startValue: number;    // Inclusive start
    endValue: number;      // Exclusive end
    color: string;         // Segment color
    label?: string;        // Optional curved label
    textColor?: string;    // Optional text color (defaults to '#333')
    textOpacity?: number;  // Optional text opacity (0.0 to 1.0, defaults to 1.0)
    fontSize?: number;     // Optional font size (defaults to 12)
    fontWeight?: string;   // Optional font weight (defaults to 'normal')
    fontFamily?: string;   // Optional font family (defaults to 'Arial')
}

interface KnobTickMark {
    value: number;         // Value at which to place the tick mark
    label?: string;        // Optional label for the tick mark
    startRadius?: number;  // Inner radius of tick mark (overrides knob-level tickStartRadius)
    endRadius?: number;    // Outer radius of tick mark (overrides knob-level tickEndRadius)
    tickColor?: string;    // Color of the tick mark (overrides knob-level tickColor)
    tickWidth?: number;    // Width of the tick mark (defaults to 1)
    textColor?: string;    // Color of the label text (defaults to '#333')
    fontSize?: number;     // Font size of the label (overrides knob-level tickFontSize)
    fontWeight?: string;   // Font weight of the label (defaults to 'normal')
    fontFamily?: string;   // Font family of the label (defaults to 'Arial')
}

interface KnobProps {
    min: number;
    max: number;
    value: number;
    step?: number;
    size?: number;
    centerRadius?: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
    startAngle01?: number;
    endAngle01?: number;
    /** 
     * Determines the dragging behavior of the knob. 
     * 'radial' - value changes based on cursor angle around the knob.
     * 'vertical' - value changes based on vertical cursor movement.
     */
    dragBehavior?: 'radial' | 'vertical';

    // Main value arc configuration (radius-based)
    valueArcInnerRadius?: number;  // Inner radius of main value arc (default: centerRadius + 5)
    valueArcOuterRadius?: number;  // Outer radius of main value arc (default: size/2 - 40)

    // Segment arc configuration (radius-based)
    segments?: KnobSegment[];      // Optional segments for outer arc
    segmentArcInnerRadius?: number; // Inner radius of segment arc (default: valueArcOuterRadius + 8)
    segmentArcOuterRadius?: number; // Outer radius of segment arc (default: segmentArcInnerRadius + 25)
    segmentTextRadius?: number;     // Distance from center for segment text (default: segmentArcOuterRadius + 13)

    // Needle configuration (radius-based)
    needleStartRadius?: number;    // Inner radius of needle (default: centerRadius + 5)
    needleEndRadius?: number;      // Outer radius of needle (default: valueArcInnerRadius - 5)
    needleColor?: string;          // Color of needle (default: '#333')
    needleWidth?: number;          // Width of needle line (default: 2)

    // Tick mark configuration (radius-based)
    tickMarks?: KnobTickMark[];    // Optional tick marks with labels
    tickStartRadius?: number;      // Default inner radius for all tick marks (overridden by per-tick startRadius)
    tickEndRadius?: number;        // Default outer radius for all tick marks (overridden by per-tick endRadius)
    tickLabelRadius?: number;      // Distance from center for tick labels (default: tickEndRadius + 8)
    tickColor?: string;            // Default color for all tick marks (overridden by per-tick tickColor, default: '#333')
    tickFontSize?: number;         // Default font size for all tick mark labels (overridden by per-tick fontSize, default: 10)

    // Interactive tick labels (DOM-based for hover/click events)
    useInteractiveTickLabels?: boolean; // Whether to render tick labels as DOM elements instead of canvas text
    onTickLabelClick?: (value: number) => void; // Called when a tick label is clicked

    // Snap-to-tick behavior
    snapToTick?: boolean; // Whether single-click values should snap to the nearest tick mark value
    snapDragToTick?: boolean; // Whether drag movements should snap to the nearest tick mark value
}

export const Knob: React.FC<KnobProps> = ({
    min,
    max,
    value,
    step = 1,
    size = 100,
    centerRadius = 20,
    onChange,
    disabled = false,
    className,
    style,
    startAngle01,
    endAngle01,
    dragBehavior = 'radial',

    // Main value arc configuration
    valueArcInnerRadius,
    valueArcOuterRadius,

    // Segment arc configuration
    segments,
    segmentArcInnerRadius,
    segmentArcOuterRadius,
    segmentTextRadius,

    // Needle configuration
    needleStartRadius,
    needleEndRadius,
    needleColor = '#333',
    needleWidth = 2,

    // Tick mark configuration
    tickMarks,
    tickStartRadius,
    tickEndRadius,
    tickLabelRadius,
    tickColor = '#333',
    tickFontSize = 10,

    // Interactive tick labels
    useInteractiveTickLabels = false,
    onTickLabelClick,

    // Snap-to-tick behavior
    snapToTick = false,
    snapDragToTick = false,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);
    const [internalValue, setInternalValue] = useState(value); // Track internal position for smooth dragging with snap
    const [isShiftPressed, setIsShiftPressed] = useState(false); // Track shift key state for overriding snap
    const isShiftPressedRef = useRef<boolean>(false); // Ref to ensure drag handlers get current shift state

    const [startY, setStartY] = useState<number | null>(null);
    const [startValue, setStartValue] = useState<number>(value);
    const [internalStartValue, setInternalStartValue] = useState<number>(value); // Track internal start value for dragging
    const valueChangedDuringDragRef = useRef<boolean>(false);
    const startPositionRef = useRef({ x: 0, y: 0 });
    const dragStartValueRef = useRef(value);

    // Calculate value range
    const valueRange = max - min;

    startAngle01 = startAngle01 || 0.1;
    endAngle01 = endAngle01 || 0.9;

    // Calculate angle range (e.g., from 135 degrees to 45 degrees)
    const startAngle = (startAngle01 * Math.PI * 2) + (Math.PI / 2);
    const endAngle = (endAngle01 * Math.PI * 2) + (Math.PI / 2);
    const angleRange = endAngle - startAngle;

    // Helper function to convert value to angle
    const valueToAngle = (value: number): number => {
        const valueRatio = (value - min) / valueRange;
        return startAngle + valueRatio * angleRange;
    };

    // Draw outer segments
    const drawSegments = (ctx: CanvasRenderingContext2D, innerRadius: number, outerRadius: number, textRadius: number) => {
        if (!segments) return;

        segments.forEach(segment => {
            const segmentStartAngle = valueToAngle(segment.startValue);
            const segmentEndAngle = valueToAngle(segment.endValue);

            // Draw segment arc
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, (innerRadius + outerRadius) / 2, segmentStartAngle, segmentEndAngle, false);
            ctx.lineWidth = outerRadius - innerRadius;
            ctx.strokeStyle = segment.color;
            ctx.stroke();

            // Draw curved label if provided
            if (segment.label) {
                drawCurvedText(ctx, segment.label, segmentStartAngle, segmentEndAngle, textRadius, segment);
            }
        });
    };    // Draw tick marks and labels
    const drawTickMarks = (ctx: CanvasRenderingContext2D, defaultTickStart: number, defaultTickEnd: number, defaultTickLabelRadius: number) => {
        if (!tickMarks) return;

        const centerX = size / 2;
        const centerY = size / 2;

        tickMarks.forEach(tick => {
            const angle = valueToAngle(tick.value);

            // Tick mark properties with defaults - use knob-level defaults if per-tick values not provided
            const tickStartRadiusValue = tick.startRadius ?? tickStartRadius ?? defaultTickStart;
            const tickEndRadiusValue = tick.endRadius ?? tickEndRadius ?? defaultTickEnd;
            const tickColorValue = tick.tickColor ?? tickColor;
            const tickWidth = tick.tickWidth || 1;

            // Only draw tick marks if we have valid radius values
            if (tickStartRadiusValue !== undefined && tickEndRadiusValue !== undefined) {
                // Calculate tick mark start and end positions
                const tickStartX = centerX + Math.cos(angle) * tickStartRadiusValue;
                const tickStartY = centerY + Math.sin(angle) * tickStartRadiusValue;
                const tickEndX = centerX + Math.cos(angle) * tickEndRadiusValue;
                const tickEndY = centerY + Math.sin(angle) * tickEndRadiusValue;

                // Draw tick mark
                ctx.beginPath();
                ctx.moveTo(tickStartX, tickStartY);
                ctx.lineTo(tickEndX, tickEndY);
                ctx.lineWidth = tickWidth;
                ctx.strokeStyle = tickColorValue;
                ctx.stroke();
            }

            // Draw label if provided and not using interactive tick labels
            if (tick.label && !useInteractiveTickLabels) {
                const textColor = tick.textColor || '#333';
                const fontSize = tick.fontSize ?? tickFontSize;
                const fontWeight = tick.fontWeight || 'normal';
                const fontFamily = tick.fontFamily || 'Arial';

                const labelRadius = tickLabelRadius ?? defaultTickLabelRadius;
                const labelX = centerX + Math.cos(angle) * labelRadius;
                const labelY = centerY + Math.sin(angle) * labelRadius;

                ctx.save();
                ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
                ctx.fillStyle = textColor;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(tick.label, labelX, labelY);
                ctx.restore();
            }
        });
    };

    // Draw text along curved path
    const drawCurvedText = (ctx: CanvasRenderingContext2D, text: string, startAngle: number, endAngle: number, radius: number, segment?: KnobSegment) => {
        const centerX = size / 2;
        const centerY = size / 2;
        const midAngle = (startAngle + endAngle) / 2;

        ctx.save();

        // Apply text formatting from segment or use defaults
        const fontSize = segment?.fontSize || 12;
        const fontWeight = segment?.fontWeight || 'normal';
        const fontFamily = segment?.fontFamily || 'Arial';
        const textColor = segment?.textColor || '#333';
        const textOpacity = segment?.textOpacity ?? 1.0;

        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = textColor;
        ctx.globalAlpha = textOpacity;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Position text at middle of segment
        const textX = centerX + Math.cos(midAngle) * radius;
        const textY = centerY + Math.sin(midAngle) * radius;

        // Rotate text to follow arc
        ctx.translate(textX, textY);
        ctx.rotate(midAngle + Math.PI / 2); // Add 90 degrees to make text perpendicular to radius

        ctx.fillText(text, 0, 0);
        ctx.restore();
    };

    // Draw the knob
    const drawKnob = (val: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, size, size);

        // Calculate default radii based on size if not specified
        const defaultValueArcInner = centerRadius + 5;
        const defaultValueArcOuter = size / 2 - 40;
        const defaultSegmentArcInner = (segmentArcInnerRadius ?? valueArcOuterRadius ?? defaultValueArcOuter) + 8;
        const defaultSegmentArcOuter = defaultSegmentArcInner + 25;
        const defaultSegmentTextRadius = defaultSegmentArcOuter + 13;
        const defaultTickStartRadius = defaultSegmentArcOuter + 5;
        const defaultTickEndRadius = defaultTickStartRadius + 8;
        const defaultTickLabelRadius = defaultTickEndRadius + 8;

        const valueArcInner = valueArcInnerRadius ?? defaultValueArcInner;
        const valueArcOuter = valueArcOuterRadius ?? defaultValueArcOuter;
        const segmentArcInner = segmentArcInnerRadius ?? defaultSegmentArcInner;
        const segmentArcOuter = segmentArcOuterRadius ?? defaultSegmentArcOuter;
        const segmentTextRadiusValue = segmentTextRadius ?? defaultSegmentTextRadius;
        const tickStartRadiusValue = tickStartRadius ?? defaultTickStartRadius;
        const tickEndRadiusValue = tickEndRadius ?? defaultTickEndRadius;
        const tickLabelRadiusValue = tickLabelRadius ?? defaultTickLabelRadius;

        // Draw outer segments first (if segments are provided)
        if (segments && segments.length > 0) {
            drawSegments(ctx, segmentArcInner, segmentArcOuter, segmentTextRadiusValue);
        }

        // Calculate angle for current value
        const valueRatio = (val - min) / valueRange;
        const angle = startAngle + valueRatio * angleRange;

        // Draw inner track
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, (valueArcInner + valueArcOuter) / 2, startAngle, endAngle, false);
        ctx.lineWidth = valueArcOuter - valueArcInner;
        ctx.strokeStyle = '#e0e0e0';
        ctx.stroke();

        // Draw inner value arc
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, (valueArcInner + valueArcOuter) / 2, startAngle, angle, false);
        ctx.lineWidth = valueArcOuter - valueArcInner;
        ctx.strokeStyle = disabled ? '#a0a0a0' : '#ff9500';
        ctx.stroke();

        // Draw tick marks (if provided)
        if (tickMarks && tickMarks.length > 0) {
            drawTickMarks(ctx, tickStartRadiusValue, tickEndRadiusValue, tickLabelRadiusValue);
        }

        // Draw needle (if enabled)
        if (needleStartRadius !== undefined || needleEndRadius !== undefined) {
            const defaultNeedleStart = centerRadius + 5;
            const defaultNeedleEnd = valueArcInner - 5;
            const needleStart = needleStartRadius ?? defaultNeedleStart;
            const needleEnd = needleEndRadius ?? defaultNeedleEnd;

            const centerX = size / 2;
            const centerY = size / 2;
            const startX = centerX + Math.cos(angle) * needleStart;
            const startY = centerY + Math.sin(angle) * needleStart;
            const endX = centerX + Math.cos(angle) * needleEnd;
            const endY = centerY + Math.sin(angle) * needleEnd;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.lineWidth = needleWidth;
            ctx.strokeStyle = needleColor;
            ctx.stroke();
        }

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
        setInternalValue(value); // Keep internal value in sync
        drawKnob(value);
    }, [value]);

    // Track shift key state for overriding snap behavior
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                setIsShiftPressed(true);
                isShiftPressedRef.current = true;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                setIsShiftPressed(false);
                isShiftPressedRef.current = false;
            }
        };

        // Add event listeners
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Handle mouse and touch events
    const handleStart = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
        if (disabled) return;
        setIsDragging(true);
        valueChangedDuringDragRef.current = false;
        dragStartValueRef.current = currentValue;

        let clientX: number = 0;
        let clientY: number = 0;

        if ('touches' in e && e.touches.length > 0) {
            clientX = e.touches[0]!.clientX;
            clientY = e.touches[0]!.clientY;
        } else if ('clientX' in e && 'clientY' in e) {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        // Store start position for click vs drag detection
        startPositionRef.current = { x: clientX, y: clientY };

        if (dragBehavior === 'vertical') {
            setStartY(clientY);
            setStartValue(currentValue);
            setInternalStartValue(internalValue);
        } else {
            setInternalStartValue(internalValue);
        }

        e.preventDefault(); // Prevent default touch behavior
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
        if (!isDragging) return;

        if (dragBehavior === 'vertical') {
            handleVerticalDrag(e);
        } else {
            handleRadialDrag(e);
        }
    };

    const handleVerticalDrag = (e: MouseEvent | TouchEvent) => {
        if (startY === null) return;

        let clientX: number = 0;
        let clientY: number = 0;

        if ('touches' in e && e.touches.length > 0) {
            clientX = e.touches[0]!.clientX;
            clientY = e.touches[0]!.clientY;
        } else if ('clientX' in e && 'clientY' in e) {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        // Check for significant movement (either distance or value change)
        const deltaX = clientX - startPositionRef.current.x;
        const deltaY = clientY - startPositionRef.current.y;
        const movementDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const dragThreshold = 3; // pixels

        const verticalDelta = startY - clientY; // Positive when moving up

        // Sensitivity factor: adjust this value to control how fast the knob changes with movement
        const sensitivity = (max - min) / 1000; // Adjust denominator for sensitivity

        let newInternalValue = internalStartValue + verticalDelta * sensitivity;

        // Clamp internal value
        newInternalValue = Math.min(Math.max(newInternalValue, min), max);

        // Calculate the advertised value (with step and optional snapping)
        let newAdvertisedValue = newInternalValue;

        // Apply step
        if (step > 0) {
            newAdvertisedValue = Math.round(newAdvertisedValue / step) * step;
        }

        // Clamp advertised value
        newAdvertisedValue = Math.min(Math.max(newAdvertisedValue, min), max);

        // Apply snap-to-tick for drag if enabled and shift is not pressed
        if (snapDragToTick && !isShiftPressedRef.current) {
            newAdvertisedValue = findNearestTickValue(newAdvertisedValue);
        }

        // Only consider this a drag if we moved significantly or value changed significantly
        const valueChangedSignificantly = Math.abs(newAdvertisedValue - dragStartValueRef.current) > (step || 1);

        if (movementDistance > dragThreshold || valueChangedSignificantly) {
            valueChangedDuringDragRef.current = true;
        }

        setInternalValue(newInternalValue);
        setCurrentValue(newAdvertisedValue);
        drawKnob(newAdvertisedValue);
        onChange(newAdvertisedValue);

        e.preventDefault(); // Prevent text selection and other defaults
    };

    const handleRadialDrag = (e: MouseEvent | TouchEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        let clientX: number = 0;
        let clientY: number = 0;

        if ('touches' in e && e.touches.length > 0) {
            clientX = e.touches[0]!.clientX;
            clientY = e.touches[0]!.clientY;
        } else if ('clientX' in e && 'clientY' in e) {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        // Check for significant movement (either distance or value change)
        const deltaX = clientX - startPositionRef.current.x;
        const deltaY = clientY - startPositionRef.current.y;
        const movementDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const dragThreshold = 3; // pixels

        const x = clientX - rect.left - size / 2;
        const y = clientY - rect.top - size / 2;
        let angle = Math.atan2(y, x);

        // Normalize angle to a value between 0 and 2*PI
        if (angle < 0) {
            angle += 2 * Math.PI;
        }

        let angleRatio = (angle - startAngle + 2 * Math.PI) % (2 * Math.PI);
        angleRatio = angleRatio / angleRange;
        let newInternalValue = min + angleRatio * valueRange;

        // Clamp internal value
        newInternalValue = Math.min(Math.max(newInternalValue, min), max);

        // Calculate the advertised value (with step and optional snapping)
        let newAdvertisedValue = newInternalValue;

        // Apply step
        if (step > 0) {
            newAdvertisedValue = Math.round(newAdvertisedValue / step) * step;
        }

        // Clamp advertised value
        newAdvertisedValue = Math.min(Math.max(newAdvertisedValue, min), max);

        // Apply snap-to-tick for drag if enabled and shift is not pressed
        if (snapDragToTick && !isShiftPressedRef.current) {
            newAdvertisedValue = findNearestTickValue(newAdvertisedValue);
        }

        // Only consider this a drag if we moved significantly or value changed significantly
        const valueChangedSignificantly = Math.abs(newAdvertisedValue - dragStartValueRef.current) > (step || 1);

        if (movementDistance > dragThreshold || valueChangedSignificantly) {
            valueChangedDuringDragRef.current = true;
        }

        setInternalValue(newInternalValue);
        setCurrentValue(newAdvertisedValue);
        drawKnob(newAdvertisedValue);
        onChange(newAdvertisedValue);

        e.preventDefault();
    };

    const handleEnd = (e: MouseEvent | TouchEvent) => {
        const wasClick = !valueChangedDuringDragRef.current;
        setIsDragging(false);

        // Apply click-to-value behavior only if this was a click (value didn't change during drag)
        if (wasClick) {
            handleClickToValue(e);
        }
    };

    // Find the nearest tick mark value for snap-to-tick behavior
    const findNearestTickValue = (targetValue: number): number => {
        if (!tickMarks || tickMarks.length === 0) {
            return targetValue;
        }

        let nearestValue = targetValue;
        let minDistance = Infinity;

        tickMarks.forEach(tick => {
            const distance = Math.abs(tick.value - targetValue);
            if (distance < minDistance) {
                minDistance = distance;
                nearestValue = tick.value;
            }
        });

        return nearestValue;
    };

    const handleClickToValue = (e: MouseEvent | TouchEvent) => {
        // Calculate click-to-value using angle-based approach for both drag behaviors
        // This matches how the knob is visually rendered (always as an arc)
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        let clientX: number = 0;
        let clientY: number = 0;

        if ('touches' in e && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0]!.clientX;
            clientY = e.changedTouches[0]!.clientY;
        } else if ('clientX' in e && 'clientY' in e) {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        // Calculate angle from center to click point
        const x = clientX - rect.left - size / 2;
        const y = clientY - rect.top - size / 2;
        let angle = Math.atan2(y, x);

        // Normalize angle to a value between 0 and 2*PI
        if (angle < 0) {
            angle += 2 * Math.PI;
        }

        // Calculate how far along the arc this angle represents
        // Handle arc wrapping correctly
        let normalizedStartAngle = startAngle % (2 * Math.PI);
        let normalizedEndAngle = endAngle % (2 * Math.PI);

        let angleRatio = 0;

        // If start angle is greater than end angle, the arc wraps around 0
        if (normalizedStartAngle > normalizedEndAngle) {
            // Arc wraps around 0 degrees
            if (angle >= normalizedStartAngle || angle <= normalizedEndAngle) {
                // Click is within the arc
                let angleFromStart;
                if (angle >= normalizedStartAngle) {
                    angleFromStart = angle - normalizedStartAngle;
                } else {
                    angleFromStart = (2 * Math.PI - normalizedStartAngle) + angle;
                }
                angleRatio = angleFromStart / angleRange;
            } else {
                // Click is outside the arc - find closest endpoint
                let distToStart = Math.min(
                    Math.abs(angle - normalizedStartAngle),
                    2 * Math.PI - Math.abs(angle - normalizedStartAngle)
                );
                let distToEnd = Math.min(
                    Math.abs(angle - normalizedEndAngle),
                    2 * Math.PI - Math.abs(angle - normalizedEndAngle)
                );
                angleRatio = distToStart < distToEnd ? 0 : 1;
            }
        } else {
            // Normal arc that doesn't wrap around
            if (angle >= normalizedStartAngle && angle <= normalizedEndAngle) {
                angleRatio = (angle - normalizedStartAngle) / angleRange;
            } else {
                // Click is outside the arc - find closest endpoint
                let distToStart = Math.abs(angle - normalizedStartAngle);
                let distToEnd = Math.abs(angle - normalizedEndAngle);
                angleRatio = distToStart < distToEnd ? 0 : 1;
            }
        }

        // Clamp to valid range (0-1)
        angleRatio = Math.min(Math.max(angleRatio, 0), 1);

        // Convert arc position to value
        let newValue = min + angleRatio * valueRange;

        // Apply step
        if (step > 0) {
            newValue = Math.round(newValue / step) * step;
        }

        // Clamp value
        newValue = Math.min(Math.max(newValue, min), max);

        // Snap to nearest tick value if enabled and shift is not pressed
        if (snapToTick && !isShiftPressedRef.current) {
            newValue = findNearestTickValue(newValue);
        }

        if (newValue !== currentValue) {
            setCurrentValue(newValue);
            drawKnob(newValue);
            onChange(newValue);
        }
    };

    useEffect(() => {
        const handleWindowMove = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => handleMove(e);
        const handleWindowEnd = (e: MouseEvent | TouchEvent) => handleEnd(e);

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

    // Generate interactive tick label positions
    const getInteractiveTickLabels = () => {
        if (!useInteractiveTickLabels || !tickMarks) return [];

        const centerX = size / 2;
        const centerY = size / 2;
        const defaultTickLabelRadius = tickLabelRadius ?? (tickEndRadius ?? (size / 2 - 20)) + 8;

        return tickMarks
            .filter(tick => tick.label)
            .map((tick, index) => {
                const angle = valueToAngle(tick.value);
                const labelRadius = defaultTickLabelRadius;
                const x = centerX + Math.cos(angle) * labelRadius;
                const y = centerY + Math.sin(angle) * labelRadius;

                return {
                    key: `tick-${index}`,
                    value: tick.value,
                    label: tick.label!,
                    x: x - 15, // Offset for centering (approximate)
                    y: y - 8,  // Offset for centering (approximate)
                    textColor: tick.textColor || '#333',
                    fontSize: tick.fontSize ?? tickFontSize,
                    fontWeight: tick.fontWeight || 'normal',
                    fontFamily: tick.fontFamily || 'Arial',
                };
            });
    };

    const interactiveTickLabels = getInteractiveTickLabels();

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <canvas
                ref={canvasRef}
                width={size}
                height={size}
                className={className}
                style={{ cursor: disabled ? 'not-allowed' : 'pointer', touchAction: "none", ...style }}
                onMouseDown={handleStart}
                onTouchStart={handleStart}
            />
            {useInteractiveTickLabels && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: size,
                    height: size,
                    pointerEvents: 'none'
                }}>
                    {interactiveTickLabels.map((tickLabel) => (
                        <div
                            key={tickLabel.key}
                            style={{
                                position: 'absolute',
                                left: tickLabel.x,
                                top: tickLabel.y,
                                color: tickLabel.textColor,
                                fontSize: `${tickLabel.fontSize}px`,
                                fontWeight: tickLabel.fontWeight,
                                fontFamily: tickLabel.fontFamily,
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                userSelect: 'none',
                                pointerEvents: 'auto',
                                padding: '6px 6px',
                                borderRadius: '4px',
                                transition: 'background-color 0.2s',
                                textAlign: 'center',
                                minWidth: '20px',
                                lineHeight: '1',
                            }}
                            onMouseEnter={(e) => {
                                if (!disabled) {
                                    e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            onClick={(e) => {
                                if (disabled) return;
                                e.stopPropagation();
                                e.preventDefault();
                                if (onTickLabelClick) {
                                    onTickLabelClick(tickLabel.value);
                                } else {
                                    onChange(tickLabel.value);
                                }
                            }}
                        >
                            {tickLabel.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
