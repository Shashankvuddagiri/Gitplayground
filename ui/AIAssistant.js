/**
 * AIAssistant.js
 * Floating AI chat panel powered by the backend Gemini proxy.
 * Gives contextual Git help — answers questions, explains errors, guides users.
 */

export class AIAssistant {
  constructor(getContext) {
    this.getContext   = getContext;   // function() → { level, branch, lastCommand, hasError }
    this.messages     = [];
    this.isOpen       = false;
    this.isLoading    = false;
    this.apiBase      = '/api/ai';

    this._createDOM();
    this._attachHandlers();
  }

  // ─── DOM Creation ─────────────────────────────────────────────────────────────
  _createDOM() {
    // Floating trigger button
    this.btn = document.createElement('button');
    this.btn.id = 'ai-btn';
    this.btn.className = 'ai-fab';
    this.btn.setAttribute('aria-label', 'Open AI Assistant');
    this.btn.setAttribute('title', 'Ask GitBot anything about Git');
    this.btn.innerHTML = `
      <span class="ai-fab-icon">🤖</span>
      <span class="ai-fab-label">GitBot</span>
      <span class="ai-fab-ping"></span>
    `;
    document.body.appendChild(this.btn);

    // Chat panel
    this.panel = document.createElement('div');
    this.panel.id = 'ai-panel';
    this.panel.className = 'ai-panel hidden';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'GitBot AI Assistant');
    this.panel.innerHTML = `
      <div class="ai-panel-header">
        <div class="ai-header-info">
          <span class="ai-avatar">🤖</span>
          <div>
            <div class="ai-name">GitBot</div>
            <div class="ai-status" id="ai-status">● Online</div>
          </div>
        </div>
        <button class="ai-close-btn" id="ai-close" aria-label="Close AI Assistant">✕</button>
      </div>

      <div class="ai-messages" id="ai-messages">
        <div class="ai-message ai-bot-msg">
          <div class="ai-msg-bubble">
            👋 Hi! I'm <strong>GitBot</strong>, your AI Git tutor.<br><br>
            Ask me anything about Git — commands, workflows, errors, conflicts.<br><br>
            <div class="ai-quick-prompts" id="ai-quick-prompts">
              <div class="quick-prompts-label">Try asking:</div>
              <button class="ai-quick-btn" data-q="What does git rebase do?">What is git rebase?</button>
              <button class="ai-quick-btn" data-q="How do I undo my last commit?">Undo last commit</button>
              <button class="ai-quick-btn" data-q="Why do merge conflicts happen?">Why merge conflicts?</button>
              <button class="ai-quick-btn" data-q="Explain the Git workflow">Git workflow</button>
            </div>
          </div>
        </div>
      </div>

      <div class="ai-input-area">
        <textarea
          id="ai-input"
          class="ai-textarea"
          placeholder="Ask GitBot about Git…"
          rows="2"
          aria-label="Message to GitBot"
        ></textarea>
        <button class="ai-send-btn" id="ai-send" aria-label="Send message">
          <span class="ai-send-icon">➤</span>
        </button>
      </div>

      <div class="ai-footer">
        <span class="ai-powered">Powered by Gemini AI</span>
        <button class="ai-clear-btn" id="ai-clear">Clear chat</button>
      </div>
    `;
    document.body.appendChild(this.panel);
  }

  // ─── Event Handlers ───────────────────────────────────────────────────────────
  _attachHandlers() {
    this.btn.addEventListener('click', () => this.toggle());
    document.getElementById('ai-close')?.addEventListener('click', () => this.close());

    const sendBtn = document.getElementById('ai-send');
    const input   = document.getElementById('ai-input');

    sendBtn?.addEventListener('click', () => this._sendMessage());
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._sendMessage();
      }
    });

    // Quick prompt buttons
    this.panel.addEventListener('click', (e) => {
      const qBtn = e.target.closest('.ai-quick-btn');
      if (qBtn) {
        const q = qBtn.dataset.q;
        const inp = document.getElementById('ai-input');
        if (inp) inp.value = q;
        this._sendMessage();
      }
    });

    // Clear chat
    document.getElementById('ai-clear')?.addEventListener('click', () => this._clearChat());

    // Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.isOpen = true;
    this.panel.classList.remove('hidden');
    this.panel.classList.add('ai-panel-open');
    this.btn.classList.add('ai-fab-active');
    // Remove ping after first open
    this.btn.querySelector('.ai-fab-ping')?.remove();
    setTimeout(() => document.getElementById('ai-input')?.focus(), 100);
  }

  close() {
    this.isOpen = false;
    this.panel.classList.remove('ai-panel-open');
    this.panel.classList.add('ai-panel-closing');
    setTimeout(() => {
      this.panel.classList.add('hidden');
      this.panel.classList.remove('ai-panel-closing');
    }, 300);
    this.btn.classList.remove('ai-fab-active');
  }

  // Programmatically ask a question (called from Terminal after errors)
  askForHelp(question, autoOpen = false) {
    const input = document.getElementById('ai-input');
    if (input) input.value = question;
    if (autoOpen && !this.isOpen) this.open();
    if (autoOpen) setTimeout(() => this._sendMessage(), 200);
  }

  // ─── Message Sending ──────────────────────────────────────────────────────────
  async _sendMessage() {
    const input = document.getElementById('ai-input');
    if (!input) return;

    const message = input.value.trim();
    if (!message || this.isLoading) return;

    input.value = '';

    // Add user message
    this._addMessage(message, 'user');

    // Typing indicator
    const typingId = this._addTypingIndicator();
    this.isLoading = true;
    this._setSendState(false);

    try {
      const context = this.getContext?.() || {};
      const response = await fetch(`${this.apiBase}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context }),
      });

      const data = await response.json();
      this._removeTypingIndicator(typingId);
      this._addMessage(data.reply || 'Sorry, I couldn\'t get a response.', 'bot', data.fallback);
    } catch (err) {
      this._removeTypingIndicator(typingId);
      this._addMessage('⚠️ Connection error. Make sure the backend server is running (`npm start`).', 'bot', true);
    } finally {
      this.isLoading = false;
      this._setSendState(true);
      input.focus();
    }
  }

  // ─── Message Rendering ────────────────────────────────────────────────────────
  _addMessage(text, role, isFallback = false) {
    const container = document.getElementById('ai-messages');
    if (!container) return;

    // Remove quick prompts on first user message
    if (role === 'user') {
      document.getElementById('ai-quick-prompts')?.remove();
    }

    const div = document.createElement('div');
    div.className = `ai-message ${role === 'user' ? 'ai-user-msg' : 'ai-bot-msg'}`;

    const bubble = document.createElement('div');
    bubble.className = 'ai-msg-bubble';
    bubble.innerHTML = this._formatMessage(text);

    if (isFallback && role === 'bot') {
      const badge = document.createElement('div');
      badge.className = 'ai-fallback-badge';
      badge.textContent = '📡 Fallback response (no API key)';
      bubble.appendChild(badge);
    }

    div.appendChild(bubble);
    container.appendChild(div);

    // Animate in
    requestAnimationFrame(() => div.classList.add('ai-msg-visible'));

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;

    this.messages.push({ role, text });
  }

  _addTypingIndicator() {
    const container = document.getElementById('ai-messages');
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.className = 'ai-message ai-bot-msg';
    div.id = id;
    div.innerHTML = `
      <div class="ai-msg-bubble ai-typing">
        <span></span><span></span><span></span>
      </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
  }

  _removeTypingIndicator(id) {
    document.getElementById(id)?.remove();
  }

  _clearChat() {
    const container = document.getElementById('ai-messages');
    if (container) container.innerHTML = '';
    this.messages = [];
    this._addMessage('Chat cleared! Ask me anything about Git. 🚀', 'bot');
  }

  _setSendState(enabled) {
    const btn = document.getElementById('ai-send');
    if (btn) btn.disabled = !enabled;
  }

  // ─── Markdown-lite Formatter ──────────────────────────────────────────────────
  _formatMessage(text) {
    return text
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre class="ai-code-block"><code>$1</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Bullets
      .replace(/^[•\-\*] (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      // Newlines
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }
}
