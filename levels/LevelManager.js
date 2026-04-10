/**
 * LevelManager.js
 * Manages level progress, XP, unlocking, and localStorage persistence.
 */

import { LEVELS, getLevelById } from './levels.js';

const STORAGE_KEY = 'gitplayground_progress';

export class LevelManager {
  constructor() {
    console.log('[LevelManager] Constructor called');
    this._listeners = {};
    this.state = this._loadState();
    console.log('[LevelManager] State loaded:', { currentLevelId: this.state.currentLevelId });
    this._initProgressSync();
    console.log('[LevelManager] Constructor complete');
  }

  _defaultState() {
    return {
      currentLevelId: 1,
      sandboxMode: false,
      completedLevels: [],
      unlockedLevels: [1],
      totalXP: 0,
      usedCommands: new Set(),      // commands used in current level
      levelCommandSets: {},         // { levelId: Set<string> } — commands used per level
      achievements: [],
      streak: 0,
      lastPlayed: null,
      userId: this._generateUserId(),
    };
  }

  _generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36).substr(-4);
  }

  async _initProgressSync() {
    this.emit('syncStatus', { status: 'syncing' });
    // Attempt to load from backend if online
    try {
      const resp = await fetch(`/api/progress/${this.state.userId}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.found && data.progress) {
          console.log('Syncing progress from cloud...');
          // Merge logic
          this.state = { 
            ...this.state, 
            ...data.progress,
            usedCommands: new Set(data.progress.usedCommandsArr || []),
            levelCommandSets: {}
          };
          for (const [k, v] of Object.entries(data.progress.levelCommandSetsArr || {})) {
            this.state.levelCommandSets[k] = new Set(v);
          }
          this.emit('reset', {}); // Trigger UI refresh
        }
        this.emit('syncStatus', { status: 'synced' });
      } else {
        this.emit('syncStatus', { status: 'offline' });
      }
    } catch (e) {
      console.warn('Backend sync unavailable, using local progress only.');
      this.emit('syncStatus', { status: 'offline' });
    }
  }

  _loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this._defaultState();
      const parsed = JSON.parse(raw);
      // Restore Sets
      parsed.usedCommands = new Set(parsed.usedCommandsArr || []);
      parsed.levelCommandSets = {};
      for (const [k, v] of Object.entries(parsed.levelCommandSetsArr || {})) {
        parsed.levelCommandSets[k] = new Set(v);
      }
      return { ...this._defaultState(), ...parsed };
    } catch {
      return this._defaultState();
    }
  }

  _saveState() {
    try {
      const toSave = {
        ...this.state,
        usedCommandsArr: [...this.state.usedCommands],
        usedCommands: undefined,
        levelCommandSetsArr: Object.fromEntries(
          Object.entries(this.state.levelCommandSets).map(([k, v]) => [k, [...v]])
        ),
        levelCommandSets: undefined,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      this._syncWithBackend(toSave);
    } catch {
      // localStorage might be unavailable
    }
  }

  async _syncWithBackend(data) {
    this.emit('syncStatus', { status: 'syncing' });
    try {
      await fetch(`/api/progress/${this.state.userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: data })
      });
      this.emit('syncStatus', { status: 'synced' });
    } catch (e) {
      this.emit('syncStatus', { status: 'offline' });
    }
  }

  // ─── Event System ─────────────────────────────────────────────────────────────
  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
    return () => {
      this._listeners[event] = this._listeners[event].filter(l => l !== cb);
    };
  }

  emit(event, data) {
    (this._listeners[event] || []).forEach(cb => cb(data));
  }

  // ─── Level Access ─────────────────────────────────────────────────────────────

  getCurrentLevel() {
    if (this.state.sandboxMode) return null;
    return getLevelById(this.state.currentLevelId);
  }

  getAllLevels() {
    return LEVELS.map(level => ({
      ...level,
      isCompleted: this.state.completedLevels.includes(level.id),
      isUnlocked: true, // Always unlocked for free practice
      isCurrent: level.id === this.state.currentLevelId,
    }));
  }

  isLevelUnlocked() {
    return true; // Universally open
  }

  isLevelCompleted(id) {
    return this.state.completedLevels.includes(id);
  }

  jumpToLevel(id) {
    if (!this.isLevelUnlocked(id)) return false;
    this.state.currentLevelId = id;
    this.state.sandboxMode = false;
    this.state.usedCommands = new Set();
    this._saveState();
    this.emit('levelChanged', { level: getLevelById(id) });
    return true;
  }

  toggleSandboxMode() {
    this.state.sandboxMode = !this.state.sandboxMode;
    this._saveState();
    this.emit('levelChanged', { level: this.getCurrentLevel() });
  }

  // ─── Command Tracking ─────────────────────────────────────────────────────────

  recordCommand(levelEvent) {
    if (!levelEvent) return;
    this.state.usedCommands.add(levelEvent);
    const levelId = this.state.currentLevelId;
    if (!this.state.levelCommandSets[levelId]) {
      this.state.levelCommandSets[levelId] = new Set();
    }
    this.state.levelCommandSets[levelId].add(levelEvent);
  }

  // ─── Level Completion ─────────────────────────────────────────────────────────

  /**
   * Check if the current level is complete.
   * @param {GitRepository} repo
   * @returns {{ completed: bool, level, xpEarned }}
   */
  checkCompletion(repo) {
    const level = this.getCurrentLevel();
    if (!level) return { completed: false };

    const alreadyCompleted = this.isLevelCompleted(level.id);

    let passed = false;
    try {
      passed = level.validator(repo, {
        usedCommands: this.state.usedCommands,
      });
    } catch (e) {
      passed = false;
    }

    if (passed && !alreadyCompleted) {
      return this._completeLevel(level);
    }

    return { completed: false };
  }

  _completeLevel(level) {
    // Mark complete
    if (!this.state.completedLevels.includes(level.id)) {
      this.state.completedLevels.push(level.id);
    }

    // Award XP
    this.state.totalXP += level.xp;

    // Unlock next level
    const nextLevel = getLevelById(level.id + 1);
    if (nextLevel && !this.state.unlockedLevels.includes(nextLevel.id)) {
      this.state.unlockedLevels.push(nextLevel.id);
    }

    // Check for achievements
    const newAchievements = this._checkAchievements(level);

    this._saveState();

    const result = {
      completed: true,
      level,
      xpEarned: level.xp,
      totalXP: this.state.totalXP,
      nextLevel,
      newAchievements,
      successMessage: level.successMessage,
    };

    this.emit('levelCompleted', result);
    return result;
  }

  // ─── Auto-Advance ─────────────────────────────────────────────────────────────

  advanceToNext() {
    const nextId = this.state.currentLevelId + 1;
    const next = getLevelById(nextId);
    if (!next) return null;
    this.state.currentLevelId = nextId;
    this.state.usedCommands = new Set();
    this._saveState();
    this.emit('levelChanged', { level: next });
    return next;
  }

  // ─── Achievements ─────────────────────────────────────────────────────────────

  _checkAchievements(completedLevel) {
    const earned = [];
    const totalCompleted = this.state.completedLevels.length;

    const achievementDefs = [
      {
        id: 'first_init',
        name: '🔰 Git Awakens',
        desc: 'Initialized your first repository',
        condition: () => completedLevel.id === 1,
      },
      {
        id: 'first_commit',
        name: '📦 First Blood',
        desc: 'Made your first commit',
        condition: () => completedLevel.id === 2,
      },
      {
        id: 'branch_master',
        name: '🌿 Branch Master',
        desc: 'Created and switched branches',
        condition: () => completedLevel.id === 5,
      },
      {
        id: 'conflict_slayer',
        name: '⚔️ Conflict Slayer',
        desc: 'Resolved a merge conflict',
        condition: () => completedLevel.id === 8,
      },
      {
        id: 'remote_pioneer',
        name: '🌍 Remote Pioneer',
        desc: 'Pushed code to a remote',
        condition: () => completedLevel.id === 9,
      },
      {
        id: 'git_master',
        name: '🏆 Git Master',
        desc: 'Completed all 10 levels!',
        condition: () => totalCompleted >= 10,
      },
      {
        id: 'half_way',
        name: '🎯 Halfway There',
        desc: 'Completed 5 levels',
        condition: () => totalCompleted >= 5,
      },
    ];

    for (const achievement of achievementDefs) {
      const alreadyHave = this.state.achievements.find(a => a.id === achievement.id);
      if (!alreadyHave && achievement.condition()) {
        this.state.achievements.push({ ...achievement, earnedAt: Date.now() });
        earned.push(achievement);
      }
    }

    return earned;
  }

  // ─── Stats ────────────────────────────────────────────────────────────────────

  getStats() {
    return {
      totalXP: this.state.totalXP,
      completedCount: this.state.completedLevels.length,
      totalLevels: LEVELS.length,
      percentComplete: Math.round((this.state.completedLevels.length / LEVELS.length) * 100),
      achievements: this.state.achievements,
      currentLevelId: this.state.currentLevelId,
    };
  }

  // ─── Reset ────────────────────────────────────────────────────────────────────

  fullReset() {
    localStorage.removeItem(STORAGE_KEY);
    this.state = this._defaultState();
    this.emit('reset', {});
  }
}
