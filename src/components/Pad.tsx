import React from 'react';
import { Settings, RefreshCw, Upload, Mic, Square } from 'lucide-react';
import { Waveform } from './Waveform';
import { PadState } from '../types';

interface PadProps {
  pad: PadState;
  isRecording: boolean;
  onPointerDown: (e: React.PointerEvent, id: number) => void;
  onPointerUp: (e: React.PointerEvent, id: number) => void;
  onSettingsClick: (id: number) => void;
  onFileLoad: (id: number, file: File) => void;
  onStartRecording: (padId: number) => void;
  onStopRecording: () => void;
  onAddToCue: (padId: number) => void;
}

export const Pad: React.FC<PadProps> = ({
  pad,
  isRecording,
  onPointerDown,
  onPointerUp,
  onSettingsClick,
  onFileLoad,
  onStartRecording,
  onStopRecording,
  onAddToCue
}) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState({ x: 0, y: 0 });
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const isLooping = pad.isLoop || pad.playMode === 'toggle';
  const activeColor = isLooping ? '#8ab4f8' : '#f59e8b';
  const activeBgClass = isLooping ? 'bg-[#1c2b36] border-[#8ab4f8] shadow-[0_0_15px_rgba(138,180,248,0.2)]' : 'bg-[#2b1f1c] border-[#f59e8b] shadow-[0_0_15px_rgba(245,158,139,0.2)]';

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div 
      className="flex flex-col relative h-full" 
      onContextMenu={(e) => { 
        e.preventDefault(); 
        setMenuPos({ x: e.clientX, y: e.clientY });
        setShowMenu(true);
      }}
    >
      <div
        onPointerDown={(e) => {
          if (showMenu) setShowMenu(false);
          
          if (pad.playMode !== 'gate') {
            longPressTimerRef.current = setTimeout(() => {
              setMenuPos({ x: Math.max(10, e.clientX - 10), y: Math.max(10, e.clientY - 10) });
              setShowMenu(true);
              try {
                if (navigator.vibrate) navigator.vibrate(50);
              } catch (e) {}
            }, 500);
          }

          isRecording ? onStopRecording() : onPointerDown(e, pad.id);
        }}
        onPointerUp={(e) => {
          clearLongPress();
          onPointerUp(e, pad.id);
        }}
        onPointerLeave={(e) => {
          clearLongPress();
          onPointerUp(e, pad.id);
        }}
        onPointerCancel={(e) => {
          clearLongPress();
          onPointerUp(e, pad.id);
        }}
        className={`
          rounded-xl p-2 md:p-3 flex flex-col justify-between transition-all duration-200 cursor-pointer h-full relative overflow-hidden touch-none aspect-square border-2
          ${isRecording ? 'bg-red-500/20 border-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]' : ''}
          ${!pad.buffer && !isRecording ? 'bg-[#16161a] hover:bg-[#202026] border-[#202026] hover:border-[#3f3f46]' : ''}
          ${pad.buffer && !pad.isPlaying ? 'bg-[#202026] border border-[#3f3f46] hover:border-[#718096]' : ''}
          ${pad.isPlaying ? activeBgClass : ''}
        `}
      >
        {pad.buffer ? (
          <>
            <Waveform buffer={pad.buffer} color={pad.isPlaying ? activeColor : '#52525b'} />
            
            {/* Playback Progress Overlay */}
            {pad.isPlaying && (
              <div 
                className="absolute inset-0 bg-white/5 pointer-events-none transition-transform duration-100 ease-linear origin-left"
                style={{ transform: `scaleX(${pad.progress / 100})` }}
              />
            )}

            <div className="flex justify-between items-start relative z-20 gap-1">
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                {pad.keybind && (
                  <span className={`text-[9px] md:text-[10px] font-mono font-black italic px-2 py-0.5 rounded-md border uppercase backdrop-blur-sm self-start shadow-lg transition-colors ${pad.buffer ? 'bg-black/80 text-[#8ab4f8] border-[#8ab4f8]/40' : 'bg-black/40 text-white/30 border-white/10'}`}>
                    {pad.keybind}
                  </span>
                )}
                {pad.buffer && pad.memo && (
                  <span className="text-[8px] md:text-[9px] text-white/60 truncate w-full max-w-[80px] bg-black/40 px-1.5 py-0.5 rounded-md backdrop-blur-sm border border-white/5 block">
                    {pad.memo}
                  </span>
                )}
              </div>
              <div className="flex gap-1 items-center shrink-0">
                <div 
                  onPointerDown={(e) => { e.stopPropagation(); onSettingsClick(pad.id); }}
                  className="p-1 px-1.5 rounded-lg bg-black/40 border border-white/10 hover:bg-black/60 transition-colors cursor-pointer backdrop-blur-sm"
                >
                  <Settings size={12} className={pad.isPlaying ? '' : 'text-[#718096]'} style={pad.isPlaying ? { color: activeColor } : {}} />
                </div>
              </div>
            </div>
            <div className="relative z-20 mt-auto">
              <div className="flex justify-between items-end gap-2">
                <div className="flex-1 min-w-0">
                  <div className={`text-[11px] md:text-xs truncate font-black tracking-tight leading-tight ${pad.isPlaying ? 'text-white' : 'text-[#8ab4f8]'}`}>
                    {pad.name || 'SAMPLE'}
                  </div>
                </div>
                {isLooping && <RefreshCw size={10} className="text-[#8ab4f8] mb-0.5 shrink-0" />}
              </div>
            </div>
          </>
        ) : (
          <>
            <div 
              className="flex-1 flex flex-col items-center justify-center relative z-10"
              onPointerDown={(e) => { 
                  e.stopPropagation(); 
                  document.getElementById(`file-${pad.id}`)?.click(); 
              }}
            >
              <div className="absolute inset-0 bg-radial-[at_center] from-white/2 opacity-[0.02] pointer-events-none" />
              <div className="w-10 h-10 rounded-full bg-[#0a0a0c] border border-[#3f3f46]/30 flex items-center justify-center text-[#3f3f46] hover:text-[#718096] hover:border-[#718096]/50 transition-all group/upload relative shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
                <Upload size={18} className="group-hover/upload:scale-110 transition-transform opacity-40 group-hover/upload:opacity-100" />
              </div>
            </div>
            <div className="flex justify-end items-start relative z-10">
              <div className="flex gap-1 items-center">
                {isRecording ? (
                  <div 
                    onPointerDown={(e) => { e.stopPropagation(); onStopRecording(); }}
                    className="bg-red-500 p-1.5 rounded-lg text-white shadow-[0_0_10px_rgba(239,68,68,0.5)] cursor-pointer"
                  >
                    <Square size={12} className="fill-current" />
                  </div>
                ) : (
                  <div 
                    onPointerDown={(e) => { e.stopPropagation(); onStartRecording(pad.id); }}
                    className="p-1.5 rounded-xl bg-[#0a0a0c]/50 border border-[#3f3f46]/20 hover:bg-green-500/10 hover:text-green-500 hover:border-green-500/50 transition-all cursor-pointer text-[#3f3f46]"
                    title="マイク録音"
                  >
                    <Mic size={14} />
                  </div>
                )}
              </div>
            </div>
            <div className="relative z-10 mt-auto">
              <div className="h-1 w-8 bg-[#3f3f46]/20 rounded-full overflow-hidden">
                {isRecording && <div className="h-full bg-red-500 animate-pulse w-full" />}
              </div>
            </div>
          </>
        )}

        <input 
          id={`file-${pad.id}`} 
          type="file" 
          accept="audio/*" 
          className="hidden" 
          onChange={(e) => { 
            if (e.target.files?.[0]) onFileLoad(pad.id, e.target.files[0]); 
            e.target.value = ''; 
          }} 
        />
      </div>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div 
            className="fixed z-50 bg-[#16161a] border border-[#3f3f46] rounded-xl shadow-2xl p-1 min-w-[140px] animate-in fade-in zoom-in duration-75"
            style={{ 
              left: Math.min(window.innerWidth - 150, menuPos.x), 
              top: Math.min(window.innerHeight - 100, menuPos.y) 
            }}
          >
            <button 
              onClick={(e) => { e.stopPropagation(); onAddToCue(pad.id); setShowMenu(false); }}
              className="w-full text-left px-3 py-2 text-[11px] font-bold text-white hover:bg-[#8ab4f8] hover:text-black rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw size={12} />
              キューに追加
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onSettingsClick(pad.id); setShowMenu(false); }}
              className="w-full text-left px-3 py-2 text-[11px] font-bold text-white hover:bg-[#3f3f46] rounded-lg transition-colors flex items-center gap-2"
            >
              <Settings size={12} />
              設定を開く
            </button>
          </div>
        </>
      )}
    </div>
  );
};
