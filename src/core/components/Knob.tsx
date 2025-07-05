import React, { MouseEvent, TouchEvent, useEffect, useRef, useState } from 'react';

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
    /** 
     * Determines the dragging behavior of the knob. 
     * 'radial' - value changes based on cursor angle around the knob.
     * 'vertical' - value changes based on vertical cursor movement.
     */
    dragBehavior?: 'radial' | 'vertical';
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
    dragBehavior = 'radial',
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);

    const [startY, setStartY] = useState<number | null>(null);
    const [startValue, setStartValue] = useState<number>(value);
    const valueChangedDuringDragRef = useRef<boolean>(false);

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

    // // Handle mouse events
    // const handleStart = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    //     if (disabled) return;
    //     setIsDragging(true);
    //     handleMove(e);
    //     //e.preventDefault(); // Prevent scrolling on touch devices -- actually this is better handled by touch-action css prop
    // };

    // const handleMove = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    //     if (!isDragging) return;
    //     const rect = canvasRef.current?.getBoundingClientRect();
    //     if (!rect) return;

    //     let clientX: number = 0;
    //     let clientY: number = 0;

    //     if ('touches' in e && e.touches) {
    //         // Touch event
    //         clientX = e.touches[0]!.clientX;
    //         clientY = e.touches[0]!.clientY;
    //     } else if ('clientX' in e && 'clientY' in e) {
    //         // Mouse event
    //         clientX = e.clientX;
    //         clientY = e.clientY;
    //     }
    //     else {
    //         throw new Error(`unexpected cursor move scenario`);
    //     }

    //     const x = clientX - rect.left - size / 2;
    //     const y = clientY - rect.top - size / 2;
    //     let angle = (Math.atan2(y, x) / (Math.PI * 2)) + 0.75;

    //     let angle01 = mapRange(angle % 1, startAngle01, endAngle01, 0, 1);

    //     let newValue = lerp(min, max, angle01);

    //     // Apply step
    //     if (step > 0) {
    //         newValue = Math.round(newValue / step) * step;
    //     }

    //     // Clamp value
    //     newValue = Math.min(Math.max(newValue, min), max);

    //     setCurrentValue(newValue);
    //     drawKnob(newValue);
    //     onChange(newValue);
    // };

    // Handle mouse and touch events
    const handleStart = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
        if (disabled) return;
        setIsDragging(true);
        valueChangedDuringDragRef.current = false;

        if (dragBehavior === 'vertical') {
            if ('touches' in e && e.touches.length > 0) {
                setStartY(e.touches[0]!.clientY);
            } else if ('clientY' in e) {
                setStartY(e.clientY);
            }
            setStartValue(currentValue);
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

        let clientY: number = 0;

        if ('touches' in e && e.touches.length > 0) {
            clientY = e.touches[0]!.clientY;
        } else if ('clientY' in e) {
            clientY = e.clientY;
        }

        const deltaY = startY - clientY; // Positive when moving up

        // Sensitivity factor: adjust this value to control how fast the knob changes with movement
        const sensitivity = (max - min) / 1000; // Adjust denominator for sensitivity

        let newValue = startValue + deltaY * sensitivity;

        // Apply step
        if (step > 0) {
            newValue = Math.round(newValue / step) * step;
        }

        // Clamp value
        newValue = Math.min(Math.max(newValue, min), max);

        //if (newValue !== currentValue) {
        valueChangedDuringDragRef.current = true;
        //}

        setCurrentValue(newValue);
        drawKnob(newValue);
        onChange(newValue);

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

        const x = clientX - rect.left - size / 2;
        const y = clientY - rect.top - size / 2;
        let angle = Math.atan2(y, x);

        // Normalize angle to a value between 0 and 2*PI
        if (angle < 0) {
            angle += 2 * Math.PI;
        }

        // // Calculate how far along the arc this angle represents
        // // Handle arc wrapping correctly
        // let normalizedStartAngle = startAngle % (2 * Math.PI);
        // let normalizedEndAngle = endAngle % (2 * Math.PI);

        // let angleRatio = 0;

        // // If start angle is greater than end angle, the arc wraps around 0
        // if (normalizedStartAngle > normalizedEndAngle) {
        //     // Arc wraps around 0 degrees
        //     if (angle >= normalizedStartAngle || angle <= normalizedEndAngle) {
        //         // Click is within the arc
        //         let angleFromStart;
        //         if (angle >= normalizedStartAngle) {
        //             angleFromStart = angle - normalizedStartAngle;
        //         } else {
        //             angleFromStart = (2 * Math.PI - normalizedStartAngle) + angle;
        //         }
        //         angleRatio = angleFromStart / angleRange;
        //     } else {
        //         // Click is outside the arc - find closest endpoint
        //         let distToStart = Math.min(
        //             Math.abs(angle - normalizedStartAngle),
        //             2 * Math.PI - Math.abs(angle - normalizedStartAngle)
        //         );
        //         let distToEnd = Math.min(
        //             Math.abs(angle - normalizedEndAngle),
        //             2 * Math.PI - Math.abs(angle - normalizedEndAngle)
        //         );
        //         angleRatio = distToStart < distToEnd ? 0 : 1;
        //     }
        // } else {
        //     // Normal arc that doesn't wrap around
        //     if (angle >= normalizedStartAngle && angle <= normalizedEndAngle) {
        //         angleRatio = (angle - normalizedStartAngle) / angleRange;
        //     } else {
        //         // Click is outside the arc - find closest endpoint
        //         let distToStart = Math.abs(angle - normalizedStartAngle);
        //         let distToEnd = Math.abs(angle - normalizedEndAngle);
        //         angleRatio = distToStart < distToEnd ? 0 : 1;
        //     }
        // }

        let angleRatio = (angle - startAngle + 2 * Math.PI) % (2 * Math.PI);
        angleRatio = angleRatio / angleRange;
        let newValue = min + angleRatio * valueRange;

        // Apply step
        if (step > 0) {
            newValue = Math.round(newValue / step) * step;
        }

        // Clamp value
        newValue = Math.min(Math.max(newValue, min), max);

        valueChangedDuringDragRef.current = true;
        // if (newValue !== currentValue) {
        // }

        setCurrentValue(newValue);
        drawKnob(newValue);
        onChange(newValue);

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








// interface Knob2Props {
//     min: number;
//     max: number;
//     value: number;
//     step?: number;
//     lineWidth?: number;
//     centerRadius?: number;
//     onChange: (value: number) => void;
//     disabled?: boolean;
//     className?: string;
//     style?: React.CSSProperties;
//     startAngle01?: number;
//     endAngle01?: number;
// }

// export const Knob2: React.FC<Knob2Props> = ({
//     min,
//     max,
//     value,
//     step = 1,
//     lineWidth,
//     centerRadius,
//     onChange,
//     disabled = false,
//     className,
//     style,
//     startAngle01 = 0.1,
//     endAngle01 = 0.9,
//     dragBehavior
// }) => {
//     const canvasRef = useRef<HTMLCanvasElement>(null);
//     const [isDragging, setIsDragging] = useState(false);
//     const [currentValue, setCurrentValue] = useState(value);

//     const [startY, setStartY] = useState<number | null>(null);
//     const [startValue, setStartValue] = useState<number>(value);

//     // Calculate value range
//     const valueRange = max - min;

//     // Calculate angle range
//     const startAngle = startAngle01 * Math.PI * 2 + Math.PI / 2;
//     const endAngle = endAngle01 * Math.PI * 2 + Math.PI / 2;
//     const angleRange = endAngle - startAngle;

//     // Draw the knob
//     const drawKnob = (val: number) => {
//         const canvas = canvasRef.current;
//         if (!canvas) return;

//         const ctx = canvas.getContext('2d');
//         if (!ctx) return;

//         const width = canvas.width;
//         const height = canvas.height;
//         const size = Math.min(width, height);

//         // Adjust lineWidth and centerRadius based on size
//         const lineWidthScaled = lineWidth || size * 0.1; // Default to 10% of size
//         const centerRadiusScaled = centerRadius || size * 0.2; // Default to 20% of size

//         // Clear canvas
//         ctx.clearRect(0, 0, width, height);

//         // Calculate angle for current value
//         const valueRatio = (val - min) / valueRange;
//         const angle = startAngle + valueRatio * angleRange;

//         // Draw track
//         ctx.beginPath();
//         ctx.arc(
//             width / 2,
//             height / 2,
//             Math.max(1, size / 2 - lineWidthScaled),
//             startAngle,
//             endAngle,
//             false
//         );
//         ctx.lineWidth = lineWidthScaled;
//         ctx.strokeStyle = '#e0e0e0';
//         ctx.stroke();

//         // Draw value arc
//         ctx.beginPath();
//         ctx.arc(
//             width / 2,
//             height / 2,
//             Math.max(1, size / 2 - lineWidthScaled),
//             startAngle,
//             angle,
//             false
//         );
//         ctx.lineWidth = lineWidthScaled;
//         ctx.strokeStyle = disabled ? '#a0a0a0' : '#ff9500';
//         ctx.stroke();

//         // Draw knob center
//         ctx.beginPath();
//         ctx.arc(width / 2, height / 2, centerRadiusScaled, 0, 2 * Math.PI, false);
//         ctx.fillStyle = '#00000004';
//         ctx.fill();
//     };

//     // Update the knob when value changes
//     useEffect(() => {
//         setCurrentValue(value);
//         drawKnob(value);
//     }, [value]);

//     // // Handle mouse and touch events
//     // const handleStart = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
//     //     if (disabled) return;
//     //     setIsDragging(true);
//     //     handleMove(e);
//     // };

//     // const handleMove = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
//     //     if (!isDragging) return;
//     //     const rect = canvasRef.current?.getBoundingClientRect();
//     //     if (!rect) return;

//     //     let clientX: number = 0;
//     //     let clientY: number = 0;

//     //     if ('touches' in e && e.touches) {
//     //         clientX = e.touches[0]!.clientX;
//     //         clientY = e.touches[0]!.clientY;
//     //     } else if ('clientX' in e && 'clientY' in e) {
//     //         clientX = e.clientX;
//     //         clientY = e.clientY;
//     //     }

//     //     const x = clientX - rect.left - rect.width / 2;
//     //     const y = clientY - rect.top - rect.height / 2;
//     //     let angle = Math.atan2(y, x) / (Math.PI * 2) + 0.75;

//     //     let angle01 = ((angle % 1) - startAngle01) / (endAngle01 - startAngle01);

//     //     let newValue = min + angle01 * valueRange;

//     //     // Apply step
//     //     if (step > 0) {
//     //         newValue = Math.round(newValue / step) * step;
//     //     }

//     //     // Clamp value
//     //     newValue = Math.min(Math.max(newValue, min), max);

//     //     setCurrentValue(newValue);
//     //     drawKnob(newValue);
//     //     onChange(newValue);
//     // };

//     // Handle mouse and touch events
//     const handleStart = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
//         if (disabled) return;
//         setIsDragging(true);

//         if (dragBehavior === 'vertical') {
//             if ('touches' in e && e.touches.length > 0) {
//                 setStartY(e.touches[0].clientY);
//             } else if ('clientY' in e) {
//                 setStartY(e.clientY);
//             }
//             setStartValue(currentValue);
//         }

//         e.preventDefault(); // Prevent default touch behavior
//     };

//     const handleMove = (e: MouseEvent | TouchEvent) => {
//         if (!isDragging) return;

//         if (dragBehavior === 'vertical') {
//             handleVerticalDrag(e);
//         } else {
//             handleRadialDrag(e);
//         }
//     };

//     const handleVerticalDrag = (e: MouseEvent | TouchEvent) => {
//         if (startY === null) return;

//         let clientY: number = 0;

//         if ('touches' in e && e.touches.length > 0) {
//             clientY = e.touches[0].clientY;
//         } else if ('clientY' in e) {
//             clientY = e.clientY;
//         }

//         const deltaY = startY - clientY; // Positive when moving up

//         // Sensitivity factor: adjust this value to control how fast the knob changes with movement
//         const sensitivity = (max - min) / 200; // Adjust denominator for sensitivity

//         let newValue = startValue + deltaY * sensitivity;

//         // Apply step
//         if (step > 0) {
//             newValue = Math.round(newValue / step) * step;
//         }

//         // Clamp value
//         newValue = Math.min(Math.max(newValue, min), max);

//         setCurrentValue(newValue);
//         drawKnob(newValue);
//         onChange(newValue);

//         e.preventDefault(); // Prevent text selection and other defaults
//     };

//     const handleRadialDrag = (e: MouseEvent | TouchEvent) => {
//         const rect = canvasRef.current?.getBoundingClientRect();
//         if (!rect) return;

//         let clientX: number = 0;
//         let clientY: number = 0;

//         if ('touches' in e && e.touches.length > 0) {
//             clientX = e.touches[0]!.clientX;
//             clientY = e.touches[0]!.clientY;
//         } else if ('clientX' in e && 'clientY' in e) {
//             clientX = e.clientX;
//             clientY = e.clientY;
//         }

//         const x = clientX - rect.left - size / 2;
//         const y = clientY - rect.top - size / 2;
//         let angle = Math.atan2(y, x);

//         // Normalize angle to a value between 0 and 2*PI
//         if (angle < 0) {
//             angle += 2 * Math.PI;
//         }

//         let angleRatio = (angle - startAngle + 2 * Math.PI) % (2 * Math.PI);
//         angleRatio = angleRatio / angleRange;

//         let newValue = min + angleRatio * valueRange;

//         // Apply step
//         if (step > 0) {
//             newValue = Math.round(newValue / step) * step;
//         }

//         // Clamp value
//         newValue = Math.min(Math.max(newValue, min), max);

//         setCurrentValue(newValue);
//         drawKnob(newValue);
//         onChange(newValue);

//         e.preventDefault();
//     };


//     const handleEnd = () => {
//         setIsDragging(false);
//     };

//     useEffect(() => {
//         //const handleWindowMove = (e: MouseEvent | TouchEvent) => handleMove(e as any);
//         //const handleWindowEnd = () => handleEnd();
//         const handleWindowMove: any = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => handleMove(e);
//         const handleWindowEnd = () => handleEnd();

//         if (isDragging) {
//             window.addEventListener('mousemove', handleWindowMove, { passive: false });
//             window.addEventListener('mouseup', handleWindowEnd, { passive: false });
//             window.addEventListener('touchmove', handleWindowMove, { passive: false });
//             window.addEventListener('touchend', handleWindowEnd, { passive: false });
//             window.addEventListener('touchcancel', handleWindowEnd, { passive: false });
//         } else {
//             window.removeEventListener('mousemove', handleWindowMove);
//             window.removeEventListener('mouseup', handleWindowEnd);
//             window.removeEventListener('touchmove', handleWindowMove);
//             window.removeEventListener('touchend', handleWindowEnd);
//             window.removeEventListener('touchcancel', handleWindowEnd);
//         }

//         return () => {
//             window.removeEventListener('mousemove', handleWindowMove);
//             window.removeEventListener('mouseup', handleWindowEnd);
//             window.removeEventListener('touchmove', handleWindowMove);
//             window.removeEventListener('touchend', handleWindowEnd);
//             window.removeEventListener('touchcancel', handleWindowEnd);
//         };
//     }, [isDragging]);

//     // Handle canvas resizing
//     useEffect(() => {
//         const canvas = canvasRef.current;
//         if (!canvas) return;

//         const resizeCanvas = () => {
//             const width = canvas.offsetWidth;
//             const height = canvas.offsetHeight;

//             canvas.width = width;
//             canvas.height = height;

//             drawKnob(currentValue);
//         };

//         resizeCanvas();

//         window.addEventListener('resize', resizeCanvas);

//         return () => {
//             window.removeEventListener('resize', resizeCanvas);
//         };
//     }, [currentValue]);

//     return (
//         <canvas
//             ref={canvasRef}
//             className={className}
//             style={{
//                 cursor: disabled ? 'not-allowed' : 'pointer',
//                 touchAction: 'none',
//                 ...style,
//             }}
//             onMouseDown={handleStart}
//             onTouchStart={handleStart}
//         ></canvas>
//     );
// };