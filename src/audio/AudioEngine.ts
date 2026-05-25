export class AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  masterAnalyser: AnalyserNode;
  masterEq: { high: BiquadFilterNode; mid: BiquadFilterNode; low: BiquadFilterNode };
  masterPan: StereoPannerNode;
  
  auxEffects: {
    reverb: { node: ConvolverNode, input: GainNode, output: GainNode },
    delay: { node: DelayNode, feedback: GainNode, input: GainNode, output: GainNode },
  };

  effects: {
    reverb: { node: ConvolverNode, dry: GainNode, wet: GainNode, input: GainNode, output: GainNode },
    delay: { node: DelayNode, feedback: GainNode, dry: GainNode, wet: GainNode, input: GainNode, output: GainNode },
    radio: { node: BiquadFilterNode, dry: GainNode, wet: GainNode, input: GainNode, output: GainNode },
    muffle: { node: BiquadFilterNode, dry: GainNode, wet: GainNode, input: GainNode, output: GainNode },
  };

  channels: {
    [id: number]: {
      gain: GainNode;
      panner: PannerNode;
      eq: { high: BiquadFilterNode; mid: BiquadFilterNode; low: BiquadFilterNode };
      pitch: number;
      analyser: AnalyserNode;
    }
  } = {};

  padSources: Map<number, {
    source: AudioBufferSourceNode;
    gain: GainNode;
    channelId: number;
    padPitch: number;
    startTime: number;
    offset: number;
    duration: number;
    animationFrame: number;
    fadeOut: number;
    fxSends?: { reverbSend: GainNode; delaySend: GainNode };
  }> = new Map();

  soloedChannels: Set<number> = new Set();

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    this.masterGain = this.ctx.createGain();
    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 256;
    this.masterPan = this.ctx.createStereoPanner();
    
    this.masterEq = {
      high: this.ctx.createBiquadFilter(),
      mid: this.ctx.createBiquadFilter(),
      low: this.ctx.createBiquadFilter()
    };
    
    this.masterEq.low.type = 'lowshelf';
    this.masterEq.low.frequency.value = 320;
    this.masterEq.mid.type = 'peaking';
    this.masterEq.mid.frequency.value = 1000;
    this.masterEq.mid.Q.value = 0.5;
    this.masterEq.high.type = 'highshelf';
    this.masterEq.high.frequency.value = 3200;

    this.masterEq.low.connect(this.masterEq.mid);
    this.masterEq.mid.connect(this.masterEq.high);
    this.masterEq.high.connect(this.masterPan);
    
    // Aux Effects setup (for per-pad sends)
    this.auxEffects = {
      reverb: { input: this.ctx.createGain(), node: this.ctx.createConvolver(), output: this.ctx.createGain() },
      delay: { input: this.ctx.createGain(), node: this.ctx.createDelay(), feedback: this.ctx.createGain(), output: this.ctx.createGain() }
    };

    // Shared impulse for Aux Reverb
    const auxLength = this.ctx.sampleRate * 2;
    const auxImpulse = this.ctx.createBuffer(2, auxLength, this.ctx.sampleRate);
    for (let i = 0; i < 2; i++) {
      const channel = auxImpulse.getChannelData(i);
      for (let j = 0; j < auxLength; j++) {
        channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / auxLength, 3);
      }
    }
    
    // Aux Reverb configuration
    this.auxEffects.reverb.node.buffer = auxImpulse;
    this.auxEffects.reverb.input.connect(this.auxEffects.reverb.node);
    this.auxEffects.reverb.node.connect(this.auxEffects.reverb.output);
    this.auxEffects.reverb.output.connect(this.masterGain);

    // Aux Delay configuration
    this.auxEffects.delay.node.delayTime.value = 0.3;
    this.auxEffects.delay.feedback.gain.value = 0.4;
    this.auxEffects.delay.input.connect(this.auxEffects.delay.node);
    this.auxEffects.delay.node.connect(this.auxEffects.delay.feedback);
    this.auxEffects.delay.feedback.connect(this.auxEffects.delay.node);
    this.auxEffects.delay.node.connect(this.auxEffects.delay.output);
    this.auxEffects.delay.output.connect(this.masterGain);

    const createEffectMixer = () => ({
      input: this.ctx.createGain(),
      dry: this.ctx.createGain(),
      wet: this.ctx.createGain(),
      output: this.ctx.createGain()
    });

    this.effects = {
      reverb: { ...createEffectMixer(), node: this.ctx.createConvolver() },
      delay: { ...createEffectMixer(), node: this.ctx.createDelay(), feedback: this.ctx.createGain() },
      radio: { ...createEffectMixer(), node: this.ctx.createBiquadFilter() },
      muffle: { ...createEffectMixer(), node: this.ctx.createBiquadFilter() }
    };

    // Setup Reverb
    const length = this.ctx.sampleRate * 2;
    const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    for (let i = 0; i < 2; i++) {
      const channel = impulse.getChannelData(i);
      for (let j = 0; j < length; j++) {
        channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 3);
      }
    }
    this.effects.reverb.node.buffer = impulse;

    // Setup Delay
    this.effects.delay.node.delayTime.value = 0.3;
    this.effects.delay.feedback.gain.value = 0.4;
    this.effects.delay.node.connect(this.effects.delay.feedback);
    this.effects.delay.feedback.connect(this.effects.delay.node);

    // Setup Radio
    this.effects.radio.node.type = 'bandpass';
    this.effects.radio.node.frequency.value = 1500;
    this.effects.radio.node.Q.value = 1.5;

    // Setup Muffle
    this.effects.muffle.node.type = 'lowpass';
    this.effects.muffle.node.frequency.value = 400;

    // Connect effects chain
    const fxOrder = ['reverb', 'delay', 'radio', 'muffle'] as const;
    
    this.masterPan.connect(this.effects.reverb.input);
    
    for (let i = 0; i < fxOrder.length; i++) {
      const fx = this.effects[fxOrder[i]];
      fx.input.connect(fx.dry);
      fx.input.connect(fx.node);
      fx.node.connect(fx.wet);
      fx.dry.connect(fx.output);
      fx.wet.connect(fx.output);
      
      fx.dry.gain.value = 1;
      fx.wet.gain.value = 0;

      if (i < fxOrder.length - 1) {
        fx.output.connect(this.effects[fxOrder[i+1]].input);
      } else {
        fx.output.connect(this.masterGain);
      }
    }
    
    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);
  }

  async loadAudio(file: File): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    return await this.ctx.decodeAudioData(arrayBuffer);
  }

  async loadAudioFromUrl(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return await this.ctx.decodeAudioData(arrayBuffer);
  }

  setupChannel(id: number) {
    if (this.channels[id]) return;
    
    const gain = this.ctx.createGain();
    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2.5; // Slightly larger for smoother volume falloff
    panner.maxDistance = 10000;
    panner.rolloffFactor = 1.0;
    
    // Set listener position to default
    if (this.ctx.listener.positionX) {
      this.ctx.listener.positionX.setValueAtTime(0, this.ctx.currentTime);
      this.ctx.listener.positionY.setValueAtTime(0, this.ctx.currentTime);
      this.ctx.listener.positionZ.setValueAtTime(0, this.ctx.currentTime);
    } else {
      // Legacy support
      this.ctx.listener.setPosition(0, 0, 0);
    }
    
    const eq = {
      high: this.ctx.createBiquadFilter(),
      mid: this.ctx.createBiquadFilter(),
      low: this.ctx.createBiquadFilter()
    };

    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 64; // Smaller fftSize for performance, we just need basic levels
    analyser.smoothingTimeConstant = 0.8;

    eq.low.type = 'lowshelf';
    eq.low.frequency.value = 320;
    eq.mid.type = 'peaking';
    eq.mid.frequency.value = 1000;
    eq.mid.Q.value = 0.5;
    eq.high.type = 'highshelf';
    eq.high.frequency.value = 3200;

    eq.low.connect(eq.mid);
    eq.mid.connect(eq.high);
    eq.high.connect(panner);
    panner.connect(gain);
    gain.connect(analyser); // connect to analyser
    
    // Connect to master EQ input
    gain.connect(this.masterEq.low);

    this.channels[id] = { gain, panner, eq, pitch: 50, analyser };
  }

  private getPlaybackRate(pitch: number) {
    const rate = Math.pow(2, ((pitch ?? 50) - 50) / 50);
    return isFinite(rate) ? rate : 1.0;
  }

  getChannelLevel(id: number): number {
    if (!this.channels[id]) return 0;
    const analyser = this.channels[id].analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i];
    }
    return sum / data.length / 255;
  }

  updateChannel(id: number, volume: number, pan: number, depth: number, pitch: number, high: number, mid: number, low: number) {
    if (!this.channels[id]) this.setupChannel(id);
    const ch = this.channels[id];
    ch.pitch = pitch ?? 50;
    
    // Volume: 0-100. 50 is 0dB (gain 1)
    let gainValue = volume === 0 ? 0 : Math.pow(volume / 50, 2);
    if (!isFinite(gainValue)) gainValue = 0;
    ch.gain.gain.setTargetAtTime(gainValue, this.ctx.currentTime, 0.01);
    
    // 3D Pan: Map for more dramatic effect
    // X: -4 to 4 (Left/Right)
    // Z: -5 (Front) to 10 (Back)
    const x = isFinite((pan - 50) / 50) ? ((pan - 50) / 50) * 4 : 0;
    const z = isFinite((depth - 50) / 50) ? ((depth - 50) / 50) * 10 : 0; 
    
    // Using a longer time constant for much smoother movement
    const smoothTime = 0.15;
    ch.panner.positionX.setTargetAtTime(x, this.ctx.currentTime, smoothTime);
    ch.panner.positionZ.setTargetAtTime(z, this.ctx.currentTime, smoothTime);
    ch.panner.positionY.setTargetAtTime(0, this.ctx.currentTime, smoothTime);
    
    // Depth-based filtering (Psychoacoustic DEPth)
    // As things move back, they lose some high end
    const depthMuffle = Math.max(0, depth - 50) / 100; // 0 to 0.5
    const depthFreq = 20000 * Math.pow(0.1, depthMuffle); // 20kHz down to 6.3kHz
    ch.eq.high.frequency.setTargetAtTime(depthFreq, this.ctx.currentTime, smoothTime);
    
    // Apply pitch to active pads on this channel
    const channelRate = this.getPlaybackRate(ch.pitch);
    this.padSources.forEach((active) => {
      if (active.channelId === id) {
        const padRate = this.getPlaybackRate(active.padPitch);
        const totalRate = padRate * channelRate;
        if (isFinite(totalRate)) {
          active.source.playbackRate.setTargetAtTime(totalRate, this.ctx.currentTime, 0.01);
        }
      }
    });

    // EQ
    ch.eq.high.gain.value = isFinite(((high - 50) / 50) * 12) ? ((high - 50) / 50) * 12 : 0;
    ch.eq.mid.gain.value = isFinite(((mid - 50) / 50) * 12) ? ((mid - 50) / 50) * 12 : 0;
    ch.eq.low.gain.value = isFinite(((low - 50) / 50) * 12) ? ((low - 50) / 50) * 12 : 0;
  }

  updateMaster(volume: number, pan: number, high: number, mid: number, low: number, effects: any) {
    const gainValue = volume === 0 ? 0 : Math.pow(volume / 50, 2);
    this.masterGain.gain.setTargetAtTime(gainValue, this.ctx.currentTime, 0.05);
    this.masterPan.pan.setTargetAtTime((pan - 50) / 50, this.ctx.currentTime, 0.05);
    
    const smoothFactor = 0.05;
    this.masterEq.high.gain.setTargetAtTime(((high - 50) / 50) * 12, this.ctx.currentTime, smoothFactor);
    this.masterEq.mid.gain.setTargetAtTime(((mid - 50) / 50) * 12, this.ctx.currentTime, smoothFactor);
    this.masterEq.low.gain.setTargetAtTime(((low - 50) / 50) * 12, this.ctx.currentTime, smoothFactor);

    const fxOrder = ['reverb', 'delay', 'radio', 'muffle'] as const;
    for (const name of fxOrder) {
      const fxState = effects[name];
      const fx = this.effects[name];
      if (fxState && fxState.on) {
        const amount = fxState.amount / 100;
        fx.dry.gain.setTargetAtTime(Math.cos(amount * 0.5 * Math.PI), this.ctx.currentTime, smoothFactor);
        fx.wet.gain.setTargetAtTime(Math.sin(amount * 0.5 * Math.PI), this.ctx.currentTime, smoothFactor);
      } else {
        fx.dry.gain.setTargetAtTime(1, this.ctx.currentTime, smoothFactor);
        fx.wet.gain.setTargetAtTime(0, this.ctx.currentTime, smoothFactor);
      }
    }
  }

  playPad(padId: number, buffer: AudioBuffer, channelId: number, volume: number, pitch: number, isLoop: boolean, trimStart: number, trimEnd: number, fadeIn: number, fadeOut: number, fxSendAmounts: { reverb: number; delay: number; radio?: number; muffle?: number }, onProgress: (p: number) => void, onEnd: () => void) {
    this.stopPad(padId);
    if (this.ctx.state === 'suspended') this.ctx.resume();

    if (!this.channels[channelId]) this.setupChannel(channelId);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = isLoop;
    
    // Apply Pitch (Combined Pad + Channel Pitch)
    const padRate = this.getPlaybackRate(pitch);
    const channelRate = this.getPlaybackRate(this.channels[channelId]?.pitch ?? 50);
    const totalRate = padRate * channelRate;
    source.playbackRate.value = isFinite(totalRate) ? totalRate : 1.0;
    
    if (isLoop) {
      source.loopStart = trimStart;
      source.loopEnd = trimEnd;
    }

    const gain = this.ctx.createGain();
    
    // Volume
    let gainValue = volume === 0 ? 0 : Math.pow(volume / 50, 2);
    if (!isFinite(gainValue)) gainValue = 0;
    
    // Fade in to prevent click
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    const actualFadeIn = fadeIn > 0 ? fadeIn : 0.005;
    gain.gain.setTargetAtTime(gainValue, this.ctx.currentTime, actualFadeIn / 3);

    source.connect(gain);
    
    let lastNode: AudioNode = gain;

    // RAD Insert
    if (fxSendAmounts?.radio && fxSendAmounts.radio > 0) {
      const radioFilter = this.ctx.createBiquadFilter();
      radioFilter.type = 'bandpass';
      radioFilter.frequency.value = 1500;
      radioFilter.Q.value = 1.5;
      
      const radioMix = this.ctx.createGain();
      
      const wet = this.ctx.createGain();
      wet.gain.value = fxSendAmounts.radio / 100;
      const dry = this.ctx.createGain();
      dry.gain.value = 1 - (fxSendAmounts.radio / 100);

      lastNode.connect(radioFilter);
      radioFilter.connect(wet);
      wet.connect(radioMix);

      lastNode.connect(dry);
      dry.connect(radioMix);

      lastNode = radioMix;
    }

    // MUF Insert
    if (fxSendAmounts?.muffle && fxSendAmounts.muffle > 0) {
      const muffleFilter = this.ctx.createBiquadFilter();
      muffleFilter.type = 'lowpass';
      muffleFilter.frequency.value = 20000 - (fxSendAmounts.muffle / 100) * 19600;
      lastNode.connect(muffleFilter);
      lastNode = muffleFilter;
    }

    lastNode.connect(this.channels[channelId].eq.low);

    // Aux Sends
    const reverbSend = this.ctx.createGain();
    reverbSend.gain.value = Math.pow((fxSendAmounts?.reverb || 0) / 100, 2);
    lastNode.connect(reverbSend);
    reverbSend.connect(this.auxEffects.reverb.input);

    const delaySend = this.ctx.createGain();
    delaySend.gain.value = Math.pow((fxSendAmounts?.delay || 0) / 100, 2);
    lastNode.connect(delaySend);
    delaySend.connect(this.auxEffects.delay.input);

    const duration = trimEnd - trimStart;
    source.start(0, trimStart, isLoop ? undefined : duration);

    const startTime = this.ctx.currentTime;

    const updateProgress = () => {
      const active = this.padSources.get(padId);
      if (!active) return;
      
      let elapsed = this.ctx.currentTime - startTime;
      if (isLoop) {
        elapsed = elapsed % duration;
      }
      
      const progress = (elapsed / duration) * 100;
      
      if (!isLoop && elapsed >= duration) {
        this.stopPad(padId);
        onEnd();
      } else {
        onProgress(Math.min(100, Math.max(0, progress)));
        active.animationFrame = requestAnimationFrame(updateProgress);
      }
    };

    source.onended = () => {
      const active = this.padSources.get(padId);
      if (!isLoop && active && active.source === source) {
        this.stopPad(padId);
        onEnd();
      }
    };

    this.padSources.set(padId, {
      source,
      gain,
      channelId,
      padPitch: pitch,
      startTime,
      offset: trimStart,
      duration,
      animationFrame: requestAnimationFrame(updateProgress),
      fadeOut: fadeOut > 0 ? fadeOut : 0.05,
      fxSends: { reverbSend, delaySend }
    });
  }

  stopPad(padId: number) {
    const active = this.padSources.get(padId);
    if (active) {
      cancelAnimationFrame(active.animationFrame);
      this.padSources.delete(padId);
      
      // Fade out to prevent click
      const fadeOutTime = active.fadeOut;
      active.gain.gain.setTargetAtTime(0, this.ctx.currentTime, fadeOutTime / 3);
      
      try { active.source.stop(this.ctx.currentTime + fadeOutTime); } catch (e) {}
      
      setTimeout(() => {
        active.source.disconnect();
        active.gain.disconnect();
        if (active.fxSends) {
          active.fxSends.reverbSend.disconnect();
          active.fxSends.delaySend.disconnect();
        }
      }, fadeOutTime * 1000 + 50);
    }
  }

  updatePadVolume(padId: number, volume: number) {
    const active = this.padSources.get(padId);
    if (active) {
      const gainValue = volume === 0 ? 0 : Math.pow(volume / 50, 2);
      active.gain.gain.setTargetAtTime(gainValue, this.ctx.currentTime, 0.01);
    }
  }

  updatePadPitch(padId: number, pitch: number) {
    const active = this.padSources.get(padId);
    if (active) {
      const playbackRate = Math.pow(2, (pitch - 50) / 50);
      active.source.playbackRate.setTargetAtTime(playbackRate, this.ctx.currentTime, 0.01);
    }
  }

  stopAll() {
    this.padSources.forEach((_, id) => {
      this.stopPad(id);
    });
  }
}
