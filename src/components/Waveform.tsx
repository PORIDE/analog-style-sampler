import React, { useMemo } from 'react';

interface Props {
  buffer: AudioBuffer | null;
  color: string;
}

export const Waveform = React.memo(({ buffer, color }: Props) => {
  const path = useMemo(() => {
    if (!buffer) return '';
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / 100);
    let p = '';
    for (let i = 0; i < 100; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      const x = i;
      const y1 = (1 + min) * 50;
      const y2 = (1 + max) * 50;
      p += `M ${x} ${y1} L ${x} ${y2} `;
    }
    return p;
  }, [buffer]);

  if (!path) return null;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full opacity-20 pointer-events-none">
      <path d={path} stroke={color} strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
});
