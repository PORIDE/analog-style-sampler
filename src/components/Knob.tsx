import React, { useRef, useEffect } from 'react';

interface KnobProps {
  label?: string;
  value: number;
  onChange?: (val: number) => void;
  min?: number;
  max?: number;
  defaultValue?: number;
  size?: number;
  labelSize?: number;
  color?: string;
  className?: string;
}

export const Knob: React.FC<KnobProps> = React.memo(({ 
  label, 
  value, 
  onChange, 
  min = 0, 
  max = 100, 
  defaultValue = 50,
  size = 28,
  labelSize = 9,
  color,
  className = ''
}) => {
  const percentage = (value - min) / (max - min);
  const rotation = -135 + percentage * 270;
  const knobRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!knobRef.current || !onChange) return;
    const knob = knobRef.current;
    knob.setPointerCapture(e.pointerId);
    
    // Check if UI is in rotated portrait mode
    const isRotated = window.matchMedia("(orientation: portrait)").matches;
    
    const startY = e.clientY;
    const startX = e.clientX;
    const startValue = value;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      let deltaY = 0;
      if (isRotated) {
        // In rotated UI, dragging up on the UI means dragging physical right (increasing X)
        deltaY = moveEvent.clientX - startX;
      } else {
        // Normal landscape drag up is physical up (decreasing Y)
        deltaY = startY - moveEvent.clientY;
      }
      
      const range = max - min;
      // Adjust sensitivity based on range
      let newValue = startValue + (deltaY / 150) * range;
      newValue = Math.max(min, Math.min(newValue, max));
      onChange(newValue);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      knob.releasePointerCapture(upEvent.pointerId);
      knob.removeEventListener('pointermove', handlePointerMove);
      knob.removeEventListener('pointerup', handlePointerUp);
    };

    knob.addEventListener('pointermove', handlePointerMove);
    knob.addEventListener('pointerup', handlePointerUp);
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (!onChange) return;
    const range = max - min;
    const step = range * 0.05;
    let newValue = value - Math.sign(e.deltaY) * step;
    newValue = Math.max(min, Math.min(newValue, max));
    onChange(newValue);
  };

  useEffect(() => {
    const knob = knobRef.current;
    if (knob) {
      knob.addEventListener('wheel', handleWheel, { passive: false });
      return () => knob.removeEventListener('wheel', handleWheel);
    }
  }, [value, min, max, onChange]);

  const handleDoubleClick = () => {
    if (onChange) onChange(defaultValue);
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-0 lg:gap-1 ${className}`}>
      <div 
        className="p-1 px-1.5 md:p-2 touch-none cursor-ns-resize"
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
      >
        <div 
          style={{ width: size, height: size }}
          className="rounded-full bg-[#0a0a0c] relative shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)] border border-white/5 shrink-0 pointer-events-none"
        >
          <div
            className="absolute inset-x-0 top-[12%] bottom-[12%] flex justify-center pointer-events-none"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div 
              className="w-[12%] min-w-[2px] h-[35%] rounded-full shadow-[0_0_5px_rgba(0,0,0,0.5)]" 
              style={{ backgroundColor: color || '#8ab4f8' }} 
            />
          </div>
        </div>
      </div>
      <span 
        style={{ fontSize: labelSize }}
        className="text-[#718096] font-bold tracking-widest leading-none mt-[-2px]"
      >
        {label}
      </span>
    </div>
  );
});
