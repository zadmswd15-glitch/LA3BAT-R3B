import * as THREE from 'three';
import { PlayerNetworkData } from '../types';

export class RemotePlayer {
  public id: string;
  public group: THREE.Group;
  public bodyMesh: THREE.Mesh;
  public headMesh: THREE.Mesh;
  public flashlight: THREE.SpotLight;
  public shieldMesh: THREE.Mesh;
  public nameSprite: THREE.Sprite;

  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  private targetRotationY: number = 0;
  private animTimer: number = 0;

  constructor(id: string, name: string, scene: THREE.Scene) {
    this.id = id;
    this.group = new THREE.Group();

    // Body (Capsule / Cylinder)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x242428, roughness: 0.7 });
    this.bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 1.3, 12), bodyMat);
    this.bodyMesh.position.y = 0.65;
    this.group.add(this.bodyMesh);

    // Head
    const headMat = new THREE.MeshStandardMaterial({ color: 0x3d3531, roughness: 0.8 });
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), headMat);
    this.headMesh.position.y = 1.45;
    this.group.add(this.headMesh);

    // Flashlight
    this.flashlight = new THREE.SpotLight(0xfffaed, 2.0, 15, Math.PI / 5, 0.4);
    this.flashlight.position.set(0, 1.35, 0.3);
    this.flashlight.target.position.set(0, 1.35, -2);
    this.group.add(this.flashlight);
    this.group.add(this.flashlight.target);

    // Invincibility Shield
    const shieldMat = new THREE.MeshBasicMaterial({ color: 0x40c0ff, transparent: true, opacity: 0.0, wireframe: true });
    this.shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 12), shieldMat);
    this.shieldMesh.position.y = 1.0;
    this.group.add(this.shieldMesh);

    // Hovering Name Badge Sprite
    this.nameSprite = this.createNameSprite(name);
    this.nameSprite.position.set(0, 2.1, 0);
    this.group.add(this.nameSprite);

    scene.add(this.group);
  }

  private createNameSprite(nameText: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(15, 11, 10, 0.8)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#9c1c22';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 252, 60);

    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#c9c2b4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nameText, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2, 0.5, 1);
    return sprite;
  }

  public updateData(data: PlayerNetworkData) {
    this.targetPosition.set(data.position.x, data.position.y - 1.6, data.position.z);
    this.targetRotationY = data.rotationY;
    this.flashlight.intensity = data.flashlightOn ? 2.0 : 0.0;
    (this.shieldMesh.material as THREE.MeshBasicMaterial).opacity = data.invincible ? 0.35 : 0.0;
  }

  public update(delta: number) {
    // Smooth linear interpolation for positions & rotations
    this.group.position.lerp(this.targetPosition, delta * 12);

    // Angle lerp
    let diff = this.targetRotationY - this.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.group.rotation.y += diff * delta * 12;

    // Subtle breathing animation
    this.animTimer += delta * 4;
    this.bodyMesh.position.y = 0.65 + Math.sin(this.animTimer) * 0.02;
  }

  public destroy(scene: THREE.Scene) {
    scene.remove(this.group);
  }
}
