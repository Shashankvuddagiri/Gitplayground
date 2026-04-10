/**
 * levels.js
 * All 10 level definitions. Each level has:
 * - id, title, description, goal (what user must do)
 * - xp (reward), hints[], requiredCommands
 * - seedFiles (pre-created files in the working tree)
 * - setupFn (optional function called on level start to set up repo state)
 * - validator (function that checks if level is complete)
 * - successMessage
 */

export const LEVELS = [
  {
    id: 1,
    title: '🏁 Initialize a Repository',
    emoji: '🏁',
    description: 'Every Git project begins with a single command: git init. This creates a hidden .git folder that tracks all your changes.',
    goal: 'Initialize a new Git repository in the current directory.',
    xp: 100,
    hints: [
      'Git needs to be initialized before it can track anything.',
      'The command starts with "git" followed by "init".',
      'Try typing: git init',
    ],
    requiredCommands: ['git init'],
    seedFiles: [],
    setupFn: null,
    validator: (repo) => repo.initialized === true,
    successMessage: '🎉 Repository initialized! Git is now watching this folder.',
    conceptNote: 'git init creates a .git directory that stores all version history, branches, and configuration.',
  },

  {
    id: 2,
    title: '📝 Your First Commit',
    emoji: '📝',
    description: 'Git tracks changes through commits. To commit, you first "stage" files with git add, then save them with git commit.',
    goal: 'Create a file, stage it, and make your first commit.',
    xp: 150,
    hints: [
      'First, create a file: touch README.md',
      'Stage it with: git add README.md (or git add . for all files)',
      'Then commit: git commit -m "your message"',
    ],
    requiredCommands: ['git add', 'git commit'],
    seedFiles: [],
    setupFn: (repo) => {
      // Start with initialized repo
      repo.reset();
      repo.init();
    },
    validator: (repo) => repo.commits.length >= 1,
    successMessage: '✅ First commit made! Your changes are now saved in Git history.',
    conceptNote: 'The staging area (index) is like a loading dock — you decide what goes into the next commit.',
  },

  {
    id: 3,
    title: '🔍 Check Your Work',
    emoji: '🔍',
    description: 'Before committing, always check what\'s changed. git status shows your working tree. git log shows commit history.',
    goal: 'Use git status and git log to inspect the repository.',
    xp: 100,
    hints: [
      'Run: git status to see what files are staged, modified, or untracked',
      'Run: git log to see the commit history',
      'Try: git log --oneline for a compact view',
    ],
    requiredCommands: ['git status', 'git log'],
    seedFiles: [],
    setupFn: (repo) => {
      repo.reset();
      repo.init();
      repo.touchFile('README.md', '# Hello World');
      repo.addFile('.');
      repo.commit('Initial commit');
      repo.touchFile('app.js', 'console.log("hello");');
    },
    validator: (repo, state) => state.usedCommands.has('git-status') && state.usedCommands.has('git-log'),
    successMessage: '✅ Great! Inspecting your repo is a core habit of every good developer.',
    conceptNote: 'git status is one of the most used Git commands. Run it often to stay oriented.',
  },

  {
    id: 4,
    title: '↩️ Unstage & Reset',
    emoji: '↩️',
    description: 'Mistakes happen! Git lets you undo actions. git reset HEAD <file> unstages a file. git reset --hard goes back to the last commit.',
    goal: 'Stage a file, then unstage it using git reset.',
    xp: 150,
    hints: [
      'First stage a file: git add <file>',
      'Check what\'s staged: git status',
      'Unstage it: git reset HEAD <file> or git reset',
      'Hard reset to last commit: git reset --hard',
    ],
    requiredCommands: ['git reset'],
    seedFiles: [],
    setupFn: (repo) => {
      repo.reset();
      repo.init();
      repo.touchFile('README.md', '# Hello World');
      repo.addFile('.');
      repo.commit('Initial commit');
      repo.writeFile('README.md', '# Hello World\nOops, wrong change');
    },
    validator: (repo, state) => state.usedCommands.has('git-reset'),
    successMessage: '↩️ Reset successful! You now know how to undo staged changes.',
    conceptNote: 'git reset --soft keeps staged changes, --mixed unstages them, --hard discards them entirely.',
  },

  {
    id: 5,
    title: '🌿 Branch Out',
    emoji: '🌿',
    description: 'Branches allow parallel development. Create a new branch to work on a feature without affecting the main codebase.',
    goal: 'Create a new branch called "feature" and switch to it.',
    xp: 150,
    hints: [
      'Create a branch: git branch feature',
      'Switch to it: git checkout feature',
      'Or do both at once: git checkout -b feature',
    ],
    requiredCommands: ['git branch', 'git checkout'],
    seedFiles: [],
    setupFn: (repo) => {
      repo.reset();
      repo.init();
      repo.touchFile('README.md', '# My Project');
      repo.addFile('.');
      repo.commit('Initial commit');
    },
    validator: (repo) => {
      return repo.branches['feature'] !== undefined && repo.currentBranch === 'feature';
    },
    successMessage: '🌿 Branch created! You\'re now on the "feature" branch.',
    conceptNote: 'In real projects, you\'d create a branch for every new feature or bug fix. Never commit directly to main.',
  },

  {
    id: 6,
    title: '🔀 Parallel Worlds',
    emoji: '🔀',
    description: 'Make commits on different branches and see how they diverge. This simulates real team development.',
    goal: 'Make at least one commit on the "feature" branch and one on "main". Make the branches diverge.',
    xp: 200,
    hints: [
      'On feature branch: create a file, add, commit',
      'Switch back: git checkout main',
      'On main branch: make a different change, add, commit',
      'Now both branches have different commits!',
    ],
    requiredCommands: ['git commit', 'git checkout'],
    seedFiles: [],
    setupFn: (repo) => {
      repo.reset();
      repo.init();
      repo.touchFile('README.md', '# My Project\nShared base');
      repo.addFile('.');
      repo.commit('Initial commit');
      repo.createBranch('feature');
    },
    validator: (repo) => {
      const mainHash = repo.branches['main'];
      const featureHash = repo.branches['feature'];
      return mainHash && featureHash && mainHash !== featureHash;
    },
    successMessage: '🔀 Branches diverged! Main and feature now have different histories.',
    conceptNote: 'This is the power of Git — multiple people can work on different features simultaneously.',
  },

  {
    id: 7,
    title: '🔗 Merge It',
    emoji: '🔗',
    description: 'When a feature is ready, merge it back into main. A fast-forward merge is the simplest case — no conflicts!',
    goal: 'Merge the "feature" branch into "main" without conflicts.',
    xp: 200,
    hints: [
      'First switch to main: git checkout main',
      'Then merge: git merge feature',
      'If it says "Fast-forward", you succeeded!',
    ],
    requiredCommands: ['git merge'],
    seedFiles: [],
    setupFn: (repo) => {
      repo.reset();
      repo.init();
      repo.touchFile('README.md', '# Project');
      repo.addFile('.');
      repo.commit('Initial commit');
      repo.createBranch('feature');
      repo.checkout('feature');
      repo.touchFile('feature.js', 'export const feature = true;');
      repo.addFile('.');
      repo.commit('Add feature');
      repo.checkout('main');
    },
    validator: (repo, state) => state.usedCommands.has('git-merge') && !repo.conflictState,
    successMessage: '🔗 Merged! The feature is now part of main. Great teamwork!',
    conceptNote: 'Fast-forward merges happen when the target branch hasn\'t changed since the feature branched off.',
  },

  {
    id: 8,
    title: '⚔️ Conflict Zone',
    emoji: '⚔️',
    description: 'The most feared Git scenario: merge conflicts! Both branches edited the same file differently. You must manually choose which version to keep.',
    goal: 'Resolve the merge conflict in README.md and complete the merge.',
    xp: 300,
    hints: [
      'Run: git merge feature — it will show a conflict',
      'Open the Conflict Editor panel on the right →',
      'Remove all conflict markers: <<<<<<, =======, >>>>>>>',
      'Keep the content you want, then save',
      'Finally: git add README.md && git commit',
    ],
    requiredCommands: ['git merge'],
    seedFiles: [],
    isConflictLevel: true,
    setupFn: (repo, conflictEngine) => {
      conflictEngine.setupScenario('feature_readme');
    },
    validator: (repo) => {
      const hash = repo.branches[repo.currentBranch];
      if (!hash) return false;
      const commit = repo.getCommitByHash(hash);
      return commit && commit.message.toLowerCase().includes('merge') || (repo.commits.length >= 4 && !repo.conflictState);
    },
    successMessage: '⚔️ Conflict conquered! You\'ve mastered the hardest part of Git.',
    conceptNote: 'Merge conflicts happen when two developers edit the same line. Communication reduces conflicts; Git resolves them.',
  },

  {
    id: 9,
    title: '🌍 Remote Origins',
    emoji: '🌍',
    description: 'Real projects live on remote servers (GitHub, GitLab). Add a remote, push your commits, and pull updates.',
    goal: 'Add a remote called "origin", push your commits, then simulate a pull.',
    xp: 200,
    hints: [
      'Add remote: git remote add origin https://github.com/user/repo.git',
      'Push: git push origin main',
      'Check remotes: git remote -v',
      'Pull: git pull origin main',
    ],
    requiredCommands: ['git remote', 'git push'],
    seedFiles: [],
    setupFn: (repo) => {
      repo.reset();
      repo.init();
      repo.touchFile('README.md', '# My Open Source Project');
      repo.addFile('.');
      repo.commit('Initial commit');
    },
    validator: (repo, state) => {
      return Object.keys(repo.remotes).length > 0 && state.usedCommands.has('git-push');
    },
    successMessage: '🌍 Pushed to remote! Your code is now on a simulated GitHub server.',
    conceptNote: '"origin" is just a conventional name for your main remote. git push uploads your commits, git pull downloads others\'.',
  },

  {
    id: 10,
    title: '🏆 The Full Workflow',
    emoji: '🏆',
    description: 'Combine everything you\'ve learned into a real-world developer workflow: branch, commit, merge, and push.',
    goal: 'Complete a full workflow: create a feature branch, commit changes, merge to main, and push.',
    xp: 500,
    hints: [
      'Step 1: git checkout -b new-feature',
      'Step 2: Create a file, add it, commit it',
      'Step 3: git checkout main',
      'Step 4: git merge new-feature',
      'Step 5: git remote add origin <url>',
      'Step 6: git push origin main',
    ],
    requiredCommands: ['git checkout', 'git commit', 'git merge', 'git push'],
    seedFiles: [],
    setupFn: (repo) => {
      repo.reset();
      repo.init();
      repo.touchFile('README.md', '# Full Workflow Project\n\nThis is your final challenge!');
      repo.addFile('.');
      repo.commit('Initial commit');
      repo.addRemote('origin', 'https://github.com/user/full-workflow.git');
    },
    validator: (repo, state) => {
      return (
        state.usedCommands.has('git-checkout') &&
        state.usedCommands.has('git-commit') &&
        state.usedCommands.has('git-merge') &&
        state.usedCommands.has('git-push') &&
        Object.keys(repo.remotes).length > 0
      );
    },
    successMessage: '🏆 CONGRATULATIONS! You\'ve mastered Git! You\'re ready for real-world development.',
    conceptNote: 'This is the GitHub Flow: branch → commit → pull request → merge → push. Used by millions of developers daily.',
  },
];

export function getLevelById(id) {
  return LEVELS.find(l => l.id === id) || null;
}
