/**
 * routes/progress.js
 * GET  /api/progress/:userId  — Load saved progress
 * POST /api/progress/:userId  — Save progress
 * DELETE /api/progress/:userId — Reset progress
 */

import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// GET /api/progress/:userId
router.get('/:userId', (req, res) => {
  const { userId } = req.params;
  if (!userId || userId.length > 64) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  const progress = db.getProgress(userId);
  if (!progress) {
    return res.json({ found: false, progress: null });
  }
  res.json({ found: true, progress });
});

// POST /api/progress/:userId
router.post('/:userId', (req, res) => {
  const { userId } = req.params;
  const { progress } = req.body;

  if (!userId || userId.length > 64) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  if (!progress || typeof progress !== 'object') {
    return res.status(400).json({ error: 'progress object is required' });
  }

  // Sanitize — only store allowed fields
  const safe = {
    currentLevelId:   progress.currentLevelId   || 1,
    completedLevels:  progress.completedLevels   || [],
    unlockedLevels:   progress.unlockedLevels    || [1],
    totalXP:          progress.totalXP           || 0,
    achievements:     progress.achievements      || [],
    usedCommandsArr:  progress.usedCommandsArr   || [],
    levelCommandSetsArr: progress.levelCommandSetsArr || {},
    repoState:        progress.repoState         || null,
    history:          progress.history           || [],
    lastPlayed:       new Date().toISOString(),
  };

  const saved = db.saveProgress(userId, safe);
  res.json({ success: true, progress: saved });
});

// DELETE /api/progress/:userId
router.delete('/:userId', (req, res) => {
  const { userId } = req.params;
  db.deleteProgress(userId);
  res.json({ success: true });
});

export default router;
