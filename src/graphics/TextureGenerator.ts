import * as THREE from 'three';

export class TextureGenerator {
  // Wood floor texture
  public static createWoodFloorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base dark wood color
    ctx.fillStyle = '#1c140e';
    ctx.fillRect(0, 0, 512, 512);

    // Plank lines
    const plankHeight = 64;
    for (let y = 0; y < 512; y += plankHeight) {
      // Plank division line
      ctx.fillStyle = '#0a0705';
      ctx.fillRect(0, y, 512, 4);

      // Staggered end joints
      const shift = (y / plankHeight) % 2 === 0 ? 0 : 256;
      ctx.fillRect((shift + 180) % 512, y, 4, plankHeight);
      ctx.fillRect((shift + 400) % 512, y, 4, plankHeight);
    }

    // Wood grain noise
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const len = 10 + Math.random() * 40;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(45, 30, 20, 0.25)' : 'rgba(10, 5, 2, 0.35)';
      ctx.fillRect(x, y, len, 1 + Math.random() * 2);
    }

    // Grime & dirt spots
    for (let i = 0; i < 30; i++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 512;
      const rad = 10 + Math.random() * 35;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      grad.addColorStop(0, 'rgba(5, 3, 2, 0.6)');
      grad.addColorStop(1, 'rgba(5, 3, 2, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    return texture;
  }

  // Dirty wallpaper / wall texture
  public static createWallTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#26221d';
    ctx.fillRect(0, 0, 512, 512);

    // Vintage wallpaper stripe pattern (weathered)
    ctx.fillStyle = '#1a1714';
    for (let x = 0; x < 512; x += 32) {
      ctx.fillRect(x, 0, 16, 512);
    }

    // Dirt spots and mildew stains
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 15 + Math.random() * 50;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, Math.random() > 0.7 ? 'rgba(74, 93, 35, 0.4)' : 'rgba(15, 11, 10, 0.7)'); // Mold green or black dirt
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scratches and cracks
    ctx.strokeStyle = '#0d0b0a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 15; i++) {
      let cx = Math.random() * 512;
      let cy = Math.random() * 512;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let j = 0; j < 5; j++) {
        cx += (Math.random() - 0.5) * 30;
        cy += Math.random() * 25;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 2);
    return texture;
  }

  // Supermarket Arabic Sign ("الدكانة")
  public static createSupermarketSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Dark weathered metallic sign background
    ctx.fillStyle = '#141210';
    ctx.fillRect(0, 0, 512, 128);

    // Rust border
    ctx.strokeStyle = '#4a2414';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 504, 120);

    // Arabic Text: الدكانة (The Supermarket)
    ctx.font = 'bold 54px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Glowing effect
    ctx.shadowColor = '#9c1c22';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#c9c2b4';
    ctx.fillText('الدكانة', 256, 64);

    // English subtitle underneath
    ctx.font = 'bold 16px monospace';
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#6b0f1a';
    ctx.fillText('MINI MARKET & SUPPLIES', 256, 102);

    return new THREE.CanvasTexture(canvas);
  }

  // VS Code Screen Canvas Texture (Animated code scrolling)
  public static createVSCodeCanvas(): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; update: () => void } {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 320;
    const ctx = canvas.getContext('2d')!;

    const codeLines = [
      'import { HorrorEngine } from "./hollow_house";',
      'const room = new PeerRoom("HOLLOW_HOUSE");',
      '// WARNING: DO NOT LOOK BEHIND YOU',
      'function spawnEntity(type) {',
      '  if (type === "MONSTER") {',
      '    Monster.chase(Player.nearest());',
      '    soundSystem.playJumpscare();',
      '  }',
      '}',
      '// SYNCING WEBRTC CLIENTS...',
      'peer.on("connection", (conn) => {',
      '  conn.send({ status: "STALKING" });',
      '});',
      'let hunger = 100, thirst = 100;',
      'setInterval(() => { decayStats(); }, 1000);',
      '// IT IS INSIDE THE WALLS',
      'if (Monster.distanceTo(Player) < 2) {',
      '  triggerJumpscare();',
      '}'
    ];

    let scrollOffset = 0;
    let cursorBlink = 0;

    const texture = new THREE.CanvasTexture(canvas);

    const update = () => {
      scrollOffset += 0.2;
      cursorBlink = (cursorBlink + 1) % 60;

      // Dark VS Code Editor background
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, 512, 320);

      // VS Code sidebar & tabs bar
      ctx.fillStyle = '#252526';
      ctx.fillRect(0, 0, 40, 320);
      ctx.fillRect(40, 0, 472, 24);

      // File Tab
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(40, 0, 140, 24);
      ctx.fillStyle = '#cccccc';
      ctx.font = '11px monospace';
      ctx.fillText('hollow_house.js', 50, 16);

      // Line numbers & Code
      ctx.font = '13px "IBM Plex Mono", monospace';
      const visibleCount = 15;
      const startIdx = Math.floor(scrollOffset) % codeLines.length;

      for (let i = 0; i < visibleCount; i++) {
        const lineIdx = (startIdx + i) % codeLines.length;
        const lineStr = codeLines[lineIdx];
        const yPos = 45 + i * 18;

        // Line number column
        ctx.fillStyle = '#5a5a5a';
        ctx.fillText(String(lineIdx + 1).padStart(2, ' '), 45, yPos);

        // Code coloring (Syntax highlighting simulated)
        if (lineStr.startsWith('//') || lineStr.includes('WARNING') || lineStr.includes('INSIDE')) {
          ctx.fillStyle = '#6a9955'; // Comment green
        } else if (lineStr.includes('function') || lineStr.includes('const') || lineStr.includes('let') || lineStr.includes('if')) {
          ctx.fillStyle = '#569cd6'; // Keyword blue
        } else if (lineStr.includes('MONSTER') || lineStr.includes('STALKING')) {
          ctx.fillStyle = '#f44747'; // Red alert string
        } else {
          ctx.fillStyle = '#9cdcfe'; // Variable cyan
        }

        ctx.fillText(lineStr, 75, yPos);

        // Blinking cursor on active line
        if (i === 8 && cursorBlink < 30) {
          ctx.fillStyle = '#aeafad';
          ctx.fillRect(75 + lineStr.length * 7.8, yPos - 11, 8, 14);
        }
      }

      texture.needsUpdate = true;
    };

    update();
    return { canvas, texture, update };
  }

  // Canned Food Texture
  public static createCannedFoodTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#888888'; // Metallic tin
    ctx.fillRect(0, 0, 256, 256);

    // Label band
    ctx.fillStyle = '#6b0f1a';
    ctx.fillRect(0, 64, 256, 128);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('طعام محفوض', 128, 120);
    ctx.font = '14px monospace';
    ctx.fillText('CANNED RATIONS', 128, 150);

    return new THREE.CanvasTexture(canvas);
  }

  // Water Bottle Texture
  public static createWaterBottleTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(100, 180, 240, 0.7)';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#0055aa';
    ctx.fillRect(0, 90, 256, 76);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ماء نقي', 128, 128);
    ctx.font = '12px monospace';
    ctx.fillText('PURE WATER', 128, 150);

    return new THREE.CanvasTexture(canvas);
  }
}
