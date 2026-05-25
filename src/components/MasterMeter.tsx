import React, { useEffect, useRef } from 'react';
import { AudioEngine } from '../audio/AudioEngine';

interface Props {
  engine: AudioEngine;
}

export const MasterMeter: React.FC<Props> = ({ engine }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = engine.masterAnalyser;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationId: number;

    const render = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const level = Math.min(1, average / 128);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Gradient background
      const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
      grad.addColorStop(0, '#22c55e'); // Green
      grad.addColorStop(0.6, '#eab308'); // Yellow
      grad.addColorStop(0.9, '#ef4444'); // Red
      
      const barHeight = level * canvas.height;
      ctx.fillStyle = grad;
      ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

      // Peek lines
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      for (let i = 1; i < 10; i++) {
        ctx.fillRect(0, (i / 10) * canvas.height, canvas.width, 1);
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [engine]);

  return (
    <div className="w-2 h-full bg-[#0a0a0c] rounded-full overflow-hidden border border-[#3f3f46]/20">
      <canvas ref={canvasRef} width={8} height={100} className="w-full h-full" />
    </div>
  );
};
