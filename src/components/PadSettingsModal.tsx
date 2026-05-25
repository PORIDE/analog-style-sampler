import React, { useState, useRef, useEffect } from 'react';
import { X, Repeat, Mic, Square } from 'lucide-react';
import { PadState } from '../types';
import { Knob } from './Knob';

interface Props {
  pad: PadState;
  onClose: () => void;
  onUpdate: (updates: Partial<PadState>) => void;
  onClear: () => void;
  onRecord: (file: File) => void;
}

export const PadSettingsModal: React.FC<Props> = ({ pad, onClose, onUpdate, onClear, onRecord }) => {
  const [name, setName] = useState(pad.name);
  const [memo, setMemo] = useState(pad.memo);
  const [volume, setVolume] = useState(pad.volume);
  const [pitch, setPitch] = useState(pad.pitch || 50);
  const [fadeIn, setFadeIn] = useState(pad.fadeIn || 0);
  const [fadeOut, setFadeOut] = useState(pad.fadeOut || 0);
  const [isLoop, setIsLoop] = useState(pad.isLoop);
  const [trimStart, setTrimStart] = useState(pad.trimStart);
  const [trimEnd, setTrimEnd] = useState(pad.trimEnd || pad.duration || 1);
  const [playMode, setPlayMode] = useState<'oneshot' | 'toggle' | 'gate' | 'retrigger'>(pad.playMode || 'toggle');
  const [exclusive, setExclusive] = useState(pad.exclusive || false);
  const [polyMode, setPolyMode] = useState<'column' | 'unlimited'>(pad.polyMode || 'column');
  const [keybind, setKeybind] = useState(pad.keybind || '');
  const [mute, setMute] = useState(pad.mute || false);
  const [solo, setSolo] = useState(pad.solo || false);
  const [effects, setEffects] = useState(pad.effects || { reverb: 0, delay: 0, radio: 0, muffle: 0 });
  const [zoom, setZoom] = useState(1);
  const [scroll, setScroll] = useState(0); 
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `録音_${new Date().toISOString().slice(11,19)}.webm`, { type: 'audio/webm' });
        onRecord(file);
        setName(file.name);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Mic access denied or error:', err);
      alert('マイクへのアクセスが拒否されたか、エラーが発生しました。');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    if (!pad.buffer || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const numChannels = pad.buffer.numberOfChannels;
    const bufferLength = pad.buffer.length;
    const heightPerChannel = canvas.height / numChannels;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate range to display based on zoom and scroll
    const visibleSamples = bufferLength / zoom;
    const startSample = scroll * (bufferLength - visibleSamples);
    const endSample = startSample + visibleSamples;

    for (let ch = 0; ch < numChannels; ch++) {
      const data = pad.buffer.getChannelData(ch);
      const amp = heightPerChannel / 2;
      const yOffset = ch * heightPerChannel + amp;
      
      ctx.fillStyle = ch === 0 ? '#8ab4f8' : '#c084fc'; // Different colors for L/R
      ctx.globalAlpha = 0.6;

      const step = visibleSamples / canvas.width;

      for (let i = 0; i < canvas.width; i++) {
        let min = 1.0;
        let max = -1.0;
        const subStart = Math.floor(startSample + i * step);
        const subEnd = Math.floor(startSample + (i + 1) * step);
        
        for (let j = subStart; j < subEnd; j++) {
          const datum = data[j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
        
        if (min === 1.0) min = 0;
        if (max === -1.0) max = 0;

        const h = Math.max(1, (max - min) * amp);
        const y = yOffset + min * amp;
        
        ctx.fillRect(i, y, 1, h);
      }
      
      // Zero line
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#718096';
      ctx.fillRect(0, yOffset, canvas.width, 1);
    }
  }, [pad.buffer, zoom, scroll]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSpeed = 0.1;
      const delta = e.deltaY > 0 ? 1 - zoomSpeed : 1 + zoomSpeed;
      const newZoom = Math.max(1, Math.min(100, zoom * delta));
      setZoom(newZoom);
    } else {
      const scrollSpeed = 0.05 / zoom;
      const delta = e.deltaY > 0 ? scrollSpeed : -scrollSpeed;
      setScroll(prev => Math.max(0, Math.min(1, prev + delta)));
    }
  };

  const handleSave = () => {
    onUpdate({ name, memo, volume, pitch, isLoop, trimStart, trimEnd, fadeIn, fadeOut, playMode, exclusive, polyMode, keybind, mute, solo, effects });
    onClose();
  };

  const handleTrimDrag = (e: React.PointerEvent, type: 'start' | 'end') => {
    const container = e.currentTarget.parentElement;
    if (!container) return;
    
    const target = e.currentTarget as HTMLDivElement;
    target.setPointerCapture(e.pointerId);

    const duration = pad.duration || 1;

    const moveHandler = (moveEvent: PointerEvent) => {
      const isRotated = window.matchMedia("(orientation: portrait)").matches;
      const rect = container.getBoundingClientRect();
      let x = 0;
      let totalWidth = 0;
      
      if (isRotated) {
        // UI Left is Physical Top (rect.top). Physical Height corresponds to UI Width.
        x = moveEvent.clientY - rect.top;
        totalWidth = rect.height;
      } else {
        x = moveEvent.clientX - rect.left;
        totalWidth = rect.width;
      }
      
      x = Math.max(0, Math.min(x, totalWidth));
      
      // Calculate time based on current view (zoom/scroll)
      const visibleDuration = duration / zoom;
      const startVisibleTime = scroll * (duration - visibleDuration);
      const time = startVisibleTime + (x / totalWidth) * visibleDuration;
      
      if (type === 'start') {
        setTrimStart(Math.max(0, Math.min(time, trimEnd - 0.001)));
      } else {
        setTrimEnd(Math.min(duration, Math.max(time, trimStart + 0.001)));
      }
    };

    const upHandler = (upEvent: PointerEvent) => {
      target.releasePointerCapture(upEvent.pointerId);
      document.removeEventListener('pointermove', moveHandler);
      document.removeEventListener('pointerup', upHandler);
    };

    document.addEventListener('pointermove', moveHandler);
    document.addEventListener('pointerup', upHandler);
  };

  const duration = pad.duration || 1;
  const visibleDuration = duration / zoom;
  const startVisibleTime = scroll * (duration - visibleDuration);
  const endVisibleTime = startVisibleTime + visibleDuration;

  const getPositionPercent = (time: number) => {
    return ((time - startVisibleTime) / visibleDuration) * 100;
  };

  const startPercent = getPositionPercent(trimStart);
  const endPercent = getPositionPercent(trimEnd);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-[#16161a] border border-[#3f3f46] rounded-xl w-full max-w-2xl flex flex-col shadow-2xl h-full md:h-auto max-h-[95dvh]">
        <div className="flex justify-between items-center p-3 md:p-4 border-b border-[#3f3f46] shrink-0">
          <h2 className="text-sm md:text-lg font-bold text-white">パッド {pad.id + 1} の設定</h2>
          <button onClick={onClose} className="text-[#a1a1aa] hover:text-white p-1"><X size={20} /></button>
        </div>
        
        <div className="p-3 md:p-6 flex flex-col gap-4 md:gap-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
            <div className="flex flex-col gap-1.5 col-span-1 md:col-span-2">
              <label className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">タイトル</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  placeholder="名称未設定"
                  className="bg-[#0a0a0c] border border-[#3f3f46] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#8ab4f8] flex-1 min-w-0"
                />
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`flex items-center justify-center min-w-[70px] md:min-w-[90px] px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all border shrink-0 uppercase tracking-widest ${isRecording ? 'bg-red-500 text-white border-red-400 animate-pulse shadow-[0_0_25px_rgba(239,68,68,0.5)] scale-105' : 'bg-[#16161a] border-[#3f3f46] hover:bg-[#202026] text-white hover:border-[#8ab4f8] hover:shadow-[0_0_15px_rgba(138,180,248,0.2)]'}`}
                  title={isRecording ? '録音を停止' : 'マイクから録音'}
                >
                  {isRecording ? <Square size={16} className="fill-current mr-2" /> : <Mic size={16} className="mr-2" />}
                  <span>{isRecording ? 'REC...' : '録音'}</span>
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">メモ</label>
              <input 
                type="text" 
                value={memo} 
                onChange={e => setMemo(e.target.value)}
                placeholder="メモを入力..."
                className="bg-[#0a0a0c] border border-[#3f3f46] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#8ab4f8]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">キー</label>
              <input 
                type="text" 
                value={keybind} 
                maxLength={1}
                onChange={e => setKeybind(e.target.value)}
                className="bg-[#0a0a0c] border border-[#3f3f46] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#8ab4f8] uppercase"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
              <label className="text-[10px] font-bold text-[#718096] uppercase tracking-wider">波形編集 (トリミング)</label>
              <div className="flex items-center gap-2 md:gap-3 text-[9px] md:text-[10px] text-[#718096] font-mono">
                <span className="bg-[#0a0a0c] px-1.5 py-0.5 rounded border border-[#3f3f46]">Zoom: {zoom.toFixed(1)}x</span>
                <span className="bg-[#0a0a0c] px-1.5 py-0.5 rounded border border-[#3f3f46]">表示幅: {visibleDuration.toFixed(2)}s</span>
              </div>
            </div>
            
            <div 
              onWheel={handleWheel}
              className="relative h-24 md:h-32 bg-[#0a0a0c] rounded-lg border border-[#3f3f46] overflow-hidden cursor-crosshair group/waveform"
            >
              <canvas ref={canvasRef} width={800} height={128} className="w-full h-full" />
              
              {/* Grid Lines */}
              <div className="absolute inset-0 pointer-events-none opacity-5">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className="absolute inset-y-0 border-l border-white" style={{ left: `${(i + 1) * 5}%` }} />
                ))}
              </div>

              {/* Trim Overlay */}
              <div className="absolute inset-y-0 left-0 bg-black/60 pointer-events-none" style={{ width: `${Math.max(0, startPercent)}%` }} />
              <div className="absolute inset-y-0 right-0 bg-black/60 pointer-events-none" style={{ width: `${Math.max(0, 100 - endPercent)}%` }} />
              
              {/* Handles */}
              {startPercent >= 0 && startPercent <= 100 && (
                <div 
                  onPointerDown={(e) => handleTrimDrag(e, 'start')}
                  className="absolute inset-y-0 w-10 -ml-5 cursor-ew-resize flex items-center justify-center group/handle touch-none z-10"
                  style={{ left: `${startPercent}%` }}
                >
                  <div className="relative w-1.5 md:w-2 h-14 md:h-20 bg-[#8ab4f8] rounded-full shadow-[0_0_15px_rgba(138,180,248,0.4)] transition-all duration-200 group-hover/handle:scale-y-110 group-hover/handle:shadow-[0_0_25px_rgba(138,180,248,0.8)] group-active/handle:scale-y-125 group-active/handle:w-2.5 md:group-active/handle:w-3">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col gap-1 items-center opacity-40">
                      <div className="w-0.5 h-4 bg-black rounded-full" />
                    </div>
                  </div>
                  <div className="absolute top-1 left-5 bg-[#8ab4f8] text-[9px] text-black font-black px-2 py-0.5 rounded shadow-xl opacity-0 group-hover/handle:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">START: {trimStart.toFixed(3)}s</div>
                </div>
              )}
              {endPercent >= 0 && endPercent <= 100 && (
                <div 
                  onPointerDown={(e) => handleTrimDrag(e, 'end')}
                  className="absolute inset-y-0 w-10 -ml-5 cursor-ew-resize flex items-center justify-center group/handle touch-none z-10"
                  style={{ left: `${endPercent}%` }}
                >
                  <div className="relative w-1.5 md:w-2 h-14 md:h-20 bg-[#f59e8b] rounded-full shadow-[0_0_15px_rgba(245,158,139,0.4)] transition-all duration-200 group-hover/handle:scale-y-110 group-hover/handle:shadow-[0_0_25px_rgba(245,158,139,0.8)] group-active/handle:scale-y-125 group-active/handle:w-2.5 md:group-active/handle:w-3">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col gap-1 items-center opacity-40">
                      <div className="w-0.5 h-4 bg-black rounded-full" />
                    </div>
                  </div>
                  <div className="absolute top-1 right-5 bg-[#f59e8b] text-[9px] text-black font-black px-2 py-0.5 rounded shadow-xl opacity-0 group-hover/handle:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">END: {trimEnd.toFixed(3)}s</div>
                </div>
              )}

              {/* View Overlay (Mini Map) */}
              {zoom > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                  <div className="w-32 md:w-48 h-1 bg-black/40 rounded-full border border-white/10 overflow-hidden relative">
                    <div 
                      className="absolute inset-y-0 bg-[#8ab4f8]/40 border-x border-[#8ab4f8]"
                      style={{ 
                        width: `${(1 / zoom) * 100}%`,
                        left: `${scroll * (1 - 1 / zoom) * 100}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between text-[9px] md:text-[10px] text-[#718096] font-mono">
              <div className="flex gap-2 md:gap-4">
                <span className="hidden xs:inline">表示範囲: {startVisibleTime.toFixed(2)}s - {endVisibleTime.toFixed(2)}s</span>
                <button 
                  onClick={() => { setZoom(1); setScroll(0); }}
                  className="hover:text-white underline decoration-dotted"
                >
                  表示リセット
                </button>
              </div>
              <div className="flex gap-2 md:gap-4">
                <span>選択範囲: {(trimEnd - trimStart).toFixed(3)}s</span>
                <span className="hidden xs:inline">Total: {duration.toFixed(2)}s</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:gap-4 bg-[#0a0a0c] p-3 md:p-4 rounded-lg border border-[#3f3f46]">
            <div className="flex items-center gap-4">
              <label className="w-16 text-[10px] md:text-xs font-bold text-[#718096] uppercase tracking-wider">音量</label>
              <input 
                type="range" min="0" max="100" 
                value={volume} 
                onChange={e => setVolume(Number(e.target.value))} 
                className="flex-1 h-1.5 md:h-2 bg-[#16161a] rounded-lg appearance-none cursor-pointer accent-[#8ab4f8]" 
              />
              <span className="w-12 text-right text-[10px] md:text-xs font-mono text-[#8ab4f8] whitespace-nowrap">
                {volume === 0 ? '-∞' : (40 * Math.log10(volume / 50) > 0 ? '+' : '') + (40 * Math.log10(volume / 50)).toFixed(1)} dB
              </span>
            </div>

            <div className="flex items-center gap-4">
              <label className="w-16 text-[10px] md:text-xs font-bold text-[#718096] uppercase tracking-wider">ピッチ</label>
              <input 
                type="range" min="0" max="100" 
                value={pitch} 
                onChange={e => setPitch(Number(e.target.value))} 
                className="flex-1 h-1.5 md:h-2 bg-[#16161a] rounded-lg appearance-none cursor-pointer accent-[#f59e8b]" 
              />
              <span className="w-12 text-right text-[10px] md:text-xs font-mono text-[#f59e8b] whitespace-nowrap">
                {Math.pow(2, (pitch - 50) / 50).toFixed(2)}x
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="flex items-center gap-4">
                <label className="w-16 text-[9px] md:text-[10px] font-bold text-[#718096] uppercase tracking-tight">Fade In</label>
                <input 
                  type="range" min="0" max="5" step="0.1" 
                  value={fadeIn} 
                  onChange={e => setFadeIn(Number(e.target.value))} 
                  className="flex-1 h-1 bg-[#16161a] rounded-lg appearance-none cursor-pointer accent-[#8ab4f8]" 
                />
                <span className="w-8 text-right text-[10px] font-mono text-[#8ab4f8]">{fadeIn.toFixed(1)}s</span>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-16 text-[9px] md:text-[10px] font-bold text-[#718096] uppercase tracking-tight">Fade Out</label>
                <input 
                  type="range" min="0" max="5" step="0.1" 
                  value={fadeOut} 
                  onChange={e => setFadeOut(Number(e.target.value))} 
                  className="flex-1 h-1 bg-[#16161a] rounded-lg appearance-none cursor-pointer accent-[#8ab4f8]" 
                />
                <span className="w-8 text-right text-[10px] font-mono text-[#8ab4f8]">{fadeOut.toFixed(1)}s</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4 mt-2">
              <div className="flex items-center gap-4">
                <label className="w-16 text-[9px] md:text-[10px] font-bold text-[#718096] uppercase tracking-tight">Reverb</label>
                <input 
                  type="range" min="0" max="100" 
                  value={effects.reverb || 0} 
                  onChange={e => setEffects(prev => ({ ...prev, reverb: Number(e.target.value) }))} 
                  className="flex-1 h-1 bg-[#16161a] rounded-lg appearance-none cursor-pointer accent-[#a78bfa]" 
                />
                <span className="w-8 text-right text-[10px] font-mono text-[#a78bfa]">{effects.reverb || 0}%</span>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-16 text-[9px] md:text-[10px] font-bold text-[#718096] uppercase tracking-tight">Delay</label>
                <input 
                  type="range" min="0" max="100" 
                  value={effects.delay || 0} 
                  onChange={e => setEffects(prev => ({ ...prev, delay: Number(e.target.value) }))} 
                  className="flex-1 h-1 bg-[#16161a] rounded-lg appearance-none cursor-pointer accent-[#34d399]" 
                />
                <span className="w-8 text-right text-[10px] font-mono text-[#34d399]">{effects.delay || 0}%</span>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-16 text-[9px] md:text-[10px] font-bold text-[#718096] uppercase tracking-tight">Radio</label>
                <input 
                  type="range" min="0" max="100" 
                  value={effects.radio || 0} 
                  onChange={e => setEffects(prev => ({ ...prev, radio: Number(e.target.value) }))} 
                  className="flex-1 h-1 bg-[#16161a] rounded-lg appearance-none cursor-pointer accent-[#f472b6]" 
                />
                <span className="w-8 text-right text-[10px] font-mono text-[#f472b6]">{effects.radio || 0}%</span>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-16 text-[9px] md:text-[10px] font-bold text-[#718096] uppercase tracking-tight">Muffle</label>
                <input 
                  type="range" min="0" max="100" 
                  value={effects.muffle || 0} 
                  onChange={e => setEffects(prev => ({ ...prev, muffle: Number(e.target.value) }))} 
                  className="flex-1 h-1 bg-[#16161a] rounded-lg appearance-none cursor-pointer accent-[#fbbf24]" 
                />
                <span className="w-8 text-right text-[10px] font-mono text-[#fbbf24]">{effects.muffle || 0}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-1 pt-2 border-t border-[#3f3f46]/30">
              <div className="flex items-center gap-4">
                <label className="w-16 text-[10px] md:text-xs font-bold text-[#718096] uppercase tracking-wider">ループ</label>
                <button 
                  onClick={() => setIsLoop(!isLoop)}
                  className={`flex items-center gap-2 px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg border transition-colors ${isLoop ? 'border-[#8ab4f8] bg-[#8ab4f8]/10 text-[#8ab4f8]' : 'border-[#3f3f46] bg-[#16161a] text-[#718096] hover:text-[#a1a1aa]'}`}
                >
                  <Repeat size={14} className={isLoop ? 'animate-spin-slow' : ''} />
                  <span className="text-[10px] md:text-xs font-bold tracking-widest">{isLoop ? 'ON' : 'OFF'}</span>
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-[9px] md:text-[10px] font-bold text-[#718096] uppercase tracking-widest mr-1 md:mr-2">MIXING</label>
                <div className="flex gap-1">
                  <button 
                    onClick={() => setMute(!mute)}
                    className={`px-2 md:px-3 py-1 rounded-lg border transition-colors text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${mute ? 'border-red-500 bg-red-500/10 text-red-500' : 'border-[#3f3f46] bg-[#16161a] text-[#718096] hover:text-[#a1a1aa]'}`}
                  >
                    ミュート
                  </button>
                  <button 
                    onClick={() => setSolo(!solo)}
                    className={`px-2 md:px-3 py-1 rounded-lg border transition-colors text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${solo ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-[#3f3f46] bg-[#16161a] text-[#718096] hover:text-[#a1a1aa]'}`}
                  >
                    ソロ
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-1 border-t border-[#3f3f46] pt-3 md:pt-4">
              <div className="flex items-center gap-4">
                <label className="w-16 text-[10px] md:text-xs font-bold text-[#718096] uppercase tracking-wider">モード</label>
                <div className="flex gap-2">
                  {(['oneshot', 'retrigger', 'toggle', 'gate'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setPlayMode(mode)}
                      className={`px-2 md:px-3 py-1 rounded-lg border transition-colors text-[9px] md:text-[10px] font-bold uppercase tracking-widest ${playMode === mode ? 'border-[#8ab4f8] bg-[#8ab4f8]/10 text-[#8ab4f8]' : 'border-[#3f3f46] bg-[#16161a] text-[#718096] hover:text-[#a1a1aa]'}`}
                    >
                      {mode === 'oneshot' ? '1-SHOT' : mode === 'retrigger' ? 'RETRIGGER' : mode.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[9px] text-[#718096] italic pl-20 opacity-70 leading-tight">
                {playMode === 'oneshot' && '※ 1-SHOT: 最後まで再生。連打しても重なりません。'}
                {playMode === 'retrigger' && '※ RETRIGGER: 再生中に押すと頭から再生し直します。'}
                {playMode === 'toggle' && '※ TOGGLE: タップで再生開始、もう一度タップで停止。'}
                {playMode === 'gate' && '※ GATE: 押している間だけ再生。離すと止まります。'}
              </p>
            </div>

            <div className="flex flex-col gap-2 mt-1 border-t border-[#3f3f46] pt-3 md:pt-4">
              <div className="flex items-center gap-4">
                <label className="w-16 text-[10px] md:text-xs font-bold text-[#718096] uppercase tracking-wider">発音数</label>
                <div className="flex gap-2 flex-1">
                  <button 
                    onClick={() => { setExclusive(false); setPolyMode('unlimited'); }}
                    className={`flex-1 px-2 md:px-3 py-1.5 rounded-lg border transition-colors text-[9px] md:text-[10px] font-bold tracking-widest ${!exclusive ? 'border-[#8ab4f8] bg-[#8ab4f8]/10 text-[#8ab4f8]' : 'border-[#3f3f46] bg-[#16161a] text-[#718096] hover:text-[#a1a1aa]'}`}
                  >
                    POLY (同時再生)
                  </button>
                  <button 
                    onClick={() => { setExclusive(true); setPolyMode('column'); }}
                    className={`flex-1 px-2 md:px-3 py-1.5 rounded-lg border transition-colors text-[9px] md:text-[10px] font-bold tracking-widest ${exclusive && polyMode === 'column' ? 'border-[#f59e8b] bg-[#f59e8b]/10 text-[#f59e8b]' : 'border-[#3f3f46] bg-[#16161a] text-[#718096] hover:text-[#a1a1aa]'}`}
                  >
                    MONO (列)
                  </button>
                  <button 
                    onClick={() => { setExclusive(true); setPolyMode('unlimited'); }}
                    className={`flex-1 px-2 md:px-3 py-1.5 rounded-lg border transition-colors text-[9px] md:text-[10px] font-bold tracking-widest ${exclusive && polyMode === 'unlimited' ? 'border-[#f59e8b] bg-[#f59e8b]/10 text-[#f59e8b] shadow-[0_0_15px_rgba(245,158,139,0.2)]' : 'border-[#3f3f46] bg-[#16161a] text-[#718096] hover:text-[#a1a1aa]'}`}
                  >
                    MONO (全体)
                  </button>
                </div>
              </div>
              <p className="text-[9px] text-[#718096] italic pl-20 opacity-70 leading-tight">
                {!exclusive && '※ POLY: 制限なく同時に複数再生します。'}
                {exclusive && polyMode === 'column' && '※ MONO (列): 同じチャンネル（列）の他の音を止めて再生します。'}
                {exclusive && polyMode === 'unlimited' && '※ MONO (全体): すべてのチャンネルの他のMONO音を止めて再生します。'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 md:p-4 border-t border-[#3f3f46] flex justify-between gap-2 md:gap-3 bg-[#0a0a0c] rounded-b-xl shrink-0">
          <button 
            onClick={onClear} 
            className="px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold text-red-500 hover:bg-red-500/10 border border-red-500/50 uppercase"
          >
            パッド消去
          </button>
          <div className="flex gap-2 md:gap-3">
            <button onClick={onClose} className="px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold text-[#a1a1aa] hover:bg-[#202026] uppercase">戻る</button>
            <button onClick={handleSave} className="px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold bg-[#8ab4f8] text-black hover:bg-[#9bbef9] uppercase">保存</button>
          </div>
        </div>
      </div>
    </div>
  );
};
