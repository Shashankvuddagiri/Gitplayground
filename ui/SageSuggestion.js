/**
 * SageSuggestion.js
 * A floating UI component that proactively suggests the next logical command.
 */

import { CoachingEngine } from '../engine/CoachingEngine.js';

export class SageSuggestion {
  constructor(repo) {
    this.repo = repo;
    this.container = document.createElement('div');
    this.container.id = 'sage-suggestion';
    this.container.className = 'sage-suggestion hidden';
    document.getElementById('terminal-container').appendChild(this.container);
    
    this.update();
  }

  update() {
    const currentLevel = window.levelManager?.getCurrentLevel();
    const action = CoachingEngine.getNextAction(this.repo, currentLevel);
    
    if (!action) {
      this.container.classList.add('hidden');
      return;
    }

    this.container.innerHTML = `
      <div class="sage-icon">🧙‍♂️</div>
      <div class="sage-content">
        <div class="sage-hint">Next step?</div>
        <code class="sage-cmd clickable-cmd" title="Click to use this command">${action.command}</code>
      </div>
      <div class="sage-desc">${action.description}</div>
    `;

    this.container.classList.remove('hidden');

    // Attach handler for the clickable command in the bubble
    const cmd = this.container.querySelector('.sage-cmd');
    if (cmd) {
      cmd.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('request-command-fill', { 
          detail: { command: action.command, autoRun: false } 
        }));
      });
    }
  }
}
