// Voice and Text Chat system with WebAudio spatial panner nodes and PeerJS voice streams
export class VoiceTextChat {
  public localStream: MediaStream | null = null;
  public muted: boolean = true;
  public audioCtx: AudioContext | null = null;
  public connections: Map<string, { call?: any; source?: MediaStreamAudioSourceNode; pannerNode?: PannerNode; gainNode?: GainNode }> = new Map();
  public audioParams = { maxDistance: 35, refDistance: 1, rolloff: 1.5 };

  public onTextMessage: ((senderId: string, senderName: string, text: string) => void) | null = null;
  public onPeerConnected: ((peerId: string) => void) | null = null;
  public onPeerDisconnected: ((peerId: string) => void) | null = null;
  public onError: ((err: any) => void) | null = null;

  public async initAudioStream(): Promise<boolean> {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      // Start muted by default
      this.localStream.getAudioTracks().forEach((t) => (t.enabled = false));
      this.muted = true;
      return true;
    } catch (e) {
      console.warn('Microphone access denied or unequipped:', e);
      return false;
    }
  }

  public toggleMute(): boolean {
    if (!this.localStream) {
      this.muted = true;
      return true;
    }
    this.muted = !this.muted;
    this.localStream.getAudioTracks().forEach((t) => (t.enabled = !this.muted));
    return this.muted;
  }

  public setupPositionalAudio(peerId: string, remoteStream: MediaStream) {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) this.audioCtx = new AudioContextClass();
    }
    if (!this.audioCtx) return;

    try {
      const source = this.audioCtx.createMediaStreamSource(remoteStream);
      const panner = this.audioCtx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'linear';
      panner.refDistance = this.audioParams.refDistance;
      panner.maxDistance = this.audioParams.maxDistance;
      panner.rolloffFactor = this.audioParams.rolloff;

      const gainNode = this.audioCtx.createGain();
      source.connect(panner).connect(gainNode).connect(this.audioCtx.destination);

      const entry = this.connections.get(peerId) || {};
      entry.source = source;
      entry.pannerNode = panner;
      entry.gainNode = gainNode;
      this.connections.set(peerId, entry);
    } catch (e) {
      console.warn('Positional audio setup failed for peer:', peerId, e);
    }
  }

  public updateListenerPosition(x: number, y: number, z: number, forwardX = 0, forwardY = 0, forwardZ = -1, upX = 0, upY = 1, upZ = 0) {
    if (!this.audioCtx) return;
    const listener = this.audioCtx.listener;
    if (listener.positionX) {
      listener.positionX.value = x; listener.positionY.value = y; listener.positionZ.value = z;
      listener.forwardX.value = forwardX; listener.forwardY.value = forwardY; listener.forwardZ.value = forwardZ;
      listener.upX.value = upX; listener.upY.value = upY; listener.upZ.value = upZ;
    } else if ((listener as any).setPosition) {
      (listener as any).setPosition(x, y, z);
      (listener as any).setOrientation(forwardX, forwardY, forwardZ, upX, upY, upZ);
    }
  }

  public updatePeerPosition(peerId: string, x: number, y: number, z: number) {
    const entry = this.connections.get(peerId);
    if (!entry || !entry.pannerNode) return;
    const panner = entry.pannerNode;
    if (panner.positionX) {
      panner.positionX.value = x; panner.positionY.value = y; panner.positionZ.value = z;
    } else if ((panner as any).setPosition) {
      (panner as any).setPosition(x, y, z);
    }
  }

  public cleanupPeer(peerId: string) {
    const entry = this.connections.get(peerId);
    if (entry) {
      if (entry.source) try { entry.source.disconnect(); } catch {}
      if (entry.pannerNode) try { entry.pannerNode.disconnect(); } catch {}
      if (entry.gainNode) try { entry.gainNode.disconnect(); } catch {}
    }
    this.connections.delete(peerId);
  }

  public destroy() {
    this.connections.forEach((_, id) => this.cleanupPeer(id));
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}

export const voiceTextChat = new VoiceTextChat();
