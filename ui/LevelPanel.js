/**
 * LevelPanel.js
 * Left sidebar: scrollable level list with lock/unlock animations.
 */

export class LevelPanel {
  constructor(levelManager, onLevelSelect) {
    this.lm = levelManager;
    this.onLevelSelect = onLevelSelect;
    this.container = document.getElementById('level-panel');
    this.render();

    // Listen for level changes
    this.lm.on('levelCompleted', () => this.render());
    this.lm.on('levelChanged', () => this.render());
    this.lm.on('reset', () => this.render());
  }

  render() {
    if (!this.container) return;
    const levels = this.lm.getAllLevels();

    const isSandbox = this.lm.state.sandboxMode;

    const tracks = {
      'Solo Developer': levels.filter(l => l.id >= 1 && l.id <= 4),
      'Open Source Contributor': levels.filter(l => l.id >= 5 && l.id <= 8),
      'Enterprise Team Member': levels.filter(l => l.id >= 9 && l.id <= 10),
    };

    let listHtml = '';
    for (const [trackName, trackLevels] of Object.entries(tracks)) {
      listHtml += `
        <div class="level-track-header">
          <span>${trackName}</span>
        </div>
      `;
      listHtml += trackLevels.map(level => this._renderLevel(level)).join('');
    }

    this.container.innerHTML = `
      <div class="panel-header">
        <div>
          <span class="panel-title">Learning Tracks</span>
          <span class="panel-subtitle">${levels.filter(l => l.isCompleted).length}/${levels.length}</span>
        </div>
        <button id="sandbox-toggle" class="btn-ghost ${isSandbox ? 'sandbox-active' : ''}" title="Toggle Sandbox Mode">
          ${isSandbox ? '🏖️ Sandbox' : '🏖️'}
        </button>
      </div>
      <div class="level-list" id="level-list" ${isSandbox ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
        ${listHtml}
      </div>
    `;

    this._attachHandlers(levels);
    this._scrollToCurrent();

    const sandboxToggle = document.getElementById('sandbox-toggle');
    if (sandboxToggle) {
      sandboxToggle.addEventListener('click', () => {
        this.lm.toggleSandboxMode();
      });
    }
  }

  _renderLevel(level) {
    const cls = [
      'level-item',
      level.isCompleted ? 'level-completed' : '',
      level.isCurrent ? 'level-current' : '',
      level.isUnlocked && !level.isCompleted ? 'level-active' : '',
      !level.isUnlocked ? 'level-locked' : '',
    ].filter(Boolean).join(' ');

    const icon = level.isCompleted ? '✅' : level.isCurrent ? '🔥' : level.isUnlocked ? level.emoji : '🔒';
    const xpBadge = level.isCompleted
      ? `<span class="level-xp completed">+${level.xp}XP</span>`
      : `<span class="level-xp">${level.xp}XP</span>`;

    const commandTags = (level.requiredCommands || [])
      .map(cmd => `<span class="level-cmd-tag clickable-cmd" title="Click to use this command">${cmd}</span>`)
      .join('');

    return `
      <div class="${cls}" data-level-id="${level.id}" id="level-item-${level.id}" role="button" tabindex="${level.isUnlocked ? 0 : -1}" aria-label="Level ${level.id}: ${level.title}">
        <div class="level-icon">${icon}</div>
        <div class="level-info">
          <div class="level-name">${level.title}</div>
          <div class="level-meta">
            <span class="level-num">Level ${level.id}</span>
            ${xpBadge}
          </div>
          <div class="level-commands-list">
            ${commandTags}
          </div>
        </div>
        ${level.isCurrent ? '<div class="level-current-indicator"></div>' : ''}
      </div>
    `;
  }

  _attachHandlers(levels) {
    levels.forEach(level => {
      const el = document.getElementById(`level-item-${level.id}`);
      if (!el) return;
      if (level.isUnlocked) {
        el.addEventListener('click', () => this.onLevelSelect(level.id));
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') this.onLevelSelect(level.id);
        });
      }
    });

    // Command click delegation
    this.container.addEventListener('click', (e) => {
      const tag = e.target.closest('.level-cmd-tag');
      if (tag) {
        e.stopPropagation(); // Don't trigger level selection
        const command = tag.textContent;
        window.dispatchEvent(new CustomEvent('request-command-fill', { 
          detail: { command, autoRun: false } 
        }));
      }
    });
  }

  _scrollToCurrent() {
    setTimeout(() => {
      const current = this.container.querySelector('.level-current');
      if (current) current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 100);
  }

  unlockAnimation(levelId) {
    const el = document.getElementById(`level-item-${levelId}`);
    if (el) {
      el.classList.add('unlock-animation');
      setTimeout(() => el.classList.remove('unlock-animation'), 1000);
    }
  }
}
