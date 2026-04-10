/**
 * WelcomeModal.js
 * First-time user onboarding modal with interactive guide
 */

export class WelcomeModal {
  constructor() {
    this.isFirstTime = !localStorage.getItem('gp_visited');
    this.modal = null;
    this.currentStep = 0;
    this.steps = [
      {
        title: '🆘 Help Guide & GitBot',
        description: 'This guide is available anytime via the top-right Help button or by pressing ? on your keyboard. GitBot is your built-in AI assistant, ready to help with Git commands, explanations, and suggestions.',
        image: '🤖',
      },
      {
        title: '⌨️ How to Use the Terminal',
        description: 'Type commands into the terminal input and press Enter. Use commands like git init, git status, git add ., git commit -m "message", git log, and git branch to interact with the repository.',
        image: '💻',
      },
      {
        title: '💡 Terminal Command Examples',
        description: 'Start with git init to initialize a repository, git status to inspect your current state, git add . to stage files, git commit -m "message" to save a commit, and git log to see commit history.',
        image: '📘',
      },
      {
        title: '💾 Sync Token Backup',
        description: 'Click the Synced badge to open your unique progress token. Copy it to save your work and paste it on another device to resume the same progress exactly.',
        image: '🔐',
      },
      {
        title: '📌 Keep Your Token Safe',
        description: 'Your sync token is your progress backup. Save it securely, import it anytime from the sync panel, and use it to move progress between browsers or devices.',
        image: '🧾',
      },
    ];
  }

  show(forceShow = false) {
    if (!forceShow && !this.isFirstTime) return; // Only show on first visit unless forced

    this.currentStep = 0; // Reset to first step
    this.createModal();
    this.renderStep();
    document.body.appendChild(this.modal);
    if (this.isFirstTime) {
      localStorage.setItem('gp_visited', 'true');
    }
  }

  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'welcome-modal-overlay';
    this.modal.innerHTML = `
      <div class="welcome-modal">
        <button class="welcome-close-btn" aria-label="Close welcome">&times;</button>
        <div class="welcome-step-indicator">
          <span id="step-number">1</span> / <span id="total-steps">${this.steps.length}</span>
        </div>
        <div class="welcome-content">
          <div class="welcome-image" id="welcome-image">🎮</div>
          <h2 id="welcome-title">Welcome to Git Playground!</h2>
          <p id="welcome-description">Learn Git and GitHub by actually using it in a safe, interactive environment.</p>
        </div>
        <div class="welcome-nav">
          <button id="welcome-skip" class="welcome-btn-secondary">Skip Tutorial</button>
          <button id="welcome-next" class="welcome-btn-primary">Next →</button>
        </div>
        <div class="welcome-footer" style="border-top: 1px solid var(--border-color); margin-top: 1rem; padding-top: 0.75rem; font-size: 0.85rem; color: var(--text-secondary); text-align: center;">
          💡 Tip: Press <kbd style="background: var(--bg-secondary); padding: 0.2rem 0.5rem; border-radius: 3px; border: 1px solid var(--border-color);">?</kbd> anytime to reopen this guide!
        </div>
      </div>
    `;

    this.modal.querySelector('.welcome-close-btn').addEventListener('click', () => this.close());
    this.modal.querySelector('#welcome-skip').addEventListener('click', () => this.close());
    this.modal.querySelector('#welcome-next').addEventListener('click', () => this.nextStep());
  }

  renderStep() {
    const step = this.steps[this.currentStep];
    this.modal.querySelector('#step-number').textContent = this.currentStep + 1;
    this.modal.querySelector('#welcome-image').textContent = step.image;
    this.modal.querySelector('#welcome-title').textContent = step.title;
    this.modal.querySelector('#welcome-description').textContent = step.description;

    const nextBtn = this.modal.querySelector('#welcome-next');
    if (this.currentStep === this.steps.length - 1) {
      nextBtn.textContent = 'Start Learning! →';
    } else {
      nextBtn.textContent = 'Next →';
    }
  }

  nextStep() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.renderStep();
    } else {
      this.close();
    }
  }

  close() {
    if (this.modal?.parentNode) {
      this.modal.remove();
    }
  }
}
