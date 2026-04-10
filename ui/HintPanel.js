/**
 * HintPanel.js
 * Right contextual panel: level goal, progressive hints, error explainer, cheat sheet, git tree visualizer.
 */

export class HintPanel {
  constructor(levelManager) {
    this.lm = levelManager;
    this.container = document.getElementById('hint-panel');
    this.hintIndex = 0;
    this.lastError = null;
    this.render();
  }

  setLevel(level) {
    this.hintIndex = 0;
    this.lastError = null;
    this.activeLevel = level;
    this.render();
  }

  showError(errorData) {
    this.lastError = errorData;
    this._updateErrorSection();
  }

  clearError() {
    this.lastError = null;
    this._updateErrorSection();
  }

  updateGitTree(repo) { // Deprecated: Managed by CommitGraph D3 engine
  }

  render() {
    if (!this.container) return;
    const level = this.activeLevel || this.lm.getCurrentLevel();

    this.container.innerHTML = `
      <div class="hint-panel-inner">
        ${level ? `
        <!-- Goal Section -->
        <div class="hint-section goal-section">
          <div class="hint-section-header">
            <span class="hint-icon">🎯</span>
            <span class="hint-section-title">Current Goal</span>
          </div>
          <div class="goal-text" id="goal-text">${level.goal}</div>
          <div class="level-concept" id="concept-note"></div>
        </div>

        <!-- Hints Section -->
        <div class="hint-section hints-section">
          <div class="hint-section-header">
            <span class="hint-icon">💡</span>
            <span class="hint-section-title">Hints</span>
            <button class="hint-btn" id="hint-btn">Show Hint</button>
          </div>
          <div class="hint-display" id="hint-display"></div>
          <div class="hint-progress" id="hint-progress"></div>
        </div>
        ` : `
        <!-- Sandbox Mode -->
        <div class="hint-section goal-section">
          <div class="hint-section-header">
            <span class="hint-icon">🏖️</span>
            <span class="hint-section-title">Sandbox Mode Active</span>
          </div>
          <div class="goal-text" style="color: var(--text-muted);">
            You are in a free-form workspace. Explore commands without any goals or restrictions.
          </div>
        </div>
        `}

        <!-- Error Section -->
        <div class="hint-section error-section hidden" id="error-section">
          <div class="hint-section-header">
            <span class="hint-icon">🚨</span>
            <span class="hint-section-title">What Went Wrong</span>
          </div>
          <div class="error-explanation" id="error-explanation"></div>
          <div class="error-fix" id="error-fix"></div>
        </div>

        <!-- Cheat Sheet Section -->
        <div class="hint-section cheatsheet-section">
          <div class="hint-section-header cheatsheet-toggle" id="cheatsheet-toggle" role="button" tabindex="0">
            <span class="hint-icon">📖</span>
            <span class="hint-section-title">Cheat Sheet</span>
            <span class="toggle-arrow" id="cheatsheet-arrow">▼</span>
          </div>
          <div class="cheatsheet-body hidden" id="cheatsheet-body">
            ${this._renderCheatSheet()}
          </div>
        </div>

        <!-- Git Tree Section -->
        <div class="hint-section tree-section">
          <div class="hint-section-header">
            <span class="hint-icon">🌳</span>
            <span class="hint-section-title">Git Tree</span>
          </div>
          <div class="git-tree-container" id="git-tree-canvas" style="min-height: 200px"></div>
        </div>
      </div>
    `;

    this._attachHandlers(level);

  }

  _attachHandlers(level) {
    // Hint button
    const hintBtn = document.getElementById('hint-btn');
    if (hintBtn) {
      hintBtn.addEventListener('click', () => this._showNextHint(level));
    }

    // Cheat sheet toggle
    const toggle = document.getElementById('cheatsheet-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => this._toggleCheatSheet());
      toggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._toggleCheatSheet();
      });
    }

    // Command click delegation for cheat sheet
    this.container.addEventListener('click', (e) => {
      const tag = e.target.closest('.cs-cmd');
      if (tag) {
        const commandText = tag.textContent;
        // Strip out placeholders like <file> if they are there, or just fill them
        window.dispatchEvent(new CustomEvent('request-command-fill', { 
          detail: { command: commandText, autoRun: false } 
        }));
      }
    });
  }

  _showNextHint(level) {
    if (!level?.hints?.length) return;
    const hints = level.hints;
    const display = document.getElementById('hint-display');
    const progress = document.getElementById('hint-progress');

    if (this.hintIndex < hints.length) {
      if (display) {
        display.classList.remove('hint-slide-in');
        void display.offsetWidth; // force reflow
        display.textContent = hints[this.hintIndex];
        display.classList.add('hint-slide-in');
      }
      if (progress) {
        progress.textContent = `Hint ${this.hintIndex + 1}/${hints.length}`;
      }
      this.hintIndex++;
    }

    const hintBtn = document.getElementById('hint-btn');
    if (hintBtn && this.hintIndex >= hints.length) {
      hintBtn.textContent = 'No more hints';
      hintBtn.disabled = true;
    }
  }

  _updateErrorSection() {
    const section = document.getElementById('error-section');
    const explanation = document.getElementById('error-explanation');
    const fix = document.getElementById('error-fix');

    if (!section) return;

    if (this.lastError) {
      section.classList.remove('hidden');
      section.classList.add('error-flash');
      setTimeout(() => section.classList.remove('error-flash'), 600);
      if (explanation) explanation.textContent = this.lastError.explanation || '';
      if (fix && this.lastError.fix) {
        fix.innerHTML = `🔧 <code>${this.lastError.fix}</code>`;
        fix.classList.remove('hidden');
      } else if (fix) {
        fix.classList.add('hidden');
      }
    } else {
      section.classList.add('hidden');
    }
  }

  _renderGitTree(repo) {}
  _renderGitTreePlaceholder() {}

  _toggleCheatSheet() {
    const body = document.getElementById('cheatsheet-body');
    const arrow = document.getElementById('cheatsheet-arrow');
    if (!body) return;
    const isHidden = body.classList.contains('hidden');
    body.classList.toggle('hidden', !isHidden);
    if (arrow) arrow.textContent = isHidden ? '▲' : '▼';
  }

  _renderCheatSheet() {
    const sections = [
      {
        title: 'Setup',
        cmds: [
          ['git init', 'Start a repo'],
          ['git config user.name "Name"', 'Set identity'],
        ],
      },
      {
        title: 'Stage & Commit',
        cmds: [
          ['git add <file>', 'Stage a file'],
          ['git add .', 'Stage all'],
          ['git commit -m "msg"', 'Commit'],
        ],
      },
      {
        title: 'Inspect',
        cmds: [
          ['git status', 'What changed?'],
          ['git log --oneline', 'Commit history'],
          ['git diff', 'Show changes'],
        ],
      },
      {
        title: 'Branches',
        cmds: [
          ['git branch', 'List branches'],
          ['git checkout -b name', 'New branch'],
          ['git checkout main', 'Switch to main'],
          ['git merge feature', 'Merge branch'],
        ],
      },
      {
        title: 'Remote',
        cmds: [
          ['git remote add origin url', 'Add remote'],
          ['git push origin main', 'Push'],
          ['git pull origin main', 'Pull'],
        ],
      },
      {
        title: 'Undo',
        cmds: [
          ['git reset HEAD <file>', 'Unstage'],
          ['git reset --hard', 'Discard all changes'],
          ['git stash', 'Shelve changes'],
          ['git stash pop', 'Restore stash'],
        ],
      },
    ];

    return sections.map(s => `
      <div class="cs-section">
        <div class="cs-title">${s.title}</div>
        ${s.cmds.map(([cmd, desc]) => `
          <div class="cs-row">
            <code class="cs-cmd clickable-cmd" title="Click to use this command">${cmd}</code>
            <span class="cs-desc">${desc}</span>
          </div>
        `).join('')}
      </div>
    `).join('');
  }
}
