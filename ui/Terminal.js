/**
 * Terminal.js
 * Core terminal component: rendering, input, history, autocomplete, output colorization.
 */

import { CommandParser } from '../engine/CommandParser.js';
import { CommandExecutor } from '../engine/CommandExecutor.js';
import { Dictionary } from './Dictionary.js';

export class Terminal {
  constructor(repo, onCommand) {
    console.log('[Terminal] Constructor called');
    this.repo = repo;
    this.onCommand = onCommand;
    this.executor = new CommandExecutor(repo);
    this.history = [];
    this.historyIndex = -1;
    this.currentInput = '';
    this.persistentHistory = []; // Stores { input, outputLines, timestamp }

    this.outputEl = document.getElementById('terminal-output');
    this.inputEl = document.getElementById('terminal-input');
    this.promptEl = document.getElementById('terminal-prompt');

    console.log('[Terminal] Elements found:', { output: !!this.outputEl, input: !!this.inputEl, prompt: !!this.promptEl });

    this._attach();
    this._listenForExternalCommands();
    console.log('[Terminal] About to call _printWelcome');
    this._printWelcome();
    console.log('[Terminal] After _printWelcome');
    this._focusInput();
    console.log('[Terminal] Constructor complete');
  }

  _listenForExternalCommands() {
    window.addEventListener('request-command-fill', (e) => {
      const { command, autoRun } = e.detail;
      if (command) {
        this.fillInput(command, autoRun);
      }
    });
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  printLines(lines) {
    if (!this.outputEl) return;
    lines.forEach(({ text, type }) => {
      const div = document.createElement('div');
      div.className = `output-line output-${type || 'normal'}`;
      const escaped = (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      div.innerHTML = Dictionary.parse(escaped);
      this.outputEl.appendChild(div);
    });
    this._scrollToBottom();
  }

  printSystemMessage(text, type = 'info') {
    this.printLines([{ text, type }]);
  }

  clear() {
    if (this.outputEl) this.outputEl.innerHTML = '';
  }

  /**
   * Programmatically populate the terminal input.
   * @param {string} text 
   * @param {boolean} autoRun 
   */
  fillInput(text, autoRun = false) {
    if (!this.inputEl) return;
    this.inputEl.value = text;
    this._focusInput();
    
    if (autoRun) {
      this._submitCommand();
    }
  }

  updatePrompt() {
    if (this.promptEl) {
      const branch = this.repo.initialized
        ? ` <span class="prompt-branch">(${this.repo.currentBranch || 'detached'})</span>`
        : '';
      this.promptEl.innerHTML = `<span class="prompt-user">user</span><span class="prompt-at">@</span><span class="prompt-host">gitplayground</span>:<span class="prompt-dir">~/project</span>${branch}<span class="prompt-dollar">$</span>`;
    }
  }

  // ─── Event Handling ───────────────────────────────────────────────────────────

  _attach() {
    if (!this.inputEl) return;

    this.inputEl.addEventListener('keydown', (e) => this._handleKey(e));

    // Click anywhere on terminal to focus input
    const container = document.getElementById('terminal-container');
    if (container) {
      container.addEventListener('click', () => this._focusInput());
    }
  }

  _handleKey(e) {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        this._submitCommand();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this._navigateHistory(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this._navigateHistory(1);
        break;
      case 'Tab':
        e.preventDefault();
        this._autocomplete();
        break;
      case 'l':
        if (e.ctrlKey) {
          e.preventDefault();
          this.clear();
        }
        break;
      case 'c':
        if (e.ctrlKey) {
          e.preventDefault();
          this._cancelCommand();
        }
        break;
    }
  }

  async _submitCommand() {
    const input = this.inputEl.value.trim();
    this.inputEl.value = '';
    this.historyIndex = -1;

    if (!input) return;

    // Echo the command to output
    this._printCommand(input);

    // Save to history
    this.history.unshift(input);
    if (this.history.length > 100) this.history.pop();

    // Handle special cases
    if (input === 'clear') {
      this.clear();
      this.updatePrompt();
      return;
    }

    if (input === 'history') {
      this._printHistory();
      this.updatePrompt();
      return;
    }

    // Parse and execute
    const parsed = CommandParser.parse(input);
    const result = await this.executor.execute(parsed);

    // Handle clear output signal
    if (result.clear) {
      this.clear();
      this.updatePrompt();
      return;
    }

    // Print output
    if (result.lines && result.lines.length > 0) {
      this.printLines(result.lines);
    }

    // Save to persistent session log
    this.persistentHistory.push({
      input,
      outputLines: [...(result.lines || [])],
      timestamp: Date.now()
    });

    // Blank separator line for readability
    if (result.lines && result.lines.length > 0) {
      this.printLines([{ text: '', type: 'normal' }]);
    }

    // Update prompt (branch may have changed)
    this.updatePrompt();

    // Notify app of the command result
    if (this.onCommand) {
      this.onCommand({
        input,
        parsed,
        result,
        levelEvent: result.levelEvent,
        triggerConflict: result.triggerConflict,
        conflictData: result.conflictData,
      });
    }
  }

  _printCommand(text) {
    const div = document.createElement('div');
    div.className = 'output-line output-command';
    div.innerHTML = `<span class="cmd-prefix">$ </span>${this._escapeHtml(text)}`;
    this.outputEl?.appendChild(div);
  }

  _navigateHistory(direction) {
    if (this.history.length === 0) return;

    if (this.historyIndex === -1 && direction === -1) {
      this.currentInput = this.inputEl.value;
    }

    this.historyIndex = Math.max(-1, Math.min(this.history.length - 1, this.historyIndex + direction));

    if (this.historyIndex === -1) {
      this.inputEl.value = this.currentInput;
    } else {
      this.inputEl.value = this.history[this.historyIndex];
    }

    // Move cursor to end
    setTimeout(() => {
      const len = this.inputEl.value.length;
      this.inputEl.setSelectionRange(len, len);
    }, 0);
  }

  _autocomplete() {
    const input = this.inputEl.value;
    const suggestions = CommandParser.getSuggestions(input);

    if (suggestions.length === 1) {
      this.inputEl.value = suggestions[0] + ' ';
    } else if (suggestions.length > 1) {
      // Show suggestions
      this.printLines([
        { text: '', type: 'normal' },
        { text: `Suggestions: ${suggestions.join('  ')}`, type: 'info' },
      ]);
    }
  }

  _cancelCommand() {
    const text = this.inputEl.value;
    this._printCommand(text + '^C');
    this.inputEl.value = '';
    this.historyIndex = -1;
    this.printLines([{ text: '', type: 'normal' }]);
  }

  _focusInput() {
    this.inputEl?.focus();
  }

  _scrollToBottom() {
    const wrapper = document.getElementById('terminal-scroll');
    if (wrapper) {
      wrapper.scrollTop = wrapper.scrollHeight;
    }
  }

  _printHistory() {
    if (this.persistentHistory.length === 0) {
      this.printSystemMessage('No command history yet.', 'info');
      return;
    }
    this.printSystemMessage(`📜 SESSION HISTORY (${this.persistentHistory.length} total)`, 'success');
    this.printLines([{ text: '─'.repeat(50), type: 'info' }]);
    
    this.persistentHistory.forEach((entry, i) => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      this.printLines([
        { text: `[${time}] $ ${entry.input}`, type: 'command' }
      ]);
      if (entry.outputLines && entry.outputLines.length > 0) {
        this.printLines(entry.outputLines);
      }
      this.printLines([{ text: '', type: 'normal' }]);
    });
  }

  _escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ─── Welcome Message ──────────────────────────────────────────────────────────

  _printWelcome() {
    const lines = [
      { text: `╔══════════════════════════════════════════════════╗`, type: 'success' },
      { text: `║         🎮  Git Playground  v1.0                 ║`, type: 'success' },
      { text: `║   Learn Git by actually using it                 ║`, type: 'success' },
      { text: `╚══════════════════════════════════════════════════╝`, type: 'success' },
      { text: ``, type: 'normal' },
      { text: `Type 'help' to see all available commands.`, type: 'info' },
      { text: `Start with the level on the left panel → Level 1.`, type: 'info' },
      { text: ``, type: 'normal' },
    ];
    this.printLines(lines);
    this.updatePrompt();
  }
}
