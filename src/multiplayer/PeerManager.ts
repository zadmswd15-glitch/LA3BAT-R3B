import { Peer, DataConnection } from 'peerjs';
import { NetworkPacket, PlayerNetworkData, MonsterNetworkData, ObserverNetworkData, KillerNetworkData } from '../types';
import { voiceTextChat } from './VoiceTextChat';

export interface PeerManagerCallbacks {
  onPlayerJoin: (id: string, name: string) => void;
  onPlayerLeave: (id: string) => void;
  onPlayerUpdate: (data: PlayerNetworkData) => void;
  onHostStateUpdate: (monster: MonsterNetworkData, observer: ObserverNetworkData, killer: KillerNetworkData) => void;
  onJumpscareTriggered: (type: string) => void;
  onChatMessage?: (senderId: string, senderName: string, text: string) => void;
}

export class PeerManager {
  public peer: Peer | null = null;
  public connections: Map<string, DataConnection> = new Map();
  public myId: string = '';
  public myName: string = 'Survivor';
  public isHost: boolean = false;
  public roomId: string = '';
  public callbacks: PeerManagerCallbacks;

  constructor(callbacks: PeerManagerCallbacks) {
    this.callbacks = callbacks;
  }

  public async hostRoom(customRoomId?: string): Promise<string> {
    let roomCode = customRoomId;
    if (!roomCode) {
      try {
        const res = await fetch('/api/room/random-code');
        const data = await res.json();
        if (data && data.roomCode) {
          roomCode = data.roomCode;
        }
      } catch (err) {
        console.warn('Could not fetch server room code, generating fallback:', err);
      }
    }
    if (!roomCode) {
      const prefixes = ['DARK', 'ROOM', 'VOID', 'NIGHT', 'SHADOW', 'HAUNT', 'HOLLOW'];
      const pref = prefixes[Math.floor(Math.random() * prefixes.length)];
      roomCode = `${pref}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    return new Promise((resolve, reject) => {
      this.roomId = roomCode!;
      this.isHost = true;

      this.peer = new Peer(roomCode!);

      this.peer.on('open', (id) => {
        this.myId = id;
        resolve(id);
      });

      this.peer.on('call', (call) => {
        if (voiceTextChat.localStream) {
          call.answer(voiceTextChat.localStream);
        } else {
          call.answer();
        }
        call.on('stream', (remoteStream) => {
          voiceTextChat.setupPositionalAudio(call.peer, remoteStream);
        });
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.warn('PeerJS error:', err);
        reject(err);
      });
    });
  }

  public joinRoom(targetRoomId: string, playerName: string = 'Survivor'): Promise<string> {
    return new Promise((resolve, reject) => {
      this.roomId = targetRoomId;
      this.myName = playerName;
      this.isHost = false;

      this.peer = new Peer();

      this.peer.on('open', (myPeerId) => {
        this.myId = myPeerId;
        const conn = this.peer!.connect(targetRoomId);

        conn.on('open', () => {
          this.connections.set(targetRoomId, conn);
          this.setupDataListeners(conn);

          // Notify host of join
          this.sendPacket(conn, {
            type: 'PLAYER_JOIN',
            senderId: this.myId,
            payload: { name: this.myName }
          });

          resolve(targetRoomId);
        });

        conn.on('error', (err) => {
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        reject(err);
      });
    });
  }

  private handleIncomingConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.setupDataListeners(conn);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.callbacks.onPlayerLeave(conn.peer);
    });
  }

  private setupDataListeners(conn: DataConnection) {
    conn.on('data', (data: any) => {
      const packet = data as NetworkPacket;
      if (!packet || !packet.type) return;

      switch (packet.type) {
        case 'PLAYER_JOIN':
          this.callbacks.onPlayerJoin(packet.senderId, packet.payload?.name || 'Player');
          if (this.isHost) {
            // Relay to all existing clients
            this.broadcast(packet, conn.peer);
          }
          break;

        case 'PLAYER_LEAVE':
          this.callbacks.onPlayerLeave(packet.senderId);
          break;

        case 'PLAYER_SYNC':
          this.callbacks.onPlayerUpdate(packet.payload as PlayerNetworkData);
          if (this.isHost) {
            // Relay to other clients
            this.broadcast(packet, conn.peer);
          }
          break;

        case 'HOST_SYNC':
          if (!this.isHost) {
            this.callbacks.onHostStateUpdate(
              packet.payload.monster,
              packet.payload.observer,
              packet.payload.killer
            );
          }
          break;

        case 'JUMPSCARE_EVENT':
          this.callbacks.onJumpscareTriggered(packet.payload.type);
          if (this.isHost) {
            this.broadcast(packet, conn.peer);
          }
          break;

        case 'CHAT':
          if (this.callbacks.onChatMessage) {
            this.callbacks.onChatMessage(packet.senderId, packet.payload?.name || 'Player', packet.payload?.text || '');
          }
          if (this.isHost) {
            this.broadcast(packet, conn.peer);
          }
          break;
      }
    });
  }

  public sendChatMessage(text: string) {
    if (!text.trim()) return;
    const packet: NetworkPacket = {
      type: 'CHAT',
      senderId: this.myId,
      payload: { name: this.myName, text: text.trim() }
    };
    this.connections.forEach((conn) => {
      if (conn.open) conn.send(packet);
    });
  }

  public broadcastMyPlayerState(playerData: PlayerNetworkData) {
    const packet: NetworkPacket = {
      type: 'PLAYER_SYNC',
      senderId: this.myId,
      payload: playerData
    };

    this.connections.forEach((conn) => {
      if (conn.open) conn.send(packet);
    });
  }

  public broadcastHostEntitiesState(monster: MonsterNetworkData, observer: ObserverNetworkData, killer: KillerNetworkData) {
    if (!this.isHost) return;
    const packet: NetworkPacket = {
      type: 'HOST_SYNC',
      senderId: this.myId,
      payload: { monster, observer, killer }
    };

    this.connections.forEach((conn) => {
      if (conn.open) conn.send(packet);
    });
  }

  public triggerJumpscareBroadcast(type: string) {
    const packet: NetworkPacket = {
      type: 'JUMPSCARE_EVENT',
      senderId: this.myId,
      payload: { type }
    };

    this.connections.forEach((conn) => {
      if (conn.open) conn.send(packet);
    });
  }

  private sendPacket(conn: DataConnection, packet: NetworkPacket) {
    if (conn.open) conn.send(packet);
  }

  private broadcast(packet: NetworkPacket, excludePeerId?: string) {
    this.connections.forEach((conn, peerId) => {
      if (peerId !== excludePeerId && conn.open) {
        conn.send(packet);
      }
    });
  }

  public getPlayerList(): Array<{ id: string; name: string; isHost: boolean; status: string }> {
    const list: Array<{ id: string; name: string; isHost: boolean; status: string }> = [];
    list.push({
      id: this.myId || 'local-player',
      name: `${this.myName || 'Survivor'} (You)`,
      isHost: this.isHost,
      status: 'Connected (Online)'
    });

    this.connections.forEach((conn, peerId) => {
      list.push({
        id: peerId,
        name: `Survivor_${peerId.slice(0, 5)}`,
        isHost: !this.isHost && peerId === this.roomId,
        status: conn.open ? 'Connected (Online)' : 'Connecting...'
      });
    });

    return list;
  }

  public disconnect() {
    try {
      this.connections.forEach((conn) => {
        try { conn.close(); } catch {}
      });
      this.connections.clear();
      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }
    } catch (e) {
      console.warn('Peer disconnect error:', e);
    }
  }
}
