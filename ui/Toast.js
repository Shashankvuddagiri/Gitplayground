/**
 * Toast.js
 * Notification system: achievement toasts, level-complete overlays, error flashes.
 */

export class Toast {
  constructor() {
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    }
  }

  show(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️', achievement: '🏆', conflict: '⚔️' };
    const icon = icons[type] || 'ℹ️';

    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${message}</span>`;
    this.container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    setTimeout(() => {
      toast.classList.remove('toast-visible');
      toast.classList.add('toast-hiding');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }

  showAchievement(achievement) {
    const overlay = document.createElement('div');
    overlay.className = 'achievement-popup';
    overlay.innerHTML = `
      <div class="achievement-inner">
        <div class="achievement-badge">${achievement.name.split(' ')[0]}</div>
        <div class="achievement-text">
          <div class="achievement-title">Achievement Unlocked!</div>
          <div class="achievement-name">${achievement.name}</div>
          <div class="achievement-desc">${achievement.desc}</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('achievement-visible'));
    setTimeout(() => {
      overlay.classList.remove('achievement-visible');
      setTimeout(() => overlay.remove(), 500);
    }, 3000);
  }

  showLevelComplete(data) {
    const overlay = document.createElement('div');
    overlay.className = 'level-complete-overlay';
    overlay.innerHTML = `
      <div class="level-complete-card">
        <div class="lc-confetti" id="lc-confetti"></div>
        <div class="lc-emoji">${data.level?.emoji || '🎉'}</div>
        <h2 class="lc-title">Level Complete!</h2>
        <p class="lc-level-name">${data.level?.title}</p>
        <p class="lc-message">${data.successMessage || 'Well done!'}</p>
        <div class="lc-xp">+${data.xpEarned} XP</div>
        ${data.level?.conceptNote ? `<div class="lc-concept">💡 ${data.level.conceptNote}</div>` : ''}
        <div class="lc-actions">
          ${data.nextLevel ? `<button class="btn-primary" id="lc-next">Next Level →</button>` : `<button class="btn-primary" id="lc-next">🏆 You Won!</button>`}
          <button class="btn-ghost" id="lc-close">Stay Here</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this._spawnConfetti(overlay.querySelector('#lc-confetti'));
    requestAnimationFrame(() => overlay.classList.add('lc-visible'));

    return new Promise((resolve) => {
      overlay.querySelector('#lc-next')?.addEventListener('click', () => {
        overlay.remove();
        resolve('next');
      });
      overlay.querySelector('#lc-close')?.addEventListener('click', () => {
        overlay.remove();
        resolve('stay');
      });
    });
  }

  _spawnConfetti(container) {
    const colors = ['#39d353', '#6e40c9', '#f0883e', '#58a6ff', '#ff5e5b', '#ffd700'];
    for (let i = 0; i < 60; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.cssText = `
        left: ${Math.random() * 100}%;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        animation-delay: ${Math.random() * 0.5}s;
        animation-duration: ${0.8 + Math.random() * 0.8}s;
        width: ${6 + Math.random() * 8}px;
        height: ${6 + Math.random() * 8}px;
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
      `;
      container.appendChild(piece);
    }
  }
}
