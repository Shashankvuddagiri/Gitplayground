/**
 * ProgressBar.js
 * Top header progress bar: XP counter, level progress, achievements display.
 */

export class ProgressBar {
  constructor(levelManager) {
    this.lm = levelManager;
    this.xpEl = document.getElementById('xp-value');
    this.levelEl = document.getElementById('level-progress-text');
    this.barFillEl = document.getElementById('xp-bar-fill');
    this.achievementCountEl = document.getElementById('achievement-count');
    this.render();
  }

  render() {
    const stats = this.lm.getStats();
    this._animateXP(stats.totalXP);
    this._updateLevelProgress(stats);
    this._updateAchievements(stats.achievements);
  }

  _animateXP(targetXP) {
    if (!this.xpEl) return;
    const current = parseInt(this.xpEl.textContent) || 0;
    const diff = targetXP - current;
    if (diff === 0) return;

    const steps = 30;
    const stepSize = diff / steps;
    let count = 0;

    const tick = () => {
      count++;
      const display = Math.round(current + stepSize * count);
      if (this.xpEl) this.xpEl.textContent = display;
      if (count < steps) requestAnimationFrame(tick);
      else if (this.xpEl) this.xpEl.textContent = targetXP;
    };
    requestAnimationFrame(tick);
  }

  _updateLevelProgress(stats) {
    if (this.levelEl) {
      this.levelEl.textContent = `${stats.completedCount}/${stats.totalLevels}`;
    }
    if (this.barFillEl) {
      this.barFillEl.style.width = `${stats.percentComplete}%`;
    }
  }

  _updateAchievements(achievements) {
    if (this.achievementCountEl) {
      this.achievementCountEl.textContent = achievements.length;
    }
  }
}
