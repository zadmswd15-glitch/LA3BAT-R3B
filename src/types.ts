export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  voice: number;
  muteUnfocused: boolean;
  binaural: boolean;
}

export interface PlayerStats {
  health: number; // 0 - 100
  hunger: number; // 0 - 100 (الجوع)
  thirst: number; // 0 - 100 (العطش)
  points: number;
  isDead: boolean;
}

export interface ActivePowerups {
  speedBoostRemaining: number; // seconds remaining
  superJumpRemaining: number;
  invincibleRemaining: number;
}

export interface Vector3Simple {
  x: number;
  y: number;
  z: number;
}

export interface PlayerNetworkData {
  id: string;
  name: string;
  position: Vector3Simple;
  rotationY: number;
  headPitch: number;
  isWalking: boolean;
  isRunning: boolean;
  isCrouching: boolean;
  flashlightOn: boolean;
  health: number;
  hunger: number;
  thirst: number;
  points: number;
  invincible: boolean;
  speedBoost: boolean;
}

export interface MonsterNetworkData {
  position: Vector3Simple;
  rotationY: number;
  state: 'patrol' | 'chase' | 'jumpscare' | 'frightened';
  targetPlayerId?: string;
}

export interface KillerNetworkData {
  active: boolean;
  position: Vector3Simple;
  rotationY: number;
  targetPlayerId?: string;
}

export interface ObserverNetworkData {
  headRotationY: number;
  headPitch: number;
}

export interface NetworkPacket {
  type: 'PLAYER_SYNC' | 'HOST_SYNC' | 'JUMPSCARE_EVENT' | 'CHAT' | 'PLAYER_JOIN' | 'PLAYER_LEAVE';
  senderId: string;
  payload: any;
}

export interface ShopItem {
  id: string;
  nameEn: string;
  nameAr: string;
  cost: number;
  description: string;
  duration?: number;
}
