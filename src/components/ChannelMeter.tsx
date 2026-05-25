import React, { useEffect, useState, useRef } from 'react';
import { AudioEngine } from '../audio/AudioEngine';

interface ChannelMeterProps {
  engine: AudioEngine;
  channelId: number;
}

export const ChannelMeter: React.FC<ChannelMeterProps> = ({ engine, channelId }) => {
  const [level, setLevel] = useState(0);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const updateMeter = () => {
      const v = engine.getChannelLevel(channelId);
      // Smooth the decay visually
      setLevel(prev => Math.max(v, prev * 0.85));
      requestRef.current = requestAnimationFrame(updateMeter);
    };
    
    requestRef.current = requestAnimationFrame(updateMeter);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [engine, channelId]);

  return (
    <div className="w-[4px] h-full bg-[#0a0a0c] rounded-full overflow-hidden flex flex-col justify-end border border-[#3f3f46]/30">
      <div 
        className="w-full bg-gradient-to-t from-[#8ab4f8] via-[#f59e8b] to-red-500 transition-all duration-75 ease-out origin-bottom"
        style={{ 
          height: `${Math.min(100, level * 150)}%`, // Scale logic to get good visual range
          opacity: level > 0.01 ? 1 : 0.3
        }}
      />
    </div>
  );
};
