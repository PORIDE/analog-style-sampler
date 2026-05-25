import React, { useState, useEffect, useRef } from 'react';
import { Joyride, STATUS, EVENTS, Step } from 'react-joyride';
import { X, Save, FolderOpen, RefreshCw, Trash2, StopCircle, HelpCircle, Download } from 'lucide-react';
import { Knob } from './components/Knob';
import { Fader } from './components/Fader';
import { PadSettingsModal } from './components/PadSettingsModal';
import { AboutModal } from './components/AboutModal';
import { Waveform } from './components/Waveform';
import { AudioEngine } from './audio/AudioEngine';
import { ChannelState, PadState, MasterState, Cue } from './types';

import { Pad } from './components/Pad';
import { MasterMeter } from './components/MasterMeter';
import { ChannelMeter } from './components/ChannelMeter';

const engine = new AudioEngine();

const keyRows = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", '\\']
];

export default function App() {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const padsRef = useRef<PadState[]>([]);
  const channelsRef = useRef<ChannelState[]>([]);

  // Layout logic for dynamic columns
  const [visibleCols, setVisibleCols] = useState(6);
  useEffect(() => {
    const updateCols = () => {
      const w = window.innerWidth;
      if (w >= 1536) setVisibleCols(10);
      else if (w >= 1280) setVisibleCols(8);
      else if (w >= 1024) setVisibleCols(6); // Tablet landscape
      else if (w >= 768) setVisibleCols(6); // Tablet portrait - 6 fits fine as pads
      else setVisibleCols(4); // Mobile landscape / larger mobile
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  const padsPerPage = visibleCols * 3;

  const [channels, setChannels] = useState<ChannelState[]>(Array(12).fill(0).map((_, i) => ({
    id: i, volume: 50, pan: 50, depth: 50, pitch: 50, high: 50, mid: 50, low: 50, isLoop: false, mute: false, solo: false
  })));

  const [master, setMaster] = useState<MasterState>({
    volume: 50, pan: 50, high: 50, mid: 50, low: 50,
    effects: {
      reverb: { on: false, amount: 0 },
      delay: { on: false, amount: 0 },
      radio: { on: false, amount: 0 },
      muffle: { on: false, amount: 0 },
    }
  });

  const [settingsPadId, setSettingsPadId] = useState<number | null>(null);
  const [showTour, setShowTour] = useState(true);
  const [runTour, setRunTour] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [mobileTab, setMobileTab] = useState<'pads' | 'mixer' | 'master' | 'cues'>('pads');

  const [pads, setPads] = useState<PadState[]>(Array(120).fill(0).map((_, i) => ({
    id: i, channelId: i % 12, name: '', memo: '', audioUrl: null, buffer: null,
    isPlaying: false, progress: 0, volume: 50, pitch: 50, isLoop: false, trimStart: 0, trimEnd: 0, duration: 0,
    fadeIn: 0, fadeOut: 0, playMode: 'toggle', exclusive: false, polyMode: 'column', keybind: '',
    mute: false, solo: false
  })));

  const [cues, setCues] = useState<Cue[]>([]);
  const [currentCueIdx, setCurrentCueIdx] = useState(0);

  // Update keybinds and channel mapping when columns change
  useEffect(() => {
    setPads(prev => prev.map((p, i) => {
      const pageIdx = i % (visibleCols * 3);
      const row = Math.floor(pageIdx / visibleCols);
      const col = pageIdx % visibleCols;
      if (row < 3 && col < 12) {
        return { 
          ...p, 
          channelId: col, // Align with the channel strip below
          keybind: keyRows[row][col] 
        };
      }
      return { ...p, keybind: '' };
    }));
  }, [visibleCols]);

  useEffect(() => {
    padsRef.current = pads;
  }, [pads]);

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  useEffect(() => {
    const isAnySolo = channels.some(ch => ch.solo);
    
    channels.forEach(ch => {
      let effectiveVolume = ch.volume;
      if (isAnySolo && !ch.solo) {
        effectiveVolume = 0;
      } else if (ch.mute && !ch.solo) {
        effectiveVolume = 0;
      }
      engine.updateChannel(ch.id, effectiveVolume, ch.pan, ch.depth, ch.pitch, ch.high, ch.mid, ch.low);
    });
  }, [channels]);

  useEffect(() => {
    // Process each channel independently for pad solos/mutes
    const chIds = [...new Set(pads.map(p => p.channelId))];
    chIds.forEach(chId => {
      const channelPads = pads.filter(p => p.channelId === chId);
      const isAnySolo = channelPads.some(p => p.solo);
      channelPads.forEach(p => {
        let effectiveVolume = p.volume;
        if (isAnySolo && !p.solo) {
          effectiveVolume = 0;
        } else if (p.mute && !p.solo) {
          effectiveVolume = 0;
        }
        engine.updatePadVolume(p.id, effectiveVolume);
      });
    });
  }, [pads]);

  useEffect(() => {
    engine.updateMaster(master.volume, master.pan, master.high, master.mid, master.low, master.effects);
  }, [master]);

  const loadDemoSamples = async () => {
    // Reorganized placement: Kicks/Snares on top left, Toms on next row
    const demoSamples = [
      { id: 0, url: 'https://tonejs.github.io/audio/drum-samples/acoustic-kit/kick.mp3', name: 'Acoustic Kick', trimEnd: 0.5 },
      { id: 1, url: 'https://tonejs.github.io/audio/drum-samples/acoustic-kit/snare.mp3', name: 'Acoustic Snare', trimEnd: 0.5 },
      { id: 2, url: 'https://tonejs.github.io/audio/drum-samples/acoustic-kit/hihat.mp3', name: 'Acoustic Hat', trimEnd: 0.4 },
      { id: 3, url: 'https://tonejs.github.io/audio/drum-samples/breakbeat.mp3', name: 'Breakbeat Loop', playMode: 'toggle', isLoop: true },
      { id: 8, url: 'https://tonejs.github.io/audio/drum-samples/acoustic-kit/tom1.mp3', name: 'Acoustic Tom 1', trimEnd: 0.4 },
      { id: 9, url: 'https://tonejs.github.io/audio/drum-samples/acoustic-kit/tom2.mp3', name: 'Acoustic Tom 2', trimEnd: 0.4 },
      { id: 10, url: 'https://tonejs.github.io/audio/drum-samples/acoustic-kit/tom3.mp3', name: 'Acoustic Tom 3', trimEnd: 0.4 },
      { id: 11, url: 'https://tonejs.github.io/audio/drum-samples/conga-rhythm.mp3', name: 'Conga Rhythm', playMode: 'toggle', isLoop: true },
    ];

    for (const sample of demoSamples) {
      try {
        const buffer = await engine.loadAudioFromUrl(sample.url);
        setPads(prev => prev.map(p => p.id === sample.id ? {
          ...p,
          buffer,
          audioUrl: sample.url,
          name: sample.name,
          duration: buffer.duration,
          trimEnd: sample.trimEnd || buffer.duration,
          isLoop: sample.isLoop || p.isLoop,
          playMode: (sample.playMode as 'oneshot' | 'toggle' | 'gate') || p.playMode
        } : p));
      } catch (e) {
        console.error('Failed to load demo sample', e);
      }
    }
  };

  useEffect(() => {
    loadDemoSamples();
  }, []);

  const handleFileLoad = async (padId: number, file: File) => {
    try {
      const buffer = await engine.loadAudio(file);
      const url = URL.createObjectURL(file);
      
      setPads(prev => prev.map(p => {
        if (p.id === padId) {
          if (p.audioUrl) URL.revokeObjectURL(p.audioUrl);
          return {
            ...p,
            name: file.name,
            audioUrl: url,
            buffer,
            duration: buffer.duration,
            trimStart: 0,
            trimEnd: buffer.duration
          };
        }
        return p;
      }));
    } catch (e) {
      console.error("Failed to load audio", e);
    }
  };

  const triggerPadStart = React.useCallback((padId: number) => {
    const pad = padsRef.current.find(p => p.id === padId);
    if (!pad || !pad.buffer) return;

    const playPadInternal = (p: PadState) => {
      const channel = channelsRef.current[p.channelId];
      const isLoop = p.isLoop || channel.isLoop;
      
      // Calculate effective volume
      const channelPads = padsRef.current.filter(item => item.channelId === p.channelId);
      const isAnySolo = channelPads.some(item => item.solo);
      let triggerVolume = p.volume;
      if (isAnySolo && !p.solo) {
        triggerVolume = 0;
      } else if (p.mute && !p.solo) {
        triggerVolume = 0;
      }
      
      setPads(curr => curr.map(item => {
        // Voice management
        if (p.exclusive) {
           // Exclusive mode: Stop others in the same group
           const isSameGroup = p.polyMode === 'column' 
             ? item.channelId === p.channelId 
             : true; // unlimited/global exclusive? User said "二回押すと列を限定しない"

           if (isSameGroup && item.id !== p.id && item.isPlaying) {
             engine.stopPad(item.id);
             return { ...item, isPlaying: false, progress: 0 };
           }
        }
        
        if (item.id === p.id) {
          return { ...item, isPlaying: true, progress: 0 };
        }
        return item;
      }));
      
      engine.playPad(
        p.id, 
        p.buffer!, 
        p.channelId, 
        triggerVolume,
        p.pitch,
        isLoop, 
        p.trimStart, 
        p.trimEnd,
        p.fadeIn,
        p.fadeOut,
        p.effects || { reverb: 0, delay: 0, radio: 0, muffle: 0 },
        (progress) => {
          setPads(curr => curr.map(item => item.id === p.id ? { ...item, progress } : item));
        },
        () => {
          setPads(curr => curr.map(item => item.id === p.id ? { ...item, isPlaying: false, progress: 0 } : item));
        }
      );
    };

    if (pad.playMode === 'gate') {
      if (pad.isPlaying) engine.stopPad(padId);
      playPadInternal(pad);
    } else if (pad.playMode === 'toggle') {
      if (pad.isPlaying) {
        engine.stopPad(padId);
        setPads(curr => curr.map(p => p.id === padId ? { ...p, isPlaying: false, progress: 0 } : p));
      } else {
        playPadInternal(pad);
      }
    } else if (pad.playMode === 'retrigger') {
      if (pad.isPlaying) engine.stopPad(padId);
      playPadInternal(pad);
    } else {
      // oneshot (ignore if already playing)
      if (pad.isPlaying) return;
      playPadInternal(pad);
    }
  }, []);

  const triggerPadStop = React.useCallback((padId: number) => {
    const pad = padsRef.current.find(p => p.id === padId);
    if (!pad || !pad.buffer) return;

    if (pad.playMode === 'gate' && pad.isPlaying) {
      engine.stopPad(padId);
      setPads(curr => curr.map(p => p.id === padId ? { ...p, isPlaying: false, progress: 0 } : p));
    }
  }, []);

  const handlePadPointerDown = React.useCallback((e: React.PointerEvent, padId: number) => {
    if (e.button === 2) return;
    
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    const pad = padsRef.current.find(p => p.id === padId);
    if (!pad) return;

    if (!pad.buffer) {
      // Do nothing, let the internal Pad components handle upload/record or right-click handle settings
      return;
    }

    triggerPadStart(padId);
  }, [triggerPadStart]);

  const handlePadPointerUpOrLeave = React.useCallback((e: React.PointerEvent, padId: number) => {
    if (e.button === 2) return;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    triggerPadStop(padId);
  }, [triggerPadStop]);

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSaveProject = async () => {
    setIsSaving(true);
    try {
      const serializedPads = await Promise.all(pads.map(async pad => {
        const { buffer, isPlaying, progress, ...rest } = pad;
        let base64Data = null;
        if (rest.audioUrl && rest.audioUrl.startsWith('blob:')) {
          try {
            const res = await fetch(rest.audioUrl);
            const blob = await res.blob();
            base64Data = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            console.error('Failed to encode audio for pad ' + pad.id, e);
          }
        }
        return { ...rest, audioData: base64Data };
      }));
      const project = {
        channels,
        master,
        pads: serializedPads
      };
      const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cueplay-project.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch(err) {
      console.error("Save failed", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const project = JSON.parse(event.target?.result as string);
        setChannels(prev => prev.map(c => {
          const loadedChannel = project.channels.find((lc: any) => lc.id === c.id);
          if (loadedChannel) {
            return { ...c, ...loadedChannel };
          }
          return c;
        }));
        
        const loadedMaster = project.master;
        if (loadedMaster.effect !== undefined) {
          setMaster({
            volume: loadedMaster.volume ?? 50,
            pan: loadedMaster.pan ?? 50,
            high: loadedMaster.high ?? 50,
            mid: loadedMaster.mid ?? 50,
            low: loadedMaster.low ?? 50,
            effects: {
              reverb: { on: loadedMaster.effect === 'reverb', amount: loadedMaster.effect === 'reverb' ? loadedMaster.effectAmount : 0 },
              delay: { on: loadedMaster.effect === 'delay', amount: loadedMaster.effect === 'delay' ? loadedMaster.effectAmount : 0 },
              radio: { on: loadedMaster.effect === 'radio', amount: loadedMaster.effect === 'radio' ? loadedMaster.effectAmount : 0 },
              muffle: { on: loadedMaster.effect === 'muffle', amount: loadedMaster.effect === 'muffle' ? loadedMaster.effectAmount : 0 },
            }
          });
        } else {
          if (loadedMaster.effects) {
            for (const fx of ['reverb', 'delay', 'radio', 'muffle']) {
              if (loadedMaster.effects[fx]) {
                if (!loadedMaster.effects[fx].on) {
                  loadedMaster.effects[fx].amount = 0;
                } else if (loadedMaster.effects[fx].amount === 0) {
                  loadedMaster.effects[fx].on = false;
                }
              }
            }
          }
          setMaster(loadedMaster);
        }

        // Apply metadata first immediately to update UI, clear old buffers
        setPads(prev => prev.map(p => {
          const loadedPad = project.pads.find((lp: any) => lp.id === p.id);
          if (loadedPad) {
            return { ...p, ...loadedPad, audioData: undefined, isPlaying: false, progress: 0, buffer: null, audioUrl: null };
          }
          return { ...p, buffer: null, audioUrl: null, name: '' };
        }));

        // Load buffers asynchronously
        for (const lp of project.pads) {
          let buffer = null;
          let finalAudioUrl = lp.audioUrl && !lp.audioUrl.startsWith('blob:') ? lp.audioUrl : null;
          
          try {
            if (lp.audioData) {
              const res = await fetch(lp.audioData);
              const blob = await res.blob();
              finalAudioUrl = URL.createObjectURL(blob);
              buffer = await engine.loadAudio(new File([blob], lp.name || 'audio.webm')); 
            } else if (finalAudioUrl && finalAudioUrl.startsWith('http')) {
              buffer = await engine.loadAudioFromUrl(finalAudioUrl);
            }
          } catch (e) {
            console.error("Failed to load audio for pad", lp.id, e);
          }

          if (buffer || finalAudioUrl) {
            setPads(curr => curr.map(c => c.id === lp.id ? { ...c, audioUrl: finalAudioUrl, buffer } : c));
          }
        }
      } catch (err) {
        console.error("Failed to load project", err);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };


  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, padId: number) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      handleFileLoad(padId, file);
    }
  };

  const formatVolume = (v: number) => {
    if (v === 0) return '-∞';
    const db = 40 * Math.log10(v / 50);
    return (db > 0 ? '+' : '') + db.toFixed(1);
  };

  const handleClearAll = () => {
    engine.stopAll();
    setPads(prev => prev.map(p => ({
      ...p,
      buffer: null,
      name: '',
      memo: '',
      trimStart: 0,
      trimEnd: 0,
      isPlaying: false,
      progress: 0,
      audioUrl: null,
      mute: false,
      solo: false
    })));
    setCues([]);
    setCurrentCueIdx(0);
    setShowClearConfirm(false);
  };

  // Keep refs for shortcut handlers to avoid stale state
  const cuesRef = React.useRef(cues);
  const currentCueIdxRef = React.useRef(currentCueIdx);

  useEffect(() => {
    cuesRef.current = cues;
  }, [cues]);

  useEffect(() => {
    currentCueIdxRef.current = currentCueIdx;
  }, [currentCueIdx]);

  const handleGo = React.useCallback(() => {
    const list = cuesRef.current;
    const idx = currentCueIdxRef.current;
    if (list.length === 0) return;
    const currentCue = list[idx];
    if (!currentCue) return;

    console.log(`[CUE] Triggering Cue ${idx + 1}: ${currentCue.label}`);

    currentCue.actions.forEach(action => {
      setTimeout(() => {
        if (action.type === 'start') {
          console.log(`[CUE] ACTION: START Pad ${action.padId}`);
          triggerPadStart(action.padId);
        } else {
          console.log(`[CUE] ACTION: STOP Pad ${action.padId}`);
          triggerPadStop(action.padId);
        }
      }, action.delay * 1000);
    });

    if (idx < list.length - 1) {
      setCurrentCueIdx(idx + 1);
    } else {
      setCurrentCueIdx(0);
      console.log(`[CUE] Reached end of list. Looping to start.`);
    }
  }, [triggerPadStart, triggerPadStop]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.repeat) return;
      
      const key = e.key.toLowerCase();

      // Stop All shortcut
      if (key === 'escape') {
        engine.stopAll();
        setPads(prev => prev.map(p => ({ ...p, isPlaying: false, progress: 0 })));
        return;
      }

      // Space key for GO button
      if (key === ' ' || key === 'spacebar') {
        e.preventDefault();
        handleGo();
        return;
      }

      // Only trigger pads on the current page for better bank behavior
      const pageStart = currentPage * padsPerPage;
      const pageEnd = pageStart + padsPerPage;
      const pad = padsRef.current.slice(pageStart, pageEnd).find(p => p.keybind.toLowerCase() === key);
      if (pad) {
        triggerPadStart(pad.id);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const key = e.key.toLowerCase();
      const pageStart = currentPage * padsPerPage;
      const pageEnd = pageStart + padsPerPage;
      const pad = padsRef.current.slice(pageStart, pageEnd).find(p => p.keybind.toLowerCase() === key);
      if (pad) {
        triggerPadStop(pad.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [triggerPadStart, triggerPadStop, handleGo, currentPage, padsPerPage]);

  const addPadToCue = (padId: number) => {
    const pad = pads.find(p => p.id === padId);
    if (!pad) return;

    const newCue: Cue = {
      id: Math.random().toString(36).substr(2, 9),
      label: pad.name || `Pad ${padId + 1}`,
      notes: '',
      actions: [{ id: Math.random().toString(36).substr(2, 9), padId, type: 'start', delay: 0 }]
    };

    setCues([...cues, newCue]);
  };

  const [recordingPadId, setRecordingPadId] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async (padId: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2
        } 
      });
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        audioBitsPerSecond: 256000,
        mimeType
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `REC_${new Date().toISOString().slice(11,19)}.webm`, { type: 'audio/webm' });
        handleFileLoad(padId, file);
        stream.getTracks().forEach(track => track.stop());
        setRecordingPadId(null);
      };

      mediaRecorder.start();
      setRecordingPadId(padId);
    } catch (err) {
      console.error('Mic access denied:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingPadId !== null) {
      mediaRecorderRef.current.stop();
    }
  };

  const totalPages = visibleCols <= 6 ? 2 : Math.ceil(120 / padsPerPage);

  return (
    <div className="fixed inset-0 bg-[#0f0f12] text-white flex flex-col p-1.5 md:p-4 pb-2 md:pb-4 font-sans overflow-hidden select-none">
      <div className="flex justify-between items-center mb-1.5 md:mb-4 shrink-0 gap-2 md:gap-4 bg-[#16161a] p-1.5 md:px-4 md:py-2 rounded-xl md:rounded-2xl border border-[#3f3f46]/30 overflow-x-auto custom-scrollbar flex-nowrap">
        <div className="text-[16px] md:text-2xl font-bold tracking-tighter text-[#f59e8b] px-1 md:pr-4 md:border-r border-[#3f3f46]/50 whitespace-nowrap">CuePlay</div>
        
        <div className="flex items-center gap-1.2 bg-[#0a0a0c] p-1 rounded-xl border border-[#3f3f46]/40 flex-nowrap shrink-0 max-w-[300px] overflow-x-auto custom-scrollbar no-scrollbar">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button 
              key={i}
              onClick={() => setCurrentPage(i)}
              className={`px-3 md:px-4 py-1.5 text-[10px] md:text-xs font-bold rounded-lg transition-all flex-shrink-0 ${currentPage === i ? 'bg-[#8ab4f8] text-black shadow-[0_0_15px_rgba(138,180,248,0.3)]' : 'text-[#718096] hover:text-white hover:bg-[#16161a]'}`}
            >
              P{i + 1}
            </button>
          ))}
        </div>

        <div className="flex-1 flex items-center justify-center gap-4">
            <button 
              onClick={handleGo}
              disabled={cues.length === 0}
              className={`flex items-center gap-3 px-8 py-2 rounded-xl border transition-all active:scale-95 group relative overflow-hidden
                ${cues.length > 0 
                  ? 'bg-[#f59e8b] text-black border-white/20 shadow-[0_0_20px_rgba(245,158,139,0.3)] hover:brightness-110' 
                  : 'bg-[#1a1a1e] text-[#3f3f46] border-[#3f3f46]/20 opacity-50 cursor-not-allowed'}
              `}
            >
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black italic tracking-tighter leading-none">GO</span>
                <span className="text-[7px] font-bold tracking-[0.2em] opacity-60 uppercase">Space</span>
              </div>
              <div className={`w-2 h-2 rounded-full ${cues.length > 0 ? 'bg-black/30' : 'bg-[#3f3f46]'} group-hover:scale-125 transition-transform`} />
            </button>
        </div>

        <div className="flex items-center gap-2 pr-2">
          <button 
            onClick={() => {
              engine.stopAll();
              setPads(prev => prev.map(p => ({ ...p, isPlaying: false, progress: 0 })));
            }}
            className="flex items-center gap-2 bg-[#202026] hover:bg-neutral-800 text-[#718096] hover:text-white border border-[#3f3f46] px-3 md:px-4 py-1.5 rounded-xl transition-all group shrink-0"
            title="すべて停止"
          >
            <StopCircle size={18} className="group-hover:scale-110 transition-transform" />
            <span className="hidden lg:inline text-[11px] font-bold">全停止</span>
          </button>
          
          <button 
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center justify-center bg-[#202026] hover:bg-red-500/10 text-[#718096] hover:text-red-500 border border-[#3f3f46] hover:border-red-500/30 px-3 md:px-4 py-1.5 rounded-xl transition-all group shrink-0"
            title="クリア"
          >
            <Trash2 size={18} className="group-hover:rotate-12 transition-transform" />
            <span className="hidden lg:inline text-[11px] font-bold ml-1">消去</span>
          </button>
        </div>

        <div className="flex gap-2 items-center pl-4 border-l border-[#3f3f46]/50">
          <button onClick={() => setShowTour(true)} className="flex items-center justify-center bg-[#0a0a0c] hover:bg-[#16161a] border border-[#3f3f46]/40 w-9 h-9 rounded-xl transition-all text-[#718096] hover:text-white" title="ヘルプ">
            <HelpCircle size={18} />
          </button>
          <label className="tour-load-btn flex items-center gap-2 bg-[#0a0a0c] hover:bg-[#16161a] border border-[#3f3f46]/40 px-4 py-2 rounded-xl text-[11px] font-bold transition-all text-[#718096] hover:text-white cursor-pointer group" title="プロジェクト読込">
            <FolderOpen size={16} className={`group-hover:scale-110 transition-transform ${isLoading ? 'animate-pulse text-[#8ab4f8]' : ''}`} />
            <span className="hidden lg:inline uppercase italic font-black">{isLoading ? 'LOADING...' : 'LOAD'}</span>
            <input type="file" accept=".json" className="hidden" onChange={handleLoadProject} disabled={isLoading || isSaving} />
          </label>
          <button onClick={handleSaveProject} disabled={isLoading || isSaving} className="flex items-center gap-2 bg-[#0a0a0c] hover:bg-[#16161a] border border-[#3f3f46]/40 px-4 py-2 rounded-xl text-[11px] font-bold transition-all text-[#718096] hover:text-white group flex-shrink-0" title="プロジェクト保存">
            <Download size={16} className={`group-hover:scale-110 transition-transform ${isSaving ? 'animate-bounce text-[#8ab4f8]' : ''}`} />
            <span className="hidden lg:inline uppercase italic font-black whitespace-nowrap">{isSaving ? 'SAVING...' : 'SAVE'}</span>
          </button>
        </div>
      </div>

      <div className="lg:hidden flex bg-[#0a0a0c] p-1 rounded-xl border border-[#3f3f46]/40 w-full mb-1 shrink-0">
        <button 
          onClick={() => setMobileTab('pads')}
          className={`flex-1 py-1 md:py-1.5 text-[10px] font-bold rounded-lg transition-all ${mobileTab === 'pads' ? 'bg-[#8ab4f8] text-black' : 'text-[#718096]'}`}
        >
          PADS
        </button>
        <button 
          onClick={() => setMobileTab('mixer')}
          className={`flex-1 py-1 md:py-1.5 text-[10px] font-bold rounded-lg transition-all ${mobileTab === 'mixer' ? 'bg-[#8ab4f8] text-black' : 'text-[#718096]'}`}
        >
          MIXER
        </button>
        <button 
          onClick={() => setMobileTab('master')}
          className={`flex-1 py-1 md:py-1.5 text-[10px] font-bold rounded-lg transition-all ${mobileTab === 'master' ? 'bg-[#f59e8b] text-black' : 'text-[#718096]'}`}
        >
          MASTER
        </button>
        <button 
          onClick={() => setMobileTab('cues')}
          className={`flex-1 py-1 md:py-1.5 text-[10px] font-bold rounded-lg transition-all ${mobileTab === 'cues' ? 'bg-[#a78bfa] text-black' : 'text-[#718096]'}`}
        >
          CUES
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 overflow-y-auto lg:overflow-hidden custom-scrollbar">
        
        {/* Left Column (Pads + Channels) */}
        <div className={`flex-1 flex flex-col gap-2 min-w-0 min-h-0 ${mobileTab === 'pads' || mobileTab === 'mixer' ? 'flex' : 'hidden lg:flex'}`}>
          
          {/* Pads Section */}
          <div className={`tour-pads flex-1 flex flex-col gap-2 min-w-0 min-h-0 ${mobileTab !== 'pads' ? 'hidden lg:flex' : 'flex'}`}>
            <div 
              className="flex-1 grid gap-1 md:gap-2 min-h-0 overflow-y-auto lg:overflow-hidden custom-scrollbar pr-1"
              style={{ 
                gridTemplateColumns: `repeat(${visibleCols}, minmax(0, 1fr))`,
                gridTemplateRows: 'repeat(3, minmax(0, 1fr))'
              }}
            >
              {pads.slice(currentPage * padsPerPage, (currentPage + 1) * padsPerPage).map((pad) => (
                <Pad 
                  key={pad.id}
                  pad={pad}
                  isRecording={recordingPadId === pad.id}
                  onPointerDown={handlePadPointerDown}
                  onPointerUp={handlePadPointerUpOrLeave}
                  onSettingsClick={setSettingsPadId}
                  onFileLoad={handleFileLoad}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  onAddToCue={addPadToCue}
                />
              ))}
            </div>
          </div>

          {/* Channels Section */}
          <div 
            className={`tour-channels grid gap-1.5 md:gap-2 flex-1 min-h-0 lg:min-h-0 lg:h-[280px] shrink-0 ${mobileTab !== 'mixer' ? 'hidden lg:grid' : 'grid overflow-hidden lg:overflow-visible'}`}
            style={{ gridTemplateColumns: `repeat(${visibleCols}, minmax(0, 1fr))` }}
          >
            {channels.slice(0, visibleCols).map((channel) => (
              <div key={channel.id} className="flex flex-col bg-[#16161a] rounded-xl p-1 md:p-1.5 items-center h-full shadow-lg border border-white/5 relative group/channel">
                <div className="w-full flex gap-0.5 md:gap-1 h-6 md:h-7 mb-1 md:mb-1.5 shrink-0">
                  <button 
                    onClick={() => setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, mute: !c.mute } : c))} 
                    className={`flex-1 h-full min-w-0 rounded flex items-center justify-center text-[9px] md:text-[10px] font-bold ${channel.mute ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-[#202026] text-[#718096] hover:text-[#a1a1aa]'}`}
                  >
                    M
                  </button>
                  <button 
                    onClick={() => setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, solo: !c.solo } : c))} 
                    className={`flex-1 h-full min-w-0 rounded flex items-center justify-center text-[9px] md:text-[10px] font-bold ${channel.solo ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 'bg-[#202026] text-[#718096] hover:text-[#a1a1aa]'}`}
                  >
                    S
                  </button>
                  <button onClick={() => setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, isLoop: !c.isLoop } : c))} className={`flex-1 h-full min-w-0 rounded flex items-center justify-center ${channel.isLoop ? 'text-[#8ab4f8] bg-[#8ab4f8]/10' : 'text-[#718096] bg-[#202026] hover:text-[#a1a1aa]'}`}>
                    <RefreshCw size={10} />
                  </button>
                </div>
                <div className="flex w-full flex-1 min-h-0 gap-1 md:gap-2">
                  <div className="flex-1 flex justify-center h-full items-center gap-1">
                    <Fader 
                      defaultValue={50} 
                      value={channel.volume} 
                      onChange={(v) => {
                        setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, volume: v } : c));
                      }} 
                    />
                    <div className="h-full py-1 md:py-4 shrink-0">
                      <ChannelMeter engine={engine} channelId={channel.id} />
                    </div>
                  </div>
                    <div className="flex flex-col justify-between items-center py-1 md:py-0 shrink-0 w-[36px] md:w-[44px] h-full">
                      <Knob label="PAN" value={channel.pan} size={20} labelSize={7} onChange={(v) => {
                        setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, pan: v } : c));
                      }} />
                      <Knob label="DEP" value={channel.depth} size={20} color="#8ab4f8" labelSize={7} onChange={(v) => {
                        setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, depth: v } : c));
                      }} />
                      <Knob label="PIT" value={channel.pitch} size={20} color="#f59e8b" labelSize={7} onChange={(v) => {
                        setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, pitch: v } : c));
                      }} />
                      <Knob label="HI" value={channel.high} size={20} labelSize={7} onChange={(v) => {
                        setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, high: v } : c));
                      }} />
                      <Knob label="MID" value={channel.mid} size={20} labelSize={7} onChange={(v) => {
                        setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, mid: v } : c));
                      }} />
                      <Knob label="LOW" value={channel.low} size={20} labelSize={7} onChange={(v) => {
                        setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, low: v } : c));
                      }} />
                    </div>
                </div>
                <div className="w-full flex justify-center items-center mt-1 shrink-0">
                  <span className="text-[9px] font-mono text-[#8ab4f8] opacity-80">{formatVolume(channel.volume)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column (Cue List & Master Section) */}
        <div className={`w-full lg:w-[280px] xl:w-[320px] flex flex-col gap-2 shrink-0 ${mobileTab === 'cues' || mobileTab === 'master' ? 'flex' : 'hidden lg:flex'}`}>
            
            {/* Extended Cue List */}
            <div className={`flex-1 bg-[#16161a] rounded-xl p-3 flex flex-col min-h-0 border border-white/5 shadow-2xl overflow-hidden ${mobileTab === 'master' ? 'hidden lg:flex' : 'flex'}`}>
               <div className="flex items-center justify-between mb-3 shrink-0">
                 <div className="flex flex-col">
                   <span className="text-[10px] font-black italic tracking-widest text-[#f59e8b] uppercase">Cue List</span>
                   <span className="text-[9px] font-mono text-[#718096] uppercase">{currentCueIdx + 1} / {cues.length || 0}</span>
                 </div>
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                 {cues.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-[#0a0a0c] rounded-xl border border-dashed border-[#3f3f46]/30">
                     <HelpCircle size={24} className="text-[#3f3f46] mb-2 opacity-20" />
                     <p className="text-[10px] text-[#718096] leading-relaxed">右クリックまたは<br/>長押しでキューに追加</p>
                   </div>
                 ) : (
                   cues.map((cue, idx) => (
                     <div 
                       key={cue.id}
                       onClick={() => setCurrentCueIdx(idx)}
                       className={`group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                         idx === currentCueIdx 
                           ? 'bg-[#f59e8b]/10 border-[#f59e8b] shadow-[0_15px_30px_rgba(245,158,139,0.1)]' 
                           : 'bg-[#0a0a0c] border-[#3f3f46]/30 hover:border-[#718096]'
                       }`}
                     >
                       <div className={`text-[10px] font-mono w-6 h-6 flex items-center justify-center rounded-md border ${
                         idx === currentCueIdx ? 'bg-[#f59e8b] text-black border-[#f59e8b]' : 'bg-[#1a1a1e] text-[#718096] border-[#3f3f46]/30'
                       }`}>
                         {idx + 1}
                       </div>
                       <div className="flex-1 min-w-0">
                         <input 
                           type="text"
                           value={cue.label}
                           onChange={(e) => {
                             const newLabel = e.target.value;
                             setCues(prev => prev.map(c => c.id === cue.id ? { ...c, label: newLabel } : c));
                           }}
                           onClick={(e) => e.stopPropagation()}
                           className={`w-full bg-transparent border-none p-0 text-[11px] font-bold focus:ring-0 focus:outline-none transition-colors ${idx === currentCueIdx ? 'text-[#f59e8b]' : 'text-gray-300 hover:text-white'}`}
                         />
                       </div>
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           setCues(prev => prev.filter(c => c.id !== cue.id));
                           if (currentCueIdx >= idx && currentCueIdx > 0) setCurrentCueIdx(prev => prev - 1);
                         }}
                         className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/20 text-red-500 transition-all"
                       >
                         <Trash2 size={12} />
                       </button>
                     </div>
                   ))
                 )}
               </div>

               <div className="mt-3 pt-3 border-t border-white/5 flex gap-2 shrink-0 lg:hidden">
                 <button 
                   onClick={handleGo}
                   disabled={cues.length === 0}
                   className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all active:scale-95 group relative overflow-hidden text-sm font-black italic tracking-wider
                     ${cues.length > 0 
                       ? 'bg-[#f59e8b] text-black border-white/20 shadow-[0_0_15px_rgba(245,158,139,0.3)] hover:brightness-110' 
                       : 'bg-[#1a1a1e] text-[#3f3f46] border-[#3f3f46]/20 opacity-50 cursor-not-allowed'}
                   `}
                 >
                   GO !
                 </button>
                 <button onClick={() => engine.stopAll()} className="aspect-square flex items-center justify-center p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20" title="Stop All">
                   <StopCircle size={18} />
                 </button>
               </div>
            </div>

            {/* Reorganized Master Section: Vertical orientation for better narrow fit */}
            <div className={`tour-master bg-[#16161a] rounded-xl p-3 border border-white/5 flex flex-col gap-3 shadow-xl shrink-0 ${mobileTab === 'cues' ? 'hidden lg:flex' : 'flex'}`}>
               <div className="flex items-center justify-between mb-1">
                 <span className="text-[9px] font-bold text-[#718096] tracking-widest uppercase">Master Output</span>
                 <span className="text-[9px] font-mono text-[#f59e8b]">{formatVolume(master.volume)} dB</span>
               </div>
               
               <div className="flex gap-3 h-[280px]">
                  {/* Master Fader (Left side of section) */}
                  <div className="w-16 md:w-20 bg-[#0a0a0c] rounded-xl border border-[#3f3f46]/20 p-2 flex flex-row items-center gap-2 shrink-0">
                    <div className="flex-1 h-full">
                      <Fader value={master.volume} onChange={(v) => setMaster(prev => ({ ...prev, volume: v }))} color="#f59e8b" />
                    </div>
                    <MasterMeter engine={engine} />
                  </div>

                  {/* Master FX and EQ (Right side of section) */}
                  <div className="flex-1 flex flex-col gap-2 md:gap-3 min-w-0">
                    <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                      {(Object.entries(master.effects) as [keyof typeof master.effects, typeof master.effects.reverb][]).map(([key, fx]) => {
                        const isOn = fx.amount > 0;
                        return (
                          <div key={key} className={`flex flex-col items-center justify-center p-2 rounded-lg border border-[#3f3f46]/20 transition-colors ${isOn ? 'bg-[#8ab4f8]/5 border-[#8ab4f8]/20' : 'bg-[#0a0a0c]'}`}>
                            <span className={`text-[8px] md:text-[10px] font-bold uppercase mb-1 md:mb-2 ${isOn ? 'text-[#8ab4f8]' : 'text-[#718096]'}`}>{String(key).slice(0,3)}</span>
                            <Knob 
                              value={fx.amount} 
                              size={24} 
                              defaultValue={0}
                              color={isOn ? "#8ab4f8" : "#3f3f46"} 
                              onChange={(v) => setMaster(prev => ({ ...prev, effects: { ...prev.effects, [key]: { ...fx, amount: v, on: v > 0 } } }))} 
                            />
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="flex-1 flex flex-nowrap justify-between items-center gap-1 md:gap-2 px-1 py-2 border-t border-white/5 overflow-hidden">
                       <Knob label="HI" value={master.high} size={28} labelSize={9} onChange={v => setMaster(p=>({...p, high:v}))} />
                       <Knob label="MID" value={master.mid} size={28} labelSize={9} onChange={v => setMaster(p=>({...p, mid:v}))} />
                       <Knob label="LOW" value={master.low} size={28} labelSize={9} onChange={v => setMaster(p=>({...p, low:v}))} />
                       <Knob label="PAN" value={master.pan} size={28} labelSize={9} onChange={v => setMaster(p=>({...p, pan:v}))} />
                    </div>
                  </div>
               </div>
            </div>

        </div>
      </div>

      {settingsPadId !== null && (
        <PadSettingsModal
          pad={pads.find(p => p.id === settingsPadId)!}
          onClose={() => setSettingsPadId(null)}
          onRecord={(file: File) => handleFileLoad(settingsPadId, file)}
          onUpdate={(updates) => {
            setPads(prev => prev.map(p => p.id === settingsPadId ? { ...p, ...updates } : p));
          }}
          onClear={() => {
            engine.stopPad(settingsPadId);
            setPads(prev => prev.map(p => p.id === settingsPadId ? { ...p, buffer: null, name: '', memo: '', trimStart: 0, trimEnd: 0, isPlaying: false, progress: 0, audioUrl: null } : p));
            setSettingsPadId(null);
          }}
        />
      )}

      {showTour && <AboutModal onClose={() => setShowTour(false)} onStartTour={() => setTimeout(() => setRunTour(true), 300)} />}
      
      <Joyride
        steps={[
          { target: '.tour-load-btn', content: 'オーディオファイル(.mp3/.wav等)をこのLOADボタンから、または各パッドに直接ドラッグ＆ドロップして読み込めます。', skipBeacon: false },
          { target: '.tour-pads', content: '左側には最大120個のオーディオパッドが並びます（PAGE切り替え可）。タップやキーボードで音を鳴らしてみましょう。右上の歯車アイコンから詳細なパッド設定も可能です。', skipBeacon: true },
          { target: '.tour-channels', content: 'ミキサーセクションで、各チャンネルのボリュームやEQ、PAN（左右の定位）を細かく設定できます。なお、PANなどのツマミ（円形のコントローラー）は、上下にドラッグすることで値を変更できます。', skipBeacon: true },
          { target: '.tour-master', content: 'マスターセクションで全体の音量やDelay/Reverbなどの主要エフェクトをかけ、最終的なサウンドを仕上げます！ここにあるエフェクトの各種ツマミも、同様に上下にドラッグして操作します。', skipBeacon: true },
        ]}
        run={runTour}
        continuous={true}
        locale={{ back: '戻る', close: '閉じる', last: '完了', next: '次へ', skip: 'スキップ' }}
        onEvent={(data: any) => {
          if ([STATUS.FINISHED, STATUS.SKIPPED].includes(data.status as any)) {
            setRunTour(false);
          }
          if (data.type === EVENTS.STEP_BEFORE) {
            if (data.index === 1) setMobileTab('pads');
            if (data.index === 2) setMobileTab('mixer');
            if (data.index === 3) setMobileTab('master');
          }
        }}
        options={{
          zIndex: 10000,
          primaryColor: '#f59e8b',
          arrowColor: '#16161a',
          overlayColor: 'rgba(0, 0, 0, 0.7)',
          showProgress: true,
          overlayClickAction: false,
          buttons: ['back', 'skip', 'primary']
        }}
        styles={{
          tooltip: {
            backgroundColor: '#16161a',
            border: '1px solid #3f3f46',
            borderRadius: '12px',
            padding: '24px',
          },
          tooltipContainer: {
            textAlign: 'left'
          },
          tooltipTitle: {
            color: '#ffffff',
            fontWeight: 'bold',
            marginBottom: '8px'
          },
          tooltipContent: {
            padding: '0 0 16px',
            color: '#e4e4e7',
            fontSize: '14px',
            lineHeight: '1.6'
          },
          buttonPrimary: {
            backgroundImage: 'linear-gradient(to right, #f59e8b, #a78bfa)',
            backgroundColor: 'transparent',
            color: '#16161a',
            fontWeight: 'bold',
            borderRadius: '8px',
            padding: '10px 20px',
            border: 'none',
          },
          buttonBack: {
            color: '#a1a1aa',
            marginRight: '12px'
          },
          buttonSkip: {
            color: '#a1a1aa',
            fontSize: '14px'
          },
          spotlight: {
            fill: 'transparent'
          },
          beaconInner: {
            backgroundColor: '#f59e8b'
          },
          beaconOuter: {
            borderColor: '#f59e8b',
            backgroundColor: 'rgba(245, 158, 139, 0.2)'
          }
        }}
      />

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-[#16161a] border border-red-500/30 rounded-xl w-full max-w-sm flex flex-col shadow-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-2">すべてのパッドを消去しますか？</h2>
            <p className="text-[#a1a1aa] text-sm mb-6">読み込まれているすべての音源を削除し、パッド設定をリセットします。この操作は取り消せません。</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-[#a1a1aa] bg-[#202026] hover:bg-[#3f3f46] transition-colors"
              >
                キャンセル
              </button>
              <button 
                onClick={handleClearAll}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              >
                すべて消去
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
