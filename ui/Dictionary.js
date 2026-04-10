/**
 * Dictionary.js
 * Scans text/HTML for complex Git terminology and wraps them in hoverable tooltips.
 */

const DICTIONARY = {
  'HEAD': 'The pointer to the current commit you are working on. Usually points to a branch tip.',
  'detached HEAD': 'When HEAD points directly to a commit hash instead of a branch. Changes here won\'t belong to any branch.',
  'staging area': 'The "loading dock" where you gather (add) files before committing them.',
  'index': 'Another name for the staging area.',
  'working tree': 'The current state of your actual files on your disk.',
  'repository': 'The database where Git stores all your commits and versions (the .git folder).',
  'commit': 'A permanent snapshot of your files at a point in time.',
  'branch': 'A movable pointer to a commit. Think of it as an independent line of development.',
  'merge': 'Combining the changes from one branch into another.',
  'conflict': 'When Git cannot automatically merge changes because the same lines were modified differently.',
  'fast-forward': 'A merge where the destination branch has no new commits, so Git just moves the pointer forward.',
  'rebase': 'Rewriting history by moving a branch to start from a different base commit.',
  'cherry-pick': 'Copying a single specific commit from somewhere else and applying it to your current branch.',
  'stash': 'A temporary clipboard where you can shelve uncommitted work to quickly switch branches.',
  'origin': 'The default name Git gives to your main remote repository (like on GitHub).',
  'git init': 'Creates a new local repository.',
  'git add': 'Adds changes from the working tree to the staging area.',
  'git commit': 'Saves the staged changes as a new snapshot in the project history.',
  'git status': 'Shows the state of the working tree and the staging area.',
  'git rebase': 'Moves or combines a sequence of commits to a new base commit.'
};

export class Dictionary {
  constructor() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'dict-tooltip hidden';
    document.body.appendChild(this.tooltip);

    // Global listener for dictionary terms
    document.addEventListener('mouseover', (e) => {
      const termEl = e.target.closest('.dict-term, .clickable-cmd');
      if (termEl) {
        let term = termEl.getAttribute('data-term');
        if (!term && termEl.classList.contains('clickable-cmd')) {
          // Try to match the command name (first two words)
          const text = termEl.textContent.toLowerCase();
          if (text.startsWith('git ')) {
            term = text.split(' ').slice(0, 2).join(' '); // e.g. "git add"
          } else {
            term = text;
          }
        }
        if (term) this._showTooltip(termEl, term);
      }
    });

    document.addEventListener('mouseout', (e) => {
      const el = e.target.closest('.dict-term, .clickable-cmd');
      if (el) {
        this._hideTooltip();
      }
    });
  }

  _showTooltip(element, term) {
    const rect = element.getBoundingClientRect();
    const definition = DICTIONARY[term];
    if (!definition) return;

    this.tooltip.innerHTML = `<strong>${term}</strong>: ${definition}`;
    this.tooltip.classList.remove('hidden');

    // Position above the term
    let top = rect.top - this.tooltip.offsetHeight - 8;
    let left = rect.left + (rect.width / 2) - (this.tooltip.offsetWidth / 2);

    // Bounds checking
    if (top < 0) top = rect.bottom + 8;
    if (left < 0) left = 4;
    if (left + this.tooltip.offsetWidth > window.innerWidth) left = window.innerWidth - this.tooltip.offsetWidth - 4;

    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;
  }

  _hideTooltip() {
    this.tooltip.classList.add('hidden');
  }

  /**
   * Replaces known terms in plain text with HTML tooltips.
   * Uses word boundary regex to avoid partial matches.
   */
  static parse(text) {
    if (!text) return '';
    let result = text;
    // Sort keys by length descending so longer terms like "detached HEAD" match before "HEAD"
    const keys = Object.keys(DICTIONARY).sort((a, b) => b.length - a.length);
    
    keys.forEach(key => {
      // Create regex that matches the term if it's not already inside a tag
      // Simple approximation: look for boundaries, ensure we don't accidentally match inside HTML tags
      const safeKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      // Lookahead to ensure we aren't inside an HTML tag, simple boundary check.
      const regex = new RegExp(`\\b(${safeKey})\\b(?![^<]*>)`, 'gi');
      result = result.replace(regex, (match) => {
        // Return original case, but use default key for data-term
        return `<span class="dict-term" data-term="${key}">${match}</span>`;
      });
    });
    return result;
  }
}
