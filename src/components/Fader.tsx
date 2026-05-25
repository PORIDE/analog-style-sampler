import React, { useRef, useEffect } from 'react';

interface FaderProps {
  value: number;
  onChange?: (val: number) => void;
  isMaster?: boolean;
  min?: number;
  max?: number;
  defaultValue?: number;
  color?: string;
}

export const Fader: React.FC<FaderProps> = React.memo(({ value, onChange, isMaster, min = 0, max = 100, defaultValue = 50 }) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!trackRef.current || !onChange) return;
    const track = trackRef.current;
    track.setPointerCapture(e.pointerId);

    const updateValue = (clientX: number, clientY: number) => {
      const rect = track.getBoundingClientRect();
      const trackHeight = rect.height - 32;
      
      let y = clientY - rect.top - 16;

      y = Math.max(0, Math.min(y, trackHeight));
      const percentage = 1 - (y / trackHeight);
      const newValue = min + percentage * (max - min);
      onChange(newValue);
    };

    updateValue(e.clientX, e.clientY);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateValue(moveEvent.clientX, moveEvent.clientY);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      track.releasePointerCapture(upEvent.pointerId);
      track.removeEventListener('pointermove', handlePointerMove);
      track.removeEventListener('pointerup', handlePointerUp);
    };

    track.addEventListener('pointermove', handlePointerMove);
    track.addEventListener('pointerup', handlePointerUp);
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
    const track = trackRef.current;
    if (track) {
      track.addEventListener('wheel', handleWheel, { passive: false });
      return () => track.removeEventListener('wheel', handleWheel);
    }
  }, [value, min, max, onChange]);

  const handleDoubleClick = () => {
    if (onChange) onChange(defaultValue);
  };

  const percentage = (value - min) / (max - min);

  return (
    <div 
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      className="relative h-full w-full min-w-[28px] md:min-w-[32px] flex justify-center touch-none cursor-pointer"
    >
      <div className="absolute inset-y-0 w-8 md:w-10 lg:w-12 bg-[#0a0a0c] rounded-full shadow-[inset_0_4px_12px_rgba(0,0,0,0.9)] border border-[#3f3f46]/20 pointer-events-none" />
      <div className="absolute top-4 bottom-4 w-1 bg-black rounded-full pointer-events-none opacity-50" />
      <div
        className={`
          absolute w-7 md:w-8 lg:w-10 h-8 md:h-10 lg:h-12 rounded-xl shadow-[0_6px_12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] flex flex-col items-center justify-center gap-1 transition-transform pointer-events-none
          ${isMaster ? 'bg-[#f59e8b]' : 'bg-[#3f3f46]'}
        `}
        style={{ 
          bottom: `calc(16px + ${percentage} * (100% - 32px) - 16px)`, // center thumb
          zIndex: 20
        }}
      >
        <div className={`w-5 h-0.5 rounded-full ${isMaster ? 'bg-black/40' : 'bg-white/40'} pointer-events-none`} />
        <div className={`w-5 h-0.5 rounded-full ${isMaster ? 'bg-black/40' : 'bg-white/40'} pointer-events-none`} />
      </div>
    </div>
  );
});
