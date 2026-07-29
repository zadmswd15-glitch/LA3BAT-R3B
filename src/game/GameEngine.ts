import * as THREE from 'three';
import { PlayerEntity } from '../entities/PlayerEntity';
import { MapBuilder } from '../graphics/MapBuilder';
import { MonsterAI } from '../entities/MonsterAI';
import { CriminalObserverAI } from '../entities/CriminalObserverAI';
import { KnifeKillerAI } from '../entities/KnifeKillerAI';
import { RemotePlayer } from '../entities/RemotePlayer';
import { PeerManager } from '../multiplayer/PeerManager';
import { soundSystem } from '../audio/SoundSystem';
import { ShopItem, PlayerNetworkData } from '../types';

export interface GameUIBridge {
  updateHUD: (
    health: number,
    hunger: number,
    thirst: number,
    points: number,
    powerups: { speed: number; jump: number; shield: number },
    roomInfo: { id: string; count: number; isHost: boolean; playerList?: Array<{ id: string; name: string; isHost: boolean; status: string }> },
    dayInfo?: { currentDay: number; activeQuest: string; monsterHp?: number; monsterMaxHp?: number; isDefeated?: boolean }
  ) => void;
  showJumpscare: (type: string) => void;
  showGameOver: (stats: { timeSurvived: number; pointsEarned: number; killersEvaded: number }) => void;
  showNotification: (text: string) => void;
  onChatMessage?: (senderId: string, senderName: string, text: string) => void;
}

export class GameEngine {
  public container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  public player: PlayerEntity;
  public mapBuilder: MapBuilder;
  public monster: MonsterAI;
  public observer: CriminalObserverAI;
  public killer: KnifeKillerAI;

  public remotePlayers: Map<string, RemotePlayer> = new Map();
  public peerManager: PeerManager;
  public uiBridge: GameUIBridge;

  private isRunning: boolean = false;
  private clock: THREE.Clock = new THREE.Clock();

  // Survival Timers
  private pointTimer: number = 0;
  private decayTimer: number = 0;
  private syncTimer: number = 0;
  private timeSurvivedSeconds: number = 0;
  private killersEvadedCount: number = 0;

  // Shop Catalogue
  public shopItems: ShopItem[] = [
    { id: 'speed', nameEn: 'Speed Boost (+50%)', nameAr: 'زيادة السرعة 50%', cost: 50, duration: 30, description: 'Sprints 50% faster for 30 seconds.' },
    { id: 'jump', nameEn: 'Super Jump', nameAr: 'قفزة خارقة', cost: 50, duration: 30, description: 'Jump twice as high for 30 seconds.' },
    { id: 'shield', nameEn: 'Invincibility Shield', nameAr: 'درع اللاحصانة', cost: 120, duration: 90, description: 'Complete immunity from Monster & Killer attacks for 90s.' },
    { id: 'food_drink', nameEn: 'Food & Drink Pack', nameAr: 'وجبة طعام وشراب', cost: 30, description: 'Refills Hunger and Thirst meters to 100%.' },
    { id: 'medkit', nameEn: 'First-Aid Medkit', nameAr: 'حقيبة إسعافات', cost: 40, description: 'Restores Health back to 100%.' }
  ];

  constructor(container: HTMLElement, uiBridge: GameUIBridge) {
    this.container = container;
    this.uiBridge = uiBridge;

    // Three.js Scene Setup
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // Build World & Entities
    this.mapBuilder = new MapBuilder(this.scene);
    this.mapBuilder.buildMap();

    this.player = new PlayerEntity(this.camera, this.scene);
    this.player.attachMouseLook(this.renderer.domElement);
    this.monster = new MonsterAI(this.scene);
    this.observer = new CriminalObserverAI(this.scene);
    this.killer = new KnifeKillerAI(this.scene);

    // Setup WebRTC Multiplayer Manager
    this.peerManager = new PeerManager({
      onPlayerJoin: (id, name) => {
        if (!this.remotePlayers.has(id)) {
          const remote = new RemotePlayer(id, name, this.scene);
          this.remotePlayers.set(id, remote);
          this.uiBridge.showNotification(`Survivor "${name}" joined the house.`);
        }
      },
      onPlayerLeave: (id) => {
        const remote = this.remotePlayers.get(id);
        if (remote) {
          remote.destroy(this.scene);
          this.remotePlayers.delete(id);
          this.uiBridge.showNotification(`A survivor was disconnected.`);
        }
      },
      onPlayerUpdate: (data) => {
        const remote = this.remotePlayers.get(data.id);
        if (remote) {
          remote.updateData(data);
        } else {
          const remoteNew = new RemotePlayer(data.id, data.name, this.scene);
          remoteNew.updateData(data);
          this.remotePlayers.set(data.id, remoteNew);
        }
      },
      onHostStateUpdate: (monsterData, observerData, killerData) => {
        this.monster.applyNetworkData(monsterData);
        this.killer.applyNetworkData(killerData);
      },
      onJumpscareTriggered: (type) => {
        this.uiBridge.showJumpscare(type);
      },
      onChatMessage: (senderId, senderName, text) => {
        if (this.uiBridge.onChatMessage) {
          this.uiBridge.onChatMessage(senderId, senderName, text);
        }
      }
    });

    // Handle Window Resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    soundSystem.init();
    this.animate();
  }

  public buyShopItem(itemId: string): boolean {
    const item = this.shopItems.find((i) => i.id === itemId);
    if (!item) return false;

    if (this.player.stats.points < item.cost) {
      this.uiBridge.showNotification('Not enough points! (يحتاج نقاط أكثر)');
      return false;
    }

    this.player.stats.points -= item.cost;
    soundSystem.playShopBuy();

    switch (item.id) {
      case 'speed':
        this.player.powerups.speedBoostRemaining = item.duration || 30;
        this.uiBridge.showNotification('Speed Boost Activated! (+50% Speed)');
        break;
      case 'jump':
        this.player.powerups.superJumpRemaining = item.duration || 30;
        this.uiBridge.showNotification('Super Jump Activated!');
        break;
      case 'shield':
        this.player.powerups.invincibleRemaining = item.duration || 90;
        this.uiBridge.showNotification('Invincibility Shield Activated! (Immune for 90s)');
        break;
      case 'food_drink':
        this.player.stats.hunger = 100;
        this.player.stats.thirst = 100;
        this.uiBridge.showNotification('Hunger & Thirst Refilled (100%)!');
        break;
      case 'medkit':
        this.player.stats.health = 100;
        this.uiBridge.showNotification('Health fully restored!');
        break;
    }

    return true;
  }

  public interactNearestObject() {
    const pPos = this.player.position;

    // Check Supermarket Counter proximity for shop
    if (pPos.distanceTo(this.mapBuilder.supermarketCounterPos) < 3.5) {
      // Open shop trigger
      return 'shop';
    }

    // Check Laptop Screen proximity for code/jumpscare
    for (const laptop of this.mapBuilder.laptopScreens) {
      const laptopWorldPos = new THREE.Vector3();
      laptop.mesh.getWorldPosition(laptopWorldPos);
      if (pPos.distanceTo(laptopWorldPos) < 2.2) {
        // Random 30% chance laptop pops out a terrifying jumpscare!
        if (Math.random() < 0.35) {
          this.triggerJumpscare('laptop');
        } else {
          this.uiBridge.showNotification('Inspecting Laptop Code... "HOLLOW_HOUSE.js"');
          this.player.stats.points += 20;
        }
        return 'laptop';
      }
    }

    // Check Consumable Pickup items in supermarket
    for (const item of this.mapBuilder.consumables) {
      if (!item.collected && pPos.distanceTo(item.position) < 2.0) {
        item.collected = true;
        this.scene.remove(item.mesh);
        soundSystem.playShopBuy();

        if (item.type === 'food') {
          this.player.stats.hunger = Math.min(100, this.player.stats.hunger + 35);
          this.uiBridge.showNotification('Collected Canned Food! (أكل طعام)');
        } else {
          this.player.stats.thirst = Math.min(100, this.player.stats.thirst + 35);
          this.uiBridge.showNotification('Collected Fresh Water! (شرب ماء)');
        }
        this.player.stats.points += 15;
        return 'consumable';
      }
    }

    return null;
  }

  public fireWeapon(weaponType: string = 'laser_gun') {
    if (this.player.stats.isDead) return;
    soundSystem.playWeaponShot();

    // Create temporary laser / projectile beam mesh
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);

    const beamGeo = new THREE.CylinderGeometry(0.04, 0.04, 14, 8);
    let beamColor = 0xff2244;
    if (weaponType === 'water_gun') beamColor = 0x00d2ff;
    if (weaponType === 'stunner') beamColor = 0xffff00;
    if (weaponType === 'shotgun') beamColor = 0xffa500;

    const beamMat = new THREE.MeshBasicMaterial({ color: beamColor, transparent: true, opacity: 0.85 });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);

    const startPos = this.player.position.clone();
    beamMesh.position.copy(startPos.clone().addScaledVector(camDir, 7));
    beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), camDir);
    this.scene.add(beamMesh);

    setTimeout(() => {
      this.scene.remove(beamMesh);
    }, 180);

    // Calculate Day progression
    const currentDay = Math.min(30, 1 + Math.floor(this.timeSurvivedSeconds / 15));

    // Distance to monster
    const monsterVec = this.monster.position.clone().sub(this.player.position);
    const distToMonster = monsterVec.length();
    monsterVec.normalize();
    const angle = camDir.angleTo(monsterVec);

    if (distToMonster < 16 && angle < 0.7) {
      if (currentDay < 12) {
        this.uiBridge.showNotification(`DAY ${currentDay}: Monster is unaffected! Wait until Day 12 to frighten it!`);
      } else if (currentDay < 30) {
        this.monster.frighten(6);
        this.player.stats.points += 50;
        this.uiBridge.showNotification(`DAY ${currentDay}: 😱 FRIGHTENED THE MONSTER! It is fleeing in terror! (+50 Pts)`);
      } else {
        // Day 30 Final Battle
        this.monster.takeDamage(25);
        this.player.stats.points += 100;
        if (this.monster.isDefeated) {
          this.uiBridge.showNotification('🎉 DAY 30 VICTORY: YOU DEFEATED THE SHADOW MONSTER IN THE FINAL SHOWDOWN!');
        } else {
          this.uiBridge.showNotification(`💥 DAY 30 BOSS FIGHT: Hit Monster! Monster HP: ${this.monster.health}/${this.monster.maxHealth}`);
        }
      }
    } else {
      this.uiBridge.showNotification(`Fired ${weaponType.replace('_', ' ')}!`);
    }
  }

  public triggerJumpscare(type: string = 'monster') {
    soundSystem.playJumpscareScream();
    this.uiBridge.showJumpscare(type);
    this.peerManager.triggerJumpscareBroadcast(type);
  }

  public respawnPlayer() {
    this.player.respawn(new THREE.Vector3(-2, 1.6, 8));
  }

  private animate = () => {
    if (!this.isRunning) return;
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);

    // 1. Update Player & Controls
    this.player.update(delta, this.mapBuilder.collisionBoxes);

    // 2. Update Map Animations
    this.mapBuilder.update();

    // 3. Update Monster, Observer, Knife Killer AIs
    this.monster.update(delta, this.player.position, this.peerManager.isHost);
    this.observer.update(delta, this.player.position);
    this.killer.update(delta, this.player.position, this.peerManager.isHost);

    // 4. Update Remote Players
    this.remotePlayers.forEach((rp) => rp.update(delta));

    // 5. Survival Stats Logic
    if (!this.player.stats.isDead) {
      this.timeSurvivedSeconds += delta;

      // Passive Points: +10 points every 5 seconds
      this.pointTimer += delta;
      if (this.pointTimer >= 5.0) {
        this.player.stats.points += 10;
        this.pointTimer = 0;
      }

      // Hunger & Thirst Decay (Slowly drains over time)
      this.decayTimer += delta;
      if (this.decayTimer >= 2.0) {
        this.player.stats.hunger = Math.max(0, this.player.stats.hunger - 0.7);
        this.player.stats.thirst = Math.max(0, this.player.stats.thirst - 1.0);
        this.decayTimer = 0;

        // Health damage if starving or dehydrated
        if (this.player.stats.hunger === 0 || this.player.stats.thirst === 0) {
          this.player.applyDamage(5);
        }
      }

      // Monster Attack Collision
      const monsterDist = this.monster.position.distanceTo(this.player.position);
      if (monsterDist < 1.8 && !this.monster.isDefeated && this.monster.state !== 'frightened') {
        if (!this.player.powerups.invincibleRemaining) {
          this.player.applyDamage(100); // Lethal kill when player rams/touches monster without shield
          this.triggerJumpscare('monster');
          this.uiBridge.showGameOver({
            timeSurvived: Math.floor(this.timeSurvivedSeconds),
            pointsEarned: this.player.stats.points,
            killersEvaded: this.killersEvadedCount
          });
        } else {
          this.uiBridge.showNotification('Shield deflected the monster!');
        }
      }

      // Knife Killer Attack Collision
      if (this.killer.active) {
        const killerDist = this.killer.position.distanceTo(this.player.position);
        if (killerDist < 1.5) {
          if (!this.player.powerups.invincibleRemaining) {
            this.player.applyDamage(100); // Instakill without shield
            this.triggerJumpscare('killer');
            this.uiBridge.showGameOver({
              timeSurvived: Math.floor(this.timeSurvivedSeconds),
              pointsEarned: this.player.stats.points,
              killersEvaded: this.killersEvadedCount
            });
          } else {
            this.killersEvadedCount++;
            this.uiBridge.showNotification('Shield deflected Knife Killer attack!');
          }
        }
      }
    }

    // 6. Network Sync Broadcast (20 updates/sec)
    this.syncTimer += delta;
    if (this.syncTimer >= 0.05) {
      this.syncTimer = 0;

      // Local player sync
      const myState: PlayerNetworkData = {
        id: this.peerManager.myId,
        name: this.peerManager.myName,
        position: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
        rotationY: this.player.rotationY,
        headPitch: this.player.pitch,
        isWalking: this.player.isWalking,
        isRunning: this.player.isRunning,
        isCrouching: this.player.isCrouching,
        flashlightOn: this.player.flashlightOn,
        health: this.player.stats.health,
        hunger: this.player.stats.hunger,
        thirst: this.player.stats.thirst,
        points: this.player.stats.points,
        invincible: this.player.powerups.invincibleRemaining > 0,
        speedBoost: this.player.powerups.speedBoostRemaining > 0
      };
      this.peerManager.broadcastMyPlayerState(myState);

      // Host entities sync
      if (this.peerManager.isHost) {
        this.peerManager.broadcastHostEntitiesState(
          this.monster.getNetworkData(),
          this.observer.getNetworkData(),
          this.killer.getNetworkData()
        );
      }
    }

    // Calculate Day & Quest info
    const currentDay = Math.min(30, 1 + Math.floor(this.timeSurvivedSeconds / 15));
    let activeQuest = "Day 1-11 Quest: Find weapons in house & survive until Day 12 to unlock frighten ability!";
    if (currentDay >= 12 && currentDay < 30) {
      activeQuest = "Day 12-29 Quest: Equip weapons/toys and frighten the Shadow Monster to repel it! Survive to Day 30";
    } else if (currentDay >= 30) {
      activeQuest = this.monster.isDefeated
        ? "DAY 30 VICTORY: SHADOW MONSTER DEFEATED!"
        : "DAY 30 QUEST: THE FINAL BATTLE! Fight and defeat the Shadow Monster!";
    }

    // 7. Update UI HUD Bridge
    this.uiBridge.updateHUD(
      Math.round(this.player.stats.health),
      Math.round(this.player.stats.hunger),
      Math.round(this.player.stats.thirst),
      this.player.stats.points,
      {
        speed: Math.ceil(this.player.powerups.speedBoostRemaining),
        jump: Math.ceil(this.player.powerups.superJumpRemaining),
        shield: Math.ceil(this.player.powerups.invincibleRemaining)
      },
      {
        id: this.peerManager.roomId,
        count: this.remotePlayers.size + 1,
        isHost: this.peerManager.isHost,
        playerList: this.peerManager.getPlayerList()
      },
      {
        currentDay,
        activeQuest,
        monsterHp: this.monster.health,
        monsterMaxHp: this.monster.maxHealth,
        isDefeated: this.monster.isDefeated
      }
    );

    // 8. Render Three.js Frame
    this.renderer.render(this.scene, this.camera);
  };

  public stop() {
    this.isRunning = false;
    soundSystem.stopAll();
    if (document.pointerLockElement) {
      try { document.exitPointerLock(); } catch {}
    }
    if (this.peerManager) {
      this.peerManager.disconnect();
    }
  }

  private onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
