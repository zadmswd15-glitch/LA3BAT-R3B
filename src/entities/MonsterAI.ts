import * as THREE from 'three';
import { MonsterNetworkData } from '../types';
import { soundSystem } from '../audio/SoundSystem';

export class MonsterAI {
  public group: THREE.Group;
  public bodyMesh: THREE.Mesh;
  public eyes: THREE.PointLight[];
  public position: THREE.Vector3 = new THREE.Vector3(-8, 0, -8);
  public rotationY: number = 0;
  public state: 'patrol' | 'chase' | 'jumpscare' | 'frightened' = 'patrol';
  public health: number = 100;
  public maxHealth: number = 100;
  public isDefeated: boolean = false;
  public frightenedTimer: number = 0;

  private waypoints: THREE.Vector3[] = [
    new THREE.Vector3(-8, 0, -8),
    new THREE.Vector3(-2, 0, 0),
    new THREE.Vector3(-8, 0, 8),
    new THREE.Vector3(4, 0, 0),
    new THREE.Vector3(16, 0, 0), // Supermarket
    new THREE.Vector3(16, 0, -6)
  ];
  private currentWaypointIdx: number = 0;
  private animTimer: number = 0;
  private growlTimer: number = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();

    // Spindly menacing creature body
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x070606,
      roughness: 0.95,
      metalness: 0.3
    });

    // Tall torso
    this.bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.2, 2.8, 8), bodyMat);
    this.bodyMesh.position.y = 1.4;
    this.group.add(this.bodyMesh);

    // Scary Head with elongated jaw
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.6), bodyMat);
    head.position.set(0, 2.9, 0.1);
    this.group.add(head);

    // Glowing Red Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.16, 3.0, 0.38);
    this.group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.16, 3.0, 0.38);
    this.group.add(rightEye);

    // Eye Lights
    const eyeLight = new THREE.PointLight(0xff0000, 2.0, 5);
    eyeLight.position.set(0, 3.0, 0.5);
    this.group.add(eyeLight);
    this.eyes = [eyeLight];

    // Long Claw Arms
    const armMat = new THREE.MeshStandardMaterial({ color: 0x050404 });
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), armMat);
    leftArm.position.set(-0.55, 1.8, 0);
    leftArm.rotation.z = 0.2;
    this.group.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), armMat);
    rightArm.position.set(0.55, 1.8, 0);
    rightArm.rotation.z = -0.2;
    this.group.add(rightArm);

    this.group.position.copy(this.position);
    scene.add(this.group);
  }

  public getNetworkData(): MonsterNetworkData {
    return {
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      rotationY: this.rotationY,
      state: this.state
    };
  }

  public applyNetworkData(data: MonsterNetworkData) {
    this.position.set(data.position.x, data.position.y, data.position.z);
    this.rotationY = data.rotationY;
    this.state = data.state;
  }

  public frighten(duration: number = 5) {
    if (this.isDefeated) return;
    this.frightenedTimer = duration;
    this.state = 'frightened';
    soundSystem.playMonsterGrowl();
  }

  public takeDamage(amount: number) {
    if (this.isDefeated) return;
    this.health = Math.max(0, this.health - amount);
    this.frighten(4);
    if (this.health <= 0) {
      this.isDefeated = true;
      this.group.visible = false;
    }
  }

  public update(delta: number, playerPos: THREE.Vector3, isHost: boolean) {
    if (this.isDefeated) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    this.animTimer += delta * (this.state === 'chase' ? 12 : this.state === 'frightened' ? 16 : 5);
    this.growlTimer += delta;

    // Handle frightened timer
    if (this.frightenedTimer > 0) {
      this.frightenedTimer -= delta;
      if (this.frightenedTimer <= 0) {
        this.frightenedTimer = 0;
        this.state = 'patrol';
      }
    }

    // Breathing / twitching animation
    this.bodyMesh.rotation.z = Math.sin(this.animTimer) * (this.state === 'frightened' ? 0.3 : 0.05);
    this.group.position.y = this.position.y + Math.abs(Math.sin(this.animTimer)) * (this.state === 'frightened' ? 0.3 : 0.1);

    // Distance to local player
    const distToPlayer = this.position.distanceTo(playerPos);

    // Audio heartbeat proximity adjustment
    soundSystem.setMonsterProximity(1.0 - Math.min(1.0, distToPlayer / 18));

    // Periodic growls
    if (this.growlTimer > 8 && distToPlayer < 20) {
      soundSystem.playMonsterGrowl();
      this.growlTimer = 0;
    }

    if (!isHost) {
      // Non-host players interpolate position from network data
      this.group.position.lerp(this.position, delta * 10);
      this.group.rotation.y = this.rotationY;
      return;
    }

    // Host AI decision logic
    if (this.frightenedTimer <= 0) {
      if (distToPlayer < 12) {
        this.state = 'chase';
      } else if (distToPlayer > 18) {
        this.state = 'patrol';
      }
    }

    let targetPos = this.waypoints[this.currentWaypointIdx];
    let speed = 2.4;

    if (this.state === 'frightened') {
      // Run away from player
      const fleeDir = this.position.clone().sub(playerPos).normalize();
      targetPos = this.position.clone().addScaledVector(fleeDir, 10);
      speed = 6.0;
    } else if (this.state === 'chase') {
      targetPos = playerPos;
      speed = 5.2; // Sprints faster than walking player
    }

    // Move towards target
    const dir = targetPos.clone().sub(this.position);
    dir.y = 0;
    const dist = dir.length();

    if (dist > 0.4) {
      dir.normalize();
      this.position.addScaledVector(dir, speed * delta);
      this.rotationY = Math.atan2(dir.x, dir.z);
    } else if (this.state === 'patrol') {
      // Advance to next waypoint
      this.currentWaypointIdx = (this.currentWaypointIdx + 1) % this.waypoints.length;
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotationY;
  }
}
