import * as THREE from 'three';
import { KillerNetworkData } from '../types';
import { soundSystem } from '../audio/SoundSystem';

export class KnifeKillerAI {
  public group: THREE.Group;
  public bodyMesh: THREE.Mesh;
  public knifeMesh: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3(0, -100, 0); // Hidden until event
  public active: boolean = false;
  public rotationY: number = 0;

  private spawnLocations: THREE.Vector3[] = [
    new THREE.Vector3(-12, 0, -10),
    new THREE.Vector3(-12, 0, 10),
    new THREE.Vector3(20, 0, 6),
    new THREE.Vector3(-2, 0, -10)
  ];
  private stabAnimTimer: number = 0;
  private spawnCooldown: number = 30; // Seconds between potential spawns

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();

    // Dark stalker coat body
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x110f0e, roughness: 0.9 });
    this.bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.7, 10), bodyMat);
    this.bodyMesh.position.y = 0.85;
    this.group.add(this.bodyMesh);

    // Pale Killer Mask (Spooky white face mask)
    const maskMat = new THREE.MeshBasicMaterial({ color: 0xe0e0e0 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), maskMat);
    head.position.set(0, 1.6, 0.05);
    this.group.add(head);

    // Dark eye holes on mask
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
    eye1.position.set(-0.08, 1.62, 0.27);
    this.group.add(eye1);

    const eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
    eye2.position.set(0.08, 1.62, 0.27);
    this.group.add(eye2);

    // Blood-stained Knife Group
    this.knifeMesh = new THREE.Group();
    this.knifeMesh.position.set(0.4, 1.2, 0.3);

    // Handle
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0x2b1e17 }));
    this.knifeMesh.add(handle);

    // Metal Blade with blood tip
    const bladeGeo = new THREE.BoxGeometry(0.02, 0.5, 0.08);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.1 });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(0, 0.3, 0);
    this.knifeMesh.add(blade);

    // Blood tip
    const bloodMat = new THREE.MeshBasicMaterial({ color: 0x9c1c22 });
    const bloodTip = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.15, 0.085), bloodMat);
    bloodTip.position.set(0, 0.45, 0);
    this.knifeMesh.add(bloodTip);

    this.group.add(this.knifeMesh);
    this.group.position.copy(this.position);
    scene.add(this.group);
  }

  public getNetworkData(): KillerNetworkData {
    return {
      active: this.active,
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      rotationY: this.rotationY
    };
  }

  public applyNetworkData(data: KillerNetworkData) {
    this.active = data.active;
    this.position.set(data.position.x, data.position.y, data.position.z);
    this.rotationY = data.rotationY;
    this.group.visible = this.active;
  }

  public triggerKillerEvent(playerPos: THREE.Vector3) {
    // Select closest spawn location that is not immediately visible
    const idx = Math.floor(Math.random() * this.spawnLocations.length);
    this.position.copy(this.spawnLocations[idx]);
    this.active = true;
    this.group.visible = true;
    this.group.position.copy(this.position);

    // Play high-pitched stabbing audio stinger!
    soundSystem.playKnifeStabStinger();
  }

  public update(delta: number, playerPos: THREE.Vector3, isHost: boolean) {
    if (!isHost) {
      if (this.active) {
        this.group.position.lerp(this.position, delta * 12);
        this.group.rotation.y = this.rotationY;
      }
      return;
    }

    // Host timer for random killer ambush events
    if (!this.active) {
      this.spawnCooldown -= delta;
      if (this.spawnCooldown <= 0) {
        this.triggerKillerEvent(playerPos);
        this.spawnCooldown = 45 + Math.random() * 45; // Repeat every 45-90s
      }
      return;
    }

    // Active killer sprinting towards player
    const dir = playerPos.clone().sub(this.position);
    dir.y = 0;
    const dist = dir.length();

    this.stabAnimTimer += delta * 18;
    this.knifeMesh.rotation.x = Math.sin(this.stabAnimTimer) * 0.8; // Fast stabbing motion

    if (dist > 0.5) {
      dir.normalize();
      const speed = 6.5; // High sprint speed
      this.position.addScaledVector(dir, speed * delta);
      this.rotationY = Math.atan2(dir.x, dir.z);
    } else {
      // Attack delivered! Deactivate killer after hit
      this.active = false;
      this.group.visible = false;
      this.position.set(0, -100, 0);
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotationY;
  }
}
