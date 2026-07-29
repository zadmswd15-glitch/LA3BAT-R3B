import * as THREE from 'three';
import { PlayerStats, ActivePowerups } from '../types';
import { soundSystem } from '../audio/SoundSystem';

export class PlayerEntity {
  public camera: THREE.PerspectiveCamera;
  public position: THREE.Vector3 = new THREE.Vector3(-2, 1.6, 8); // Initial spawn inside house
  public rotationY: number = 0; // Yaw
  public pitch: number = 0;      // Pitch (looking up/down)

  public stats: PlayerStats = {
    health: 100,
    hunger: 100,
    thirst: 100,
    points: 0,
    isDead: false
  };

  public powerups: ActivePowerups = {
    speedBoostRemaining: 0,
    superJumpRemaining: 0,
    invincibleRemaining: 0
  };

  // Flashlight
  public flashlight: THREE.SpotLight;
  public flashlightOn: boolean = true;

  // State flags
  public isWalking: boolean = false;
  public isRunning: boolean = false;
  public isCrouching: boolean = false;
  public velocityY: number = 0;
  public isGrounded: boolean = true;
  private footstepTimer: number = 0;

  // Movement input
  public moveForward: boolean = false;
  public moveBackward: boolean = false;
  public moveLeft: boolean = false;
  public moveRight: boolean = false;
  public turnLeft: boolean = false;
  public turnRight: boolean = false;
  public turnUp: boolean = false;
  public turnDown: boolean = false;
  public touchJoystick: { x: number; y: number } = { x: 0, y: 0 };

  // Shield mesh for local player view indicator
  public shieldMesh: THREE.Mesh;

  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.camera = camera;
    this.camera.rotation.order = 'YXZ';
    this.camera.position.copy(this.position);

    // Flashlight mounted to camera
    this.flashlight = new THREE.SpotLight(0xfffaed, 2.5, 18, Math.PI / 5, 0.4, 1.2);
    this.flashlight.position.set(0, 0, 0);
    this.flashlight.target.position.set(0, 0, -1);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);
    scene.add(this.camera);

    // Invincibility shield bubble effect around player
    const shieldGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x40c0ff,
      transparent: true,
      opacity: 0.0,
      wireframe: true
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    scene.add(this.shieldMesh);

    this.setupKeyboardListeners();
  }

  public addTouchLook(dx: number, dy: number) {
    if (this.stats.isDead) return;
    const sensitivity = 0.0035;
    this.rotationY -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    const maxPitch = Math.PI / 2.1;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  public attachMouseLook(domElement: HTMLElement) {
    domElement.addEventListener('click', () => {
      if (document.pointerLockElement !== domElement && !this.stats.isDead) {
        try {
          domElement.requestPointerLock();
        } catch (err) {
          // pointer lock fail fallback
        }
      }
    });

    const handleMouseMove = (e: MouseEvent) => {
      if (this.stats.isDead) return;
      // Accept input when pointer is locked or when mouse button is down (drag look)
      if (document.pointerLockElement === domElement || e.buttons === 1) {
        const sensitivity = 0.0025;
        this.rotationY -= e.movementX * sensitivity;
        this.pitch -= e.movementY * sensitivity;

        const maxPitch = Math.PI / 2.1; // ~85 degrees up and down
        this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
  }

  private setupKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      if (this.stats.isDead) return;
      switch (e.code) {
        case 'KeyW': this.moveForward = true; break;
        case 'KeyS': this.moveBackward = true; break;
        case 'KeyA': this.moveLeft = true; break;
        case 'KeyD': this.moveRight = true; break;
        case 'ArrowUp': this.turnUp = true; break;
        case 'ArrowDown': this.turnDown = true; break;
        case 'ArrowLeft': this.turnLeft = true; break;
        case 'ArrowRight': this.turnRight = true; break;
        case 'ShiftLeft': case 'ShiftRight': this.isRunning = true; break;
        case 'KeyC': this.toggleCrouch(); break;
        case 'KeyF': this.toggleFlashlight(); break;
        case 'Space': this.jump(); break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW': this.moveForward = false; break;
        case 'KeyS': this.moveBackward = false; break;
        case 'KeyA': this.moveLeft = false; break;
        case 'KeyD': this.moveRight = false; break;
        case 'ArrowUp': this.turnUp = false; break;
        case 'ArrowDown': this.turnDown = false; break;
        case 'ArrowLeft': this.turnLeft = false; break;
        case 'ArrowRight': this.turnRight = false; break;
        case 'ShiftLeft': case 'ShiftRight': this.isRunning = false; break;
      }
    });
  }

  public toggleFlashlight() {
    this.flashlightOn = !this.flashlightOn;
    this.flashlight.intensity = this.flashlightOn ? 2.5 : 0.0;
    soundSystem.playShopBuy();
  }

  public toggleCrouch() {
    this.isCrouching = !this.isCrouching;
  }

  public jump() {
    if (this.isGrounded && !this.stats.isDead) {
      const jumpVel = this.powerups.superJumpRemaining > 0 ? 0.26 : 0.16;
      this.velocityY = jumpVel;
      this.isGrounded = false;
    }
  }

  public applyDamage(amount: number) {
    if (this.powerups.invincibleRemaining > 0 || this.stats.isDead) return;
    this.stats.health = Math.max(0, this.stats.health - amount);
    if (this.stats.health <= 0) {
      this.stats.isDead = true;
    }
  }

  public respawn(spawnPos = new THREE.Vector3(-2, 1.6, 8)) {
    this.position.copy(spawnPos);
    this.camera.position.copy(this.position);
    this.stats.health = 100;
    this.stats.hunger = 100;
    this.stats.thirst = 100;
    this.stats.isDead = false;
    this.velocityY = 0;
    this.powerups = { speedBoostRemaining: 0, superJumpRemaining: 0, invincibleRemaining: 0 };
  }

  public update(delta: number, collisionBoxes: THREE.Box3[]) {
    if (this.stats.isDead) return;

    // Decay powerups timers
    if (this.powerups.speedBoostRemaining > 0) this.powerups.speedBoostRemaining = Math.max(0, this.powerups.speedBoostRemaining - delta);
    if (this.powerups.superJumpRemaining > 0) this.powerups.superJumpRemaining = Math.max(0, this.powerups.superJumpRemaining - delta);
    if (this.powerups.invincibleRemaining > 0) this.powerups.invincibleRemaining = Math.max(0, this.powerups.invincibleRemaining - delta);

    // Update Shield visual
    if (this.powerups.invincibleRemaining > 0) {
      this.shieldMesh.position.copy(this.position);
      (this.shieldMesh.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(Date.now() * 0.008) * 0.15;
      this.shieldMesh.rotation.y += 0.02;
    } else {
      (this.shieldMesh.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    // Movement Direction calculation
    let moveDirX = 0;
    let moveDirZ = 0;

    if (this.moveForward) moveDirZ -= 1;
    if (this.moveBackward) moveDirZ += 1;
    if (this.moveLeft) moveDirX -= 1;
    if (this.moveRight) moveDirX += 1;

    // Touch joystick support
    if (this.touchJoystick.x !== 0 || this.touchJoystick.y !== 0) {
      moveDirX = this.touchJoystick.x;
      moveDirZ = this.touchJoystick.y;
    }

    const isMoving = moveDirX !== 0 || moveDirZ !== 0;
    this.isWalking = isMoving;

    // Base Speed calculation
    let speed = this.isCrouching ? 2.2 : (this.isRunning ? 5.8 : 3.6);
    if (this.powerups.speedBoostRemaining > 0) speed *= 1.5;

    // Direction vector relative to camera rotation
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);

    const moveVector = new THREE.Vector3();
    moveVector.addScaledVector(forward, -moveDirZ);
    moveVector.addScaledVector(right, moveDirX);
    if (moveVector.lengthSq() > 0) moveVector.normalize();

    // Proposed movement position
    const oldPos = this.position.clone();
    const desiredDisplacement = moveVector.multiplyScalar(speed * delta);
    const newPos = oldPos.clone().add(desiredDisplacement);

    // Gravity & Vertical Physics
    this.velocityY -= 9.8 * delta * 0.06;
    newPos.y += this.velocityY;

    const eyeHeight = this.isCrouching ? 0.9 : 1.6;

    if (newPos.y <= eyeHeight) {
      newPos.y = eyeHeight;
      this.velocityY = 0;
      this.isGrounded = true;
    }

    // Collision Check against map walls/objects
    const playerRadius = 0.45;
    const playerBox = new THREE.Box3(
      new THREE.Vector3(newPos.x - playerRadius, newPos.y - eyeHeight, newPos.z - playerRadius),
      new THREE.Vector3(newPos.x + playerRadius, newPos.y + 0.4, newPos.z + playerRadius)
    );

    let collided = false;
    for (const box of collisionBoxes) {
      if (playerBox.intersectsBox(box)) {
        collided = true;
        break;
      }
    }

    if (!collided) {
      this.position.copy(newPos);
    } else {
      // Try X only displacement
      const posX = oldPos.clone();
      posX.x = newPos.x;
      posX.y = newPos.y;
      const boxX = new THREE.Box3(
        new THREE.Vector3(posX.x - playerRadius, posX.y - eyeHeight, posX.z - playerRadius),
        new THREE.Vector3(posX.x + playerRadius, posX.y + 0.4, posX.z + playerRadius)
      );
      let colX = false;
      for (const box of collisionBoxes) {
        if (boxX.intersectsBox(box)) { colX = true; break; }
      }
      if (!colX) {
        this.position.x = posX.x;
      } else {
        // Try Z only displacement
        const posZ = oldPos.clone();
        posZ.z = newPos.z;
        posZ.y = newPos.y;
        const boxZ = new THREE.Box3(
          new THREE.Vector3(posZ.x - playerRadius, posZ.y - eyeHeight, posZ.z - playerRadius),
          new THREE.Vector3(posZ.x + playerRadius, posZ.y + 0.4, posZ.z + playerRadius)
        );
        let colZ = false;
        for (const box of collisionBoxes) {
          if (boxZ.intersectsBox(box)) { colZ = true; break; }
        }
        if (!colZ) this.position.z = posZ.z;
      }
      this.position.y = newPos.y;
    }

    // Handle keyboard arrow turning (turning head left, right, up, down)
    const keyTurnSpeed = 1.8 * delta;
    if (this.turnLeft) this.rotationY += keyTurnSpeed;
    if (this.turnRight) this.rotationY -= keyTurnSpeed;
    if (this.turnUp) this.pitch += keyTurnSpeed;
    if (this.turnDown) this.pitch -= keyTurnSpeed;

    const maxPitch = Math.PI / 2.1;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // Update Camera Position & Rotation
    this.camera.position.copy(this.position);

    // Footstep Sound & Camera Bobbing
    if (this.isWalking && this.isGrounded) {
      this.footstepTimer += delta * (this.isRunning ? 12 : 7);
      const bobY = Math.sin(this.footstepTimer) * (this.isRunning ? 0.08 : 0.04);
      this.camera.position.y += bobY;

      if (Math.sin(this.footstepTimer) > 0.95) {
        soundSystem.playFootstep(this.isRunning);
      }
    }

    // Set pitch/yaw on camera with YXZ rotation order for realistic FPS head turns
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.y = this.rotationY;
    this.camera.rotation.x = this.pitch;
  }
}
