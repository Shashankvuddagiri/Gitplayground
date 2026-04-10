/**
 * CommandExplainer.js
 * Two features:
 * 1. Real-time tooltip above input showing what the current command does
 * 2. Ghost text (Copilot-style) inline suggestion in the input
 */

// Inline explanations for commands (subset, extended from backend)
const EXPLANATIONS = {
  'git':                    'A version control system command',
  'git init':               '🏁 Initialize a new Git repository here',
  'git add':                '📦 Stage files for the next commit',
  'git add .':              '📦 Stage ALL changed files for commit',
  'git commit':             '💾 Save staged changes as a commit snapshot',
  'git commit -m':          '💾 Commit with a message — add your description in quotes',
  'git status':             '🔍 Show what\'s changed, staged, or untracked',
  'git log':                '📜 View commit history on this branch',
  'git log --oneline':      '📜 Compact one-line commit history view',
  'git branch':             '🌿 List all branches',
  'git branch -b':          '🌿 Create a new branch',
  'git checkout':           '🔀 Switch to another branch',
  'git checkout -b':        '✨ Create AND switch to a new branch in one step',
  'git merge':              '🔗 Merge another branch into the current one',
  'git push':               '🚀 Upload commits to remote (GitHub)',
  'git pull':               '⬇️ Download and integrate remote changes',
  'git remote add':         '🌍 Register a remote repository URL',
  'git remote':             '🔗 Manage connections to remote repositories',
  'git stash':              '🗄️ Temporarily save uncommitted changes',
  'git stash pop':          '🗄️ Restore your most recently stashed changes',
  'git reset':              '↩️ Undo changes — use --hard (destructive) or --soft (safe)',
  'git reset --hard':       '⚠️ DESTRUCTIVE: Discard all changes to match last commit',
  'git reset --soft':       '↩️ Undo last commit but keep changes staged',
  'git diff':               '🎨 Show line-by-line differences in files',
  'git tag':                '🏷️ Create a named marker for a commit',
  'git config':             '⚙️ Set Git configuration (name, email, etc.)',
  'git show':               '🔎 Show details of a specific commit',
  'git revert':             '🔙 Safely undo a commit by creating a new one',
  'touch':                  '📄 Create a new empty file',
  'ls':                     '📁 List files in the current directory',
  'cat':                    '👁️ Display a file\'s contents',
  'echo':                   '📝 Print text, or write to a file with >',
  'clear':                  '🧹 Clear the terminal screen (Ctrl+L)',
  'help':                   '❓ Show all available commands',
  'pwd':                    '📍 Show current working directory path',
  'mkdir':                  '📂 Create a new directory',
  'history':                '📋 Show recent command history',
};

// Smart autocomplete suggestions based on context
const GHOST_SUGGESTIONS = {
  'git ':              ['git init', 'git add .', 'git commit -m ""', 'git status', 'git log --oneline'],
  'git i':             ['git init'],
  'git a':             ['git add .', 'git add'],
  'git c':             ['git commit -m ""', 'git checkout -b ', 'git checkout main', 'git config'],
  'git s':             ['git status', 'git stash', 'git stash pop', 'git show'],
  'git l':             ['git log --oneline', 'git log'],
  'git b':             ['git branch', 'git branch '],
  'git ch':            ['git checkout -b ', 'git checkout main'],
  'git co':            ['git commit -m ""', 'git config user.name ""'],
  'git m':             ['git merge ', 'git merge feature'],
  'git p':             ['git push origin main', 'git pull origin main'],
  'git r':             ['git remote add origin ', 'git reset --hard', 'git reset --soft HEAD~1'],
  'git st':            ['git status', 'git stash', 'git stash pop'],
  'git pu':            ['git push origin main'],
  'git pl':            ['git pull origin main'],
  'git re':            ['git remote add origin ', 'git reset --hard', 'git revert HEAD'],
  'git me':            ['git merge '],
  'git t':             ['git tag '],
  'git d':             ['git diff'],
  'gi':                ['git init', 'git add .', 'git status'],
  'to':                ['touch README.md', 'touch app.js', 'touch index.html'],
  'ec':                ['echo "Hello" > README.md'],
  'ls':                ['ls'],
  'cl':                ['clear'],
  'he':                ['help'],
};

export class CommandExplainer {
  constructor(inputEl) {
    this.inputEl      = inputEl;
    this.ghostEl      = null;
    this.tooltipEl    = null;
    this.currentGhost = '';
    this.ghostIndex   = 0;
    this.ghostOptions = [];

    this._createElements();
    this._attach();
  }

  // ─── DOM Setup ────────────────────────────────────────────────────────────────
  _createElements() {
    // Tooltip above the input
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.id = 'cmd-explainer-tooltip';
    this.tooltipEl.className = 'cmd-explainer hidden';
    this.tooltipEl.setAttribute('aria-live', 'polite');
    this.tooltipEl.setAttribute('aria-label', 'Command explanation');

    // Ghost text overlay (sits behind the real input)
    this.ghostEl = document.createElement('div');
    this.ghostEl.id = 'cmd-ghost';
    this.ghostEl.className = 'cmd-ghost';
    this.ghostEl.setAttribute('aria-hidden', 'true');

    // Insert both next to the input
    const inputRow = this.inputEl.closest('.terminal-input-row');
    if (inputRow) {
      inputRow.parentElement.insertBefore(this.tooltipEl, inputRow);
      inputRow.style.position = 'relative';
      inputRow.appendChild(this.ghostEl);
    }
  }

  _attach() {
    if (!this.inputEl) return;

    this.inputEl.addEventListener('input',   () => this._onInput());
    this.inputEl.addEventListener('keydown', (e) => this._onKeydown(e));
    this.inputEl.addEventListener('blur',    () => this._hideAll());
    this.inputEl.addEventListener('focus',   () => this._onInput());
  }

  // ─── Main Input Handler ───────────────────────────────────────────────────────
  _onInput() {
    const val = this.inputEl.value;

    this._updateExplanation(val);
    this._updateGhost(val);
  }

  _onKeydown(e) {
    if (e.key === 'Tab' && this.currentGhost) {
      e.preventDefault();
      // Accept ghost suggestion
      this.inputEl.value = this.currentGhost;
      this._clearGhost();
      this._updateExplanation(this.currentGhost);
      return;
    }

    if (e.key === 'ArrowRight' && this.currentGhost) {
      // Accept one word of the ghost
      const current  = this.inputEl.value;
      const rest     = this.currentGhost.slice(current.length);
      const nextWord = rest.match(/^\S+/)?.[0] || rest;
      this.inputEl.value = current + nextWord;
      e.preventDefault();
      this._onInput();
      return;
    }

    // Escape clears ghost
    if (e.key === 'Escape') {
      this._clearGhost();
      this._hideTooltip();
    }
  }

  // ─── Explanation Tooltip ──────────────────────────────────────────────────────
  _updateExplanation(val) {
    if (!val.trim()) {
      this._hideTooltip();
      return;
    }

    const explanation = this._getExplanation(val.trim().toLowerCase());
    if (explanation) {
      this._showTooltip(explanation, val);
    } else {
      this._hideTooltip();
    }
  }

  _getExplanation(input) {
    // Try progressively shorter prefixes for best match
    const keys = Object.keys(EXPLANATIONS).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (input === key || input.startsWith(key + ' ') || input.startsWith(key)) {
        return EXPLANATIONS[key];
      }
    }
    return null;
  }

  _showTooltip(text, rawInput) {
    if (!this.tooltipEl) return;
    this.tooltipEl.innerHTML = `
      <span class="cmd-explainer-icon">⚡</span>
      <span class="cmd-explainer-text">${text}</span>
      <span class="cmd-explainer-hint">Tab to complete · Enter to run</span>
    `;
    this.tooltipEl.classList.remove('hidden');
    this.tooltipEl.classList.add('cmd-explainer-visible');
  }

  _hideTooltip() {
    if (!this.tooltipEl) return;
    this.tooltipEl.classList.remove('cmd-explainer-visible');
    this.tooltipEl.classList.add('hidden');
  }

  // ─── Ghost Text ───────────────────────────────────────────────────────────────
  _updateGhost(val) {
    if (!val.trim()) {
      this._clearGhost();
      return;
    }

    const lower = val.toLowerCase();
    const options = this._getGhostOptions(lower);

    if (options.length === 0 || options[0] === val) {
      this._clearGhost();
      return;
    }

    this.ghostOptions = options;
    this.ghostIndex   = 0;
    this._renderGhost(val, options[0]);
  }

  _getGhostOptions(input) {
    // Try sorted keys from longest to shortest prefix match
    const keys = Object.keys(GHOST_SUGGESTIONS).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (input.startsWith(key) || key.startsWith(input)) {
        const opts = GHOST_SUGGESTIONS[key]?.filter(s =>
          s.toLowerCase().startsWith(input)
        ) || [];
        if (opts.length > 0) return opts;
      }
    }

    // Fallback: search all suggestions
    const all = Object.values(GHOST_SUGGESTIONS).flat();
    return all.filter(s => s.toLowerCase().startsWith(input));
  }

  _renderGhost(typed, suggestion) {
    if (!this.ghostEl || !suggestion) return;
    if (!suggestion.toLowerCase().startsWith(typed.toLowerCase())) {
      this._clearGhost();
      return;
    }

    this.currentGhost = suggestion;

    // Measure typed text width to position ghost correctly
    const canvas  = document.createElement('canvas');
    const ctx     = canvas.getContext('2d');
    const style   = window.getComputedStyle(this.inputEl);
    ctx.font      = `${style.fontSize} ${style.fontFamily}`;
    const typedWidth = ctx.measureText(typed).width;

    // Show the untyped suffix as ghost text
    const ghostSuffix = suggestion.slice(typed.length);
    this.ghostEl.textContent = ghostSuffix;
    this.ghostEl.style.left = `${typedWidth}px`;
    this.ghostEl.classList.add('ghost-visible');
  }

  _clearGhost() {
    this.currentGhost = '';
    this.ghostOptions = [];
    if (this.ghostEl) {
      this.ghostEl.textContent = '';
      this.ghostEl.classList.remove('ghost-visible');
    }
  }

  _hideAll() {
    setTimeout(() => {
      this._clearGhost();
      this._hideTooltip();
    }, 150);
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  destroy() {
    this.tooltipEl?.remove();
    this.ghostEl?.remove();
  }
}
