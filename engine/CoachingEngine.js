/**
 * CoachingEngine.js
 * Analyzes repository state (working tree, index, history) to suggest the next logical action.
 * Part of the "Git Sage" Discovery System.
 */

export class CoachingEngine {
  /**
   * Returns a recommendation object based on the current repo state and level objectives.
   * @param {GitRepository} repo 
   * @param {Object} currentLevel
   * @returns {{ command: string, description: string, priority: number } | null}
   */
  static getNextAction(repo, currentLevel) {
    if (!repo) return null;

    // 1. Core Prerequisite: Initialize Repository
    if (!repo.initialized) {
      // If we're on a high level, maybe emphasize that init is still the first step in a new folder
      const desc = currentLevel && parseInt(currentLevel.id) > 1
        ? 'Advanced levels still start with a repository! Run "git init" to get started.'
        : 'Initialize a new Git repository to start tracking changes.';
        
      return {
        command: 'git init',
        description: desc,
        priority: 100
      };
    }

    // 2. Level-Specific Logic: Prioritize required commands for the current level
    if (currentLevel && currentLevel.requiredCommands) {
      const recorded = window.levelManager?.state?.levelCommandSets?.[currentLevel.id] || new Set();
      const pending = currentLevel.requiredCommands.filter(cmd => !recorded.has(cmd));

      if (pending.length > 0) {
        const nextRequired = pending[0];
        
        // Context-aware checking for required commands
        if (nextRequired.startsWith('git commit') && repo.getStatus().staged.length === 0) {
          // Can't commit yet, need to add
          return {
            command: 'git add .',
            description: 'To complete this level, you need to commit, but first you must stage your changes.',
            priority: 95
          };
        }
        
        return {
          command: nextRequired,
          description: `Goal: Use this command to progress through "${currentLevel.title}".`,
          priority: 95
        };
      }
    }

    const status = repo.getStatus();
    const hasUnstaged = status.unstaged.length > 0 || status.untracked.length > 0;
    const hasStaged = status.staged.length > 0;

    // 3. Generic Workflow: Has changes but not staged
    if (hasUnstaged) {
      return {
        command: 'git add .',
        description: 'You have modified files. Stage them so they can be committed.',
        priority: 90
      };
    }

    // 4. Generic Workflow: Has staged changes but not committed
    if (hasStaged) {
      return {
        command: 'git commit -m "Your message"',
        description: 'Your changes are staged! Create a commit to save this version of history.',
        priority: 80
      };
    }
    
    return null;
  }
}
