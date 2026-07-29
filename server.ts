import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Server Random Room Code Generator
  // Generates unique, human-readable 4-letter/digit room codes (e.g., 'DARK-7291')
  app.get('/api/room/random-code', (req, res) => {
    const prefixes = ['DARK', 'ROOM', 'VOID', 'NIGHT', 'SHADOW', 'FANG', 'HAUNT', 'HOLLOW', 'EVIL'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 digits
    const roomCode = `${prefix}-${randomNum}`;
    
    res.json({
      success: true,
      roomCode,
      serverTimestamp: Date.now()
    });
  });

  // Vite middleware for development vs static production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hollow House Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
