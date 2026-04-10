/**
 * VimModal.js
 * A terminal-style text editor modal specifically for interactive rebasing.
 * Simulates basic Vim keybindings and behavior.
 */

export class VimModal {
  constructor() {
    this.overlay = null;
    this.textarea = null;
    this.commandLine = null;
    this.resolve = null;
    this.content = '';
    this.filename = 'git-rebase-todo';
  }

  /**
   * Opens the editor with the given content.
   * Returns a promise that resolves with the edited content or null if cancelled.
   */
  open(content, filename = 'git-rebase-todo') {
    this.content = content;
    this.filename = filename;
    this._createUI();
    
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  _createUI() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'vim-overlay';
    
    this.overlay.innerHTML = `
      <div class="vim-container">
        <div class="vim-header">
          <span>${this.filename}</span>
          <span>[Modified]</span>
        </div>
        <div class="vim-content">
          <textarea class="vim-body" spellcheck="false" autocomplete="off"></textarea>
        </div>
        <div class="vim-footer">
          <span id="vim-pos">1,1</span>
          <span>All</span>
        </div>
        <div class="vim-command-line" id="vim-cmd">-- INSERT --</div>
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.textarea = this.overlay.querySelector('.vim-body');
    this.commandLine = this.overlay.querySelector('#vim-cmd');
    
    this.textarea.value = this.content;
    this.textarea.focus();

    // Event listeners
    this.textarea.addEventListener('keydown', (e) => this._handleKeyDown(e));
    this.textarea.addEventListener('input', () => this._updatePos());
    this.textarea.addEventListener('click', () => this._updatePos());
  }

  _handleKeyDown(e) {
    // Basic Vim command mode simulator (simplified)
    // For now, we allow standard editing but intercept Esc for command mode
    if (e.key === 'Escape') {
      e.preventDefault();
      this.commandLine.textContent = ':';
      this.textarea.blur(); // Focus loss simulates "command mode" for now
      
      const cmdHandler = (ce) => {
        if (ce.key === 'Enter') {
            const cmd = this.commandLine.textContent;
            window.removeEventListener('keydown', cmdHandler);
            this._executeCommand(cmd);
        } else if (ce.key.length === 1) {
            this.commandLine.textContent += ce.key;
        } else if (ce.key === 'Backspace') {
            this.commandLine.textContent = this.commandLine.textContent.slice(0, -1);
            if (this.commandLine.textContent === '') {
                window.removeEventListener('keydown', cmdHandler);
                this.textarea.focus();
                this.commandLine.textContent = '-- INSERT --';
            }
        }
      };
      window.addEventListener('keydown', cmdHandler);
    }
  }

  _executeCommand(cmd) {
    if (cmd === ':wq' || cmd === ':x') {
      this._close(this.textarea.value);
    } else if (cmd === ':q!') {
      this._close(null);
    } else if (cmd === ':q') {
      // Logic for "No write since last change" would go here
      this._close(null);
    } else {
      // Invalid command
      this.commandLine.textContent = 'E492: Not an editor command: ' + cmd.slice(1);
      setTimeout(() => {
        this.textarea.focus();
        this.commandLine.textContent = '-- INSERT --';
      }, 1000);
    }
  }

  _updatePos() {
    const textBefore = this.textarea.value.substring(0, this.textarea.selectionStart);
    const lines = textBefore.split('\n');
    const row = lines.length;
    const col = lines[lines.length - 1].length + 1;
    document.getElementById('vim-pos').textContent = `${row},${col}`;
  }

  _close(result) {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.resolve) {
      this.resolve(result);
      this.resolve = null;
    }
  }
}
