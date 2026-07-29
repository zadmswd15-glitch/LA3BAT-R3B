import * as THREE from 'three';
import { ObserverNetworkData } from '../types';
import { soundSystem } from '../audio/SoundSystem';

export class CriminalObserverAI {
  public group: THREE.Group;
  public headGroup: THREE.Group;
  public bodyMesh: THREE.Mesh;
  public chairMesh: THREE.Mesh;
  public position: THREE.Vector3 = new THREE.Vector3(18, 0, -2); // Seated outside Supermarket

  private headRotationY: number = 0;
  private headPitch: number = 0;
  private whisperTimer: number = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    // Old Broken Chair
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x221710, roughness: 0.9 });
    this.chairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), chairMat);
    this.chairMesh.position.y = 0.3;
    this.group.add(this.chairMesh);

    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.1), chairMat);
    chairBack.position.set(0, 0.8, -0.3);
    this.group.add(chairBack);

    // Seated Body (Dark trench coat / human observer)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.85 });
    this.bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.1, 10), bodyMat);
    this.bodyMesh.position.y = 0.85;
    this.group.add(this.bodyMesh);

    // Head Group for smooth tracking rotation
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.45, 0);

    // Pale creepy head with dark sunken eyes
    const headMat = new THREE.MeshStandardMaterial({ color: 0x777068, roughness: 0.6 });
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), headMat);
    this.headGroup.add(headMesh);

    // Creepy pale mask / hat
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x090807 });
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 12), hatMat);
    hat.position.y = 0.2;
    this.headGroup.add(hat);

    // Glowing dim yellow eyes watching
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
    leftEye.position.set(-0.08, 0.02, 0.2);
    this.headGroup.add(leftEye);

    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
    rightEye.position.set(0.08, 0.02, 0.2);
    this.headGroup.add(rightEye);

    this.group.add(this.headGroup);
    scene.add(this.group);
  }

  public getNetworkData(): ObserverNetworkData {
    return {
      headRotationY: this.headRotationY,
      headPitch: this.headPitch
    };
  }

  public update(delta: number, playerPos: THREE.Vector3) {
    // Vector pointing to player from head
    const targetDir = playerPos.clone().sub(this.position.clone().add(new THREE.Vector3(0, 1.45, 0)));
    const dist = targetDir.length();

    // Smooth head look at target
    const desiredRotY = Math.atan2(targetDir.x, targetDir.z);
    const desiredPitch = -Math.atan2(targetDir.y, Math.sqrt(targetDir.x * targetDir.x + targetDir.z * targetDir.z));

    // Lerp head rotation
    this.headRotationY += (desiredRotY - this.headRotationY) * delta * 4;
    this.headPitch += (desiredPitch - this.headPitch) * delta * 4;

    this.headGroup.rotation.y = this.headRotationY;
    this.headGroup.rotation.x = this.headPitch;

    // Trigger creepy whispers when player gets close to the Criminal Observer
    this.whisperTimer += delta;
    if (dist < 6 && this.whisperTimer > 10) {
      soundSystem.playWhisper();
      this.whisperTimer = 0;
    }
  }
}
