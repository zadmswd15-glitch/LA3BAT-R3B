import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator';

export interface LaptopScreenItem {
  mesh: THREE.Mesh;
  update: () => void;
}

export interface ConsumableItem {
  mesh: THREE.Group;
  type: 'food' | 'drink';
  position: THREE.Vector3;
  collected: boolean;
}

export class MapBuilder {
  public scene: THREE.Scene;
  public laptopScreens: LaptopScreenItem[] = [];
  public consumables: ConsumableItem[] = [];
  public collisionBoxes: THREE.Box3[] = [];
  public supermarketCounterPos = new THREE.Vector3(14, 0, 4);
  public observerSeatPos = new THREE.Vector3(18, 0, -2);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public buildMap() {
    // 1. Atmosphere & Fog
    this.scene.background = new THREE.Color(0x050404);
    this.scene.fog = new THREE.FogExp2(0x080606, 0.075);

    // Ambient light (Dim, eerie reddish tint)
    const ambient = new THREE.AmbientLight(0x2a1e1b, 0.7);
    this.scene.add(ambient);

    // Directional moon light through windows
    const moon = new THREE.DirectionalLight(0x3d4a66, 0.5);
    moon.position.set(-10, 20, -10);
    this.scene.add(moon);

    // Textures
    const floorTexture = TextureGenerator.createWoodFloorTexture();
    const wallTexture = TextureGenerator.createWallTexture();

    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.85,
      metalness: 0.1
    });

    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTexture,
      roughness: 0.9,
      metalness: 0.05
    });

    // 2. HAUNTED HOUSE MAIN STRUCTURE
    // Floor (Main House: -12 to 8 X, -12 to 12 Z)
    const floorGeo = new THREE.PlaneGeometry(24, 24);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(-2, 0, 0);
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);

    // Ceiling
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x110e0c, roughness: 0.95 });
    const ceilingMesh = new THREE.Mesh(floorGeo, ceilingMat);
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.set(-2, 4, 0);
    this.scene.add(ceilingMesh);

    // Outer Walls & Interior Partitions
    this.buildWalls(wallMat);

    // Furniture & Laptops inside House
    this.buildFurniture();

    // 3. SUPERMARKET ('الدكانة') STRUCTURE
    this.buildSupermarket(floorMat, wallMat);

    // Flickering House Lights
    this.addFlickeringLights();
  }

  private buildWalls(wallMat: THREE.Material) {
    const wallGeo = new THREE.BoxGeometry(1, 4, 1);

    const createWallSegment = (x: number, z: number, w: number, d: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 4, d), wallMat);
      mesh.position.set(x, 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Add to collision box
      const box = new THREE.Box3().setFromObject(mesh);
      this.collisionBoxes.push(box);
    };

    // House Boundary Walls
    createWallSegment(-14, 0, 0.5, 24); // West Wall
    createWallSegment(-2, -12, 24, 0.5); // North Wall
    createWallSegment(-2, 12, 24, 0.5); // South Wall
    createWallSegment(10, -7, 0.5, 10); // East Wall North part
    createWallSegment(10, 7, 0.5, 10); // East Wall South part (doorway to Supermarket at Z: -2 to 2)

    // Interior Partitions (Rooms)
    createWallSegment(-6, -5, 12, 0.4); // North bedroom wall
    createWallSegment(-2, 5, 14, 0.4);  // South study room wall
    createWallSegment(-6, 2, 0.4, 6);   // Corridor divider
  }

  private buildFurniture() {
    // Tables with Laptops
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x221710, roughness: 0.8 });

    const createTableWithLaptop = (x: number, z: number, rotY: number = 0) => {
      // Table Top
      const tableGroup = new THREE.Group();
      tableGroup.position.set(x, 0, z);
      tableGroup.rotation.y = rotY;

      const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.4), tableMat);
      top.position.set(0, 0.9, 0);
      tableGroup.add(top);

      // Table legs
      const legGeo = new THREE.BoxGeometry(0.1, 0.9, 0.1);
      const legPositions = [
        [-1.1, 0.45, -0.6],
        [1.1, 0.45, -0.6],
        [-1.1, 0.45, 0.6],
        [1.1, 0.45, 0.6]
      ];
      legPositions.forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, tableMat);
        leg.position.set(lx, ly, lz);
        tableGroup.add(leg);
      });

      // Wooden Chair
      const chairMat = new THREE.MeshStandardMaterial({ color: 0x1a120b });
      const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.8), chairMat);
      chairSeat.position.set(0, 0.5, 1.0);
      tableGroup.add(chairSeat);

      // Laptop Base
      const laptopMat = new THREE.MeshStandardMaterial({ color: 0x111113, metalness: 0.8, roughness: 0.2 });
      const laptopBase = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.6), laptopMat);
      laptopBase.position.set(0, 0.97, 0);
      tableGroup.add(laptopBase);

      // Laptop Animated VS Code Screen
      const { texture, update } = TextureGenerator.createVSCodeCanvas();
      const screenMat = new THREE.MeshBasicMaterial({ map: texture });
      const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.5), screenMat);
      screenMesh.position.set(0, 1.22, -0.28);
      screenMesh.rotation.x = -0.2;
      tableGroup.add(screenMesh);

      // Glow Light from Laptop Screen
      const screenLight = new THREE.PointLight(0x40a0ff, 0.8, 4);
      screenLight.position.set(0, 1.25, -0.1);
      tableGroup.add(screenLight);

      this.scene.add(tableGroup);
      this.laptopScreens.push({ mesh: screenMesh, update });

      // Collision box for table
      const box = new THREE.Box3().setFromObject(top);
      this.collisionBoxes.push(box);
    };

    // Laptop 1: Main Study Room
    createTableWithLaptop(-9, -8, 0);

    // Laptop 2: Dark Corner Corridor
    createTableWithLaptop(-8, 8, Math.PI / 2);

    // Broken Windows on West Wall
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x111b24, opacity: 0.4, transparent: true });
    const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), windowMat);
    windowMesh.position.set(-13.7, 2.2, -4);
    windowMesh.rotation.y = Math.PI / 2;
    this.scene.add(windowMesh);
  }

  private buildSupermarket(floorMat: THREE.Material, wallMat: THREE.Material) {
    // Supermarket Floor (X: 10 to 22, Z: -8 to 8)
    const marketFloorGeo = new THREE.PlaneGeometry(12, 16);
    const marketFloorMat = new THREE.MeshStandardMaterial({ color: 0x181715, roughness: 0.6 });
    const marketFloor = new THREE.Mesh(marketFloorGeo, marketFloorMat);
    marketFloor.rotation.x = -Math.PI / 2;
    marketFloor.position.set(16, 0, 0);
    this.scene.add(marketFloor);

    // Supermarket Walls
    const createMarketWall = (x: number, z: number, w: number, d: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 4, d), wallMat);
      mesh.position.set(x, 2, z);
      this.scene.add(mesh);
      this.collisionBoxes.push(new THREE.Box3().setFromObject(mesh));
    };

    createMarketWall(22, 0, 0.5, 16); // East outer wall
    createMarketWall(16, -8, 12, 0.5); // North outer wall
    createMarketWall(16, 8, 12, 0.5);  // South outer wall

    // Outdoor Sign: "الدكانة" (The Supermarket)
    const signTex = TextureGenerator.createSupermarketSignTexture();
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.2), signMat);
    signMesh.position.set(10.1, 3.2, 0);
    signMesh.rotation.y = -Math.PI / 2;
    this.scene.add(signMesh);

    // Sign Spotlight
    const signLight = new THREE.PointLight(0x9c1c22, 1.5, 6);
    signLight.position.set(10.5, 3.4, 0);
    this.scene.add(signLight);

    // Supermarket Shelves with Consumable Items
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x33302b, roughness: 0.7 });

    const createShelf = (x: number, z: number) => {
      const shelfGroup = new THREE.Group();
      shelfGroup.position.set(x, 0, z);

      // Frame
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 3), shelfMat);
      frame.position.set(0, 1.1, 0);
      shelfGroup.add(frame);

      // Shelves levels
      for (let level = 0.5; level <= 1.8; level += 0.6) {
        // Add Consumable items on shelves (Food Cans & Water Bottles)
        const canTex = TextureGenerator.createCannedFoodTexture();
        const canMat = new THREE.MeshStandardMaterial({ map: canTex });

        const bottleTex = TextureGenerator.createWaterBottleTexture();
        const bottleMat = new THREE.MeshStandardMaterial({ map: bottleTex, transparent: true, opacity: 0.9 });

        // Add 2 food cans
        for (let i = 0; i < 2; i++) {
          const itemGroup = new THREE.Group();
          const canGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.28, 12);
          const canMesh = new THREE.Mesh(canGeo, canMat);
          itemGroup.add(canMesh);
          const pos = new THREE.Vector3(x + (Math.random() - 0.5) * 0.6, level + 0.15, z + (i - 0.5) * 0.8);
          itemGroup.position.copy(pos);
          this.scene.add(itemGroup);

          this.consumables.push({
            mesh: itemGroup,
            type: 'food',
            position: pos,
            collected: false
          });
        }

        // Add 2 water bottles
        for (let i = 0; i < 2; i++) {
          const itemGroup = new THREE.Group();
          const bottleGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.35, 12);
          const bottleMesh = new THREE.Mesh(bottleGeo, bottleMat);
          itemGroup.add(bottleMesh);
          const pos = new THREE.Vector3(x + (Math.random() - 0.5) * 0.6, level + 0.18, z + (i - 0.5) * 1.2);
          itemGroup.position.copy(pos);
          this.scene.add(itemGroup);

          this.consumables.push({
            mesh: itemGroup,
            type: 'drink',
            position: pos,
            collected: false
          });
        }
      }

      this.scene.add(shelfGroup);
      this.collisionBoxes.push(new THREE.Box3().setFromObject(frame));
    };

    createShelf(18, -4);
    createShelf(18, 4);

    // Supermarket Counter / Shop Register Area
    const counterMat = new THREE.MeshStandardMaterial({ color: 0x2b1e17, roughness: 0.7 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.1, 1.4), counterMat);
    counter.position.copy(this.supermarketCounterPos);
    counter.position.y = 0.55;
    this.scene.add(counter);
    this.collisionBoxes.push(new THREE.Box3().setFromObject(counter));

    // Cash Register Machine on counter
    const regMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.7 });
    const reg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.5), regMat);
    reg.position.set(14, 1.3, 4);
    this.scene.add(reg);

    // Glowing Shop Counter Light
    const counterLight = new THREE.PointLight(0xffa500, 1.0, 5);
    counterLight.position.set(14, 2.2, 4);
    this.scene.add(counterLight);
  }

  private addFlickeringLights() {
    // Light 1: Main hallway flickering bulb
    const light1 = new THREE.PointLight(0xffcc88, 1.2, 9);
    light1.position.set(-2, 3.6, 0);
    this.scene.add(light1);

    // Light 2: Bedroom dim light
    const light2 = new THREE.PointLight(0xff8866, 0.9, 8);
    light2.position.set(-8, 3.6, -7);
    this.scene.add(light2);

    // Light flickering animation loop
    setInterval(() => {
      if (Math.random() < 0.15) {
        light1.intensity = 0.1 + Math.random() * 0.4; // sudden flicker dip
        setTimeout(() => {
          light1.intensity = 1.0 + Math.random() * 0.4;
        }, 50 + Math.random() * 100);
      }
      if (Math.random() < 0.1) {
        light2.intensity = 0.2 + Math.random() * 0.3;
        setTimeout(() => {
          light2.intensity = 0.9;
        }, 80);
      }
    }, 200);
  }

  public update() {
    // Update laptop screens
    this.laptopScreens.forEach((ls) => ls.update());

    // Rotate consumable items slightly for pickup visibility
    this.consumables.forEach((c) => {
      if (!c.collected && c.mesh) {
        c.mesh.rotation.y += 0.02;
      }
    });
  }
}
