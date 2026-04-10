/**
 * TokenSyncInfo.js
 * Shows user's sync token and provides information on how to sync progress across devices
 */

export class TokenSyncInfo {
  constructor(userId, onImport) {
    this.userId = userId;
    this.onImport = onImport || (() => {});
    this.isOpen = false;
    this.panel = null;
  }

  createPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'token-sync-panel';
    this.panel.innerHTML = `
      <div class="token-sync-content">
        <button class="token-sync-close" aria-label="Close token panel">&times;</button>
        
        <h3>💾 Sync Token</h3>
        
        <div class="token-section">
          <p class="token-desc">This is your unique progress backup token:</p>
          <div class="token-display">
            <code id="token-value">${this.userId}</code>
            <button id="token-copy-btn" class="token-copy-btn" title="Copy token">📋 Copy</button>
          </div>
        </div>

        <div class="sync-instructions">
          <h4>📱 How to Sync Across Devices</h4>
          <ol>
            <li><strong>Copy your token</strong> — click the 📋 button next to your progress token.</li>
            <li><strong>On another device</strong>, open the same app and click the Synced badge again.</li>
            <li><strong>Paste the token</strong> into the import field below and click Import Progress.</li>
            <li><strong>Your saved progress loads instantly</strong> in the same interactive Git simulator.</li>
          </ol>
          <p style="margin-top:0.75rem; color: var(--text-secondary);">
            You can also reopen the Help guide anytime with the top-right Help button or by pressing <kbd style="background: var(--bg-secondary); padding: 0.2rem 0.5rem; border-radius: 3px; border: 1px solid var(--border-color);">?</kbd>.
          </p>
        </div>

        <div class="sync-import" style="border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 1rem;">
          <h4>📥 Import Progress</h4>
          <p class="token-desc">Paste your token from another device:</p>
          <div class="token-import-input">
            <input type="text" id="token-import-field" placeholder="Paste your progress token here..." style="width: 100%; padding: 0.5rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">
            <button id="token-import-btn" class="token-import-btn" style="margin-top: 0.5rem; width: 100%; padding: 0.5rem; background: var(--accent-primary); color: var(--bg-primary); border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Import Progress</button>
          </div>
        </div>

        <div class="sync-tips">
          <h4>💡 Pro Tips:</h4>
          <ul>
            <li>Your token is stored locally and never expires</li>
            <li>Keep your token safe — it contains all your progress</li>
            <li>You can import progress on any device with your token</li>
            <li>Your browser's localStorage is also backed up to the server</li>
          </ul>
        </div>

        <button id="token-close-btn" class="token-close-action-btn">Got It!</button>
      </div>
    `;

    const closeBtn = this.panel.querySelector('.token-sync-close');
    closeBtn.addEventListener('click', () => this.close());

    const copyBtn = this.panel.querySelector('#token-copy-btn');
    copyBtn.addEventListener('click', () => this.copyToken());

    const importBtn = this.panel.querySelector('#token-import-btn');
    importBtn.addEventListener('click', () => this.handleImport());

    const doneBtn = this.panel.querySelector('#token-close-btn');
    doneBtn.addEventListener('click', () => this.close());

    // Click outside to close
    this.panel.addEventListener('click', (e) => {
      if (e.target === this.panel) this.close();
    });
  }

  copyToken() {
    const tokenValue = this.userId;
    navigator.clipboard.writeText(tokenValue).then(() => {
      const btn = this.panel.querySelector('#token-copy-btn');
      const originalText = btn.textContent;
      btn.textContent = '✅ Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    });
  }

  handleImport() {
    const importField = this.panel.querySelector('#token-import-field');
    const importedCode = importField.value.trim();
    
    if (!importedCode) {
      alert('Please paste a progress token first.');
      return;
    }

    this.onImport(importedCode);
  }

  show() {
    if (!this.panel) {
      this.createPanel();
    }
    this.isOpen = true;
    document.body.appendChild(this.panel);
  }

  close() {
    this.isOpen = false;
    if (this.panel?.parentNode) {
      this.panel.remove();
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.show();
    }
  }
}
