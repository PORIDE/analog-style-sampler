export interface ChannelState {
  id: number;
  volume: number;
  pan: number;
  depth: number; // Front/Back (Z-axis)
  pitch: number; // 0.5 to 2.0 (Playback Rate)
  high: number;
  mid: number;
  low: number;
  isLoop: boolean;
  mute: boolean;
  solo: boolean;
}

export interface PadState {
  id: number;
  channelId: number;
  name: string;
  memo: string;
  audioUrl: string | null;
  buffer: AudioBuffer | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  pitch: number; // Individual pad pitch
  isLoop: boolean;
  trimStart: number;
  trimEnd: number;
  duration: number;
  fadeIn: number;
  fadeOut: number;
  playMode: 'oneshot' | 'toggle' | 'gate' | 'retrigger';
  exclusive: boolean;
  polyMode: 'column' | 'unlimited';
  keybind: string;
  mute: boolean;
  solo: boolean;
  effects?: {
    reverb: number;
    delay: number;
    radio: number;
    muffle: number;
  };
}

export interface CueAction {
  id: string;
  padId: number;
  type: 'start' | 'stop';
  delay: number;
}

export interface Cue {
  id: string;
  label: string;
  actions: CueAction[];
  notes: string;
}

export interface MasterState {
  volume: number;
  pan: number;
  high: number;
  mid: number;
  low: number;
  effects: {
    reverb: { on: boolean; amount: number };
    delay: { on: boolean; amount: number };
    radio: { on: boolean; amount: number };
    muffle: { on: boolean; amount: number };
  };
}

export interface ProjectState {
  channels: ChannelState[];
  pads: Omit<PadState, 'buffer' | 'isPlaying' | 'progress'>[];
  master: MasterState;
  cues: Cue[];
}
