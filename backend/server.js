/**
 * server.js
 * Git Playground — Express Backend
 * - Serves all static frontend files
 * - Proxies Gemini AI requests (avoids exposing API key to client)
 * - Stores user progress to JSON file
 */

import express    from 'express';
import cors       from 'cors';
import path       from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load .env
config();

import aiRoutes       from './routes/ai.js';
import progressRoutes from './routes/progress.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR  = path.join(__dirname, '..');
const PORT      = process.env.PORT || 3001;

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Request logger
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`${new Date().toISOString().slice(11, 19)} ${req.method} ${req.path}`);
  }
  next();
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/ai',       aiRoutes);
app.use('/api/progress', progressRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    aiActive: !!(process.env.OPENROUTER_API_KEY || process.env.API_KEY) && 
              process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here' && 
              process.env.API_KEY !== 'your_key_here',
    timestamp: new Date().toISOString(),
  });
});

// ── Static Frontend ───────────────────────────────────────────────────────────
app.use(express.static(ROOT_DIR, {
  setHeaders(res, filePath) {
    // Disable caching in dev
    if (process.env.NODE_ENV !== 'production') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    // Correct MIME for JS modules
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  },
}));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

// ── Error Handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ── Start ────────────────────────────────────────────────────────────────────
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    const key = process.env.OPENROUTER_API_KEY || process.env.API_KEY;
    const aiStatus = key && key !== 'your_openrouter_api_key_here' && key !== 'your_key_here'
      ? '✅ OpenRouter AI connected'
      : '⚠️  No AI key detected (fallback enabled)';

    console.log(`
╔══════════════════════════════════════════════╗
║     🎮  Git Playground Server v2.0           ║
╠══════════════════════════════════════════════╣
║  URL:    http://localhost:${String(PORT).padEnd(18)}║
║  API:    http://localhost:${PORT}/api/health${' '.repeat(Math.max(0, 16 - String(PORT).length))}║
║  ${aiStatus.padEnd(44)}║
╚══════════════════════════════════════════════╝
  `);
  });
}

export default app;
