/**
 * MergeEditor.js
 * Split-pane conflict resolution editor for Level 8.
 * Shows ours/theirs/resolution panes with Accept quick actions.
 */

export class MergeEditor {
  constructor(conflictEngine, onResolved) {
    this.conflictEngine = conflictEngine;
    this.onResolved = onResolved;
    this.container = document.getElementById('merge-editor');
    this.visible = false;
  }

  show(conflictData) {
    if (!this.container) return;

    const filename = conflictData.conflicts[0];
    const oursContent = conflictData.ours[filename] || '';
    const theirsContent = conflictData.theirs[filename] || '';
    const markerContent = this.conflictEngine.repo.workingTree[filename]?.content || '';

    this.activeFilename = filename;

    this.container.innerHTML = `
      <div class="merge-editor-inner">
        <div class="merge-header">
          <div class="merge-title">
            <span class="merge-icon">⚔️</span>
            <span>Conflict Resolution: <code>${filename}</code></span>
          </div>
          <div class="merge-actions">
            <button class="merge-btn accept-ours" id="accept-ours">Accept Ours ←</button>
            <button class="merge-btn accept-theirs" id="accept-theirs">Accept Theirs →</button>
            <button class="merge-btn accept-both" id="accept-both">Accept Both</button>
          </div>
        </div>

        <div class="merge-panes">
          <!-- Ours -->
          <div class="merge-pane merge-ours">
            <div class="pane-label pane-label-ours">← OURS (HEAD / main)</div>
            <pre class="pane-content" id="pane-ours">${this._escapeHtml(oursContent)}</pre>
          </div>

          <!-- Resolution -->
          <div class="merge-pane merge-resolution">
            <div class="pane-label pane-label-resolution">✏️ YOUR RESOLUTION</div>
            <div class="conflict-marker-hint" id="marker-hint">Remove the &lt;&lt;&lt;&lt;&lt;&lt;&lt;, =======, and &gt;&gt;&gt;&gt;&gt;&gt;&gt; lines</div>
            <textarea
              class="pane-editor"
              id="resolution-editor"
              spellcheck="false"
              aria-label="Conflict resolution editor"
            >${this._escapeHtml(markerContent)}</textarea>
          </div>

          <!-- Theirs -->
          <div class="merge-pane merge-theirs">
            <div class="pane-label pane-label-theirs">THEIRS (${conflictData.theirBranch || 'feature'}) →</div>
            <pre class="pane-content" id="pane-theirs">${this._escapeHtml(theirsContent)}</pre>
          </div>
        </div>

        <div class="merge-footer">
          <div class="merge-status" id="merge-status">
            <span class="status-dot status-conflict"></span>
            Conflict markers present — resolve before continuing
          </div>
          <button class="btn-primary merge-validate-btn" id="validate-resolution">
            ✅ Validate Resolution
          </button>
        </div>
      </div>
    `;

    this.container.classList.remove('hidden');
    this.visible = true;
    this._attachHandlers(oursContent, theirsContent);
    this._setupLiveValidation();
  }

  hide() {
    if (!this.container) return;
    this.container.classList.add('hidden');
    this.visible = false;
  }

  _attachHandlers(oursContent, theirsContent) {
    document.getElementById('accept-ours')?.addEventListener('click', () => {
      const editor = document.getElementById('resolution-editor');
      if (editor) {
        editor.value = oursContent;
        this._updateStatus(editor.value);
      }
    });

    document.getElementById('accept-theirs')?.addEventListener('click', () => {
      const editor = document.getElementById('resolution-editor');
      if (editor) {
        editor.value = theirsContent;
        this._updateStatus(editor.value);
      }
    });

    document.getElementById('accept-both')?.addEventListener('click', () => {
      const editor = document.getElementById('resolution-editor');
      if (editor) {
        editor.value = oursContent + '\n' + theirsContent;
        this._updateStatus(editor.value);
      }
    });

    document.getElementById('validate-resolution')?.addEventListener('click', () => {
      this._validateResolution();
    });
  }

  _setupLiveValidation() {
    const editor = document.getElementById('resolution-editor');
    if (!editor) return;
    editor.addEventListener('input', () => this._updateStatus(editor.value));
  }

  _updateStatus(content) {
    const statusEl = document.getElementById('merge-status');
    const hintEl = document.getElementById('marker-hint');
    if (!statusEl) return;

    const hasMarkers = ['<<<<<<<', '=======', '>>>>>>>'].some(m => content.includes(m));

    if (hasMarkers) {
      statusEl.innerHTML = `<span class="status-dot status-conflict"></span> Conflict markers present — remove <<<<<, =====, >>>>> lines`;
      statusEl.className = 'merge-status status-error';
      if (hintEl) hintEl.classList.remove('hidden');
    } else if (content.trim() === '') {
      statusEl.innerHTML = `<span class="status-dot status-warning"></span> Resolution is empty`;
      statusEl.className = 'merge-status status-warning';
    } else {
      statusEl.innerHTML = `<span class="status-dot status-ok"></span> Looks good! Click Validate Resolution`;
      statusEl.className = 'merge-status status-ok';
      if (hintEl) hintEl.classList.add('hidden');
    }
  }

  _validateResolution() {
    const editor = document.getElementById('resolution-editor');
    if (!editor) return;
    const resolved = editor.value;

    const result = this.conflictEngine.validateResolution(this.activeFilename, resolved);

    if (!result.valid) {
      const statusEl = document.getElementById('merge-status');
      if (statusEl) {
        statusEl.innerHTML = `<span class="status-dot status-conflict"></span> ${result.error}`;
        statusEl.className = 'merge-status status-error';
      }
      // Shake animation
      editor.classList.add('editor-shake');
      setTimeout(() => editor.classList.remove('editor-shake'), 600);
      return;
    }

    // Apply the resolution
    const applyResult = this.conflictEngine.applyResolution(this.activeFilename, resolved);

    if (applyResult.success) {
      this.hide();
      if (this.onResolved) this.onResolved({ filename: this.activeFilename, content: resolved });
    }
  }

  _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
