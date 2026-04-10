/**
 * ErrorLibrary.js
 * Comprehensive database of Git errors with explanations and fixes.
 * Each error has: message (what Git shows), explanation (why it happened), fix (how to solve it).
 */

export const ErrorLibrary = {
  NOT_A_REPO: {
    code: 'NOT_A_REPO',
    message: 'fatal: not a git repository (or any of the parent directories): .git',
    explanation: "💡 Git can't find a .git folder here. This directory hasn't been initialized as a Git repository yet.",
    fix: 'Run: git init',
    category: 'initialization',
  },
  ALREADY_INITIALIZED: {
    code: 'ALREADY_INITIALIZED',
    message: 'Reinitialized existing Git repository in .git/',
    explanation: "ℹ️ Git was already initialized here. Running git init again is harmless — it just reinitializes.",
    fix: null,
    category: 'initialization',
  },
  NOTHING_TO_COMMIT: {
    code: 'NOTHING_TO_COMMIT',
    message: 'nothing to commit, working tree clean',
    explanation: "💡 There are no changes staged for commit. You need to modify files and stage them first.",
    fix: 'Modify a file, then run: git add <filename>',
    category: 'commit',
  },
  EMPTY_COMMIT_MSG: {
    code: 'EMPTY_COMMIT_MSG',
    message: 'Aborting commit due to empty commit message.',
    explanation: "💡 Every commit needs a message that describes what changed. The -m flag sets your message.",
    fix: 'Run: git commit -m "your message here"',
    category: 'commit',
  },
  FILE_NOT_FOUND: {
    code: 'FILE_NOT_FOUND',
    message: (filename) => `error: pathspec '${filename}' did not match any files`,
    explanation: "💡 The file you're trying to add doesn't exist in the working directory.",
    fix: 'Check the filename with: ls. Create it with: touch <filename>',
    category: 'staging',
  },
  BRANCH_EXISTS: {
    code: 'BRANCH_EXISTS',
    message: (name) => `fatal: A branch named '${name}' already exists.`,
    explanation: "💡 You can't create two branches with the same name.",
    fix: 'Choose a different name, or switch to existing: git checkout ' + '{{name}}',
    category: 'branch',
  },
  BRANCH_NOT_FOUND: {
    code: 'BRANCH_NOT_FOUND',
    message: (name) => `error: pathspec '${name}' did not match any file(s) known to git`,
    explanation: "💡 The branch you're trying to use doesn't exist.",
    fix: 'List branches with: git branch. Create one with: git branch <name>',
    category: 'branch',
  },
  CANNOT_DELETE_CURRENT_BRANCH: {
    code: 'CANNOT_DELETE_CURRENT_BRANCH',
    message: (name) => `error: Cannot delete branch '${name}' checked out at '.'`,
    explanation: "💡 You can't delete the branch you're currently on. Switch to another branch first.",
    fix: 'Switch first: git checkout main, then: git branch -d ' + '{{name}}',
    category: 'branch',
  },
  REF_NOT_FOUND: {
    code: 'REF_NOT_FOUND',
    message: (ref) => `error: pathspec '${ref}' did not match any file(s) known to git`,
    explanation: "💡 The branch or commit hash you specified doesn't exist.",
    fix: 'Check available branches: git branch. Check commits: git log --oneline',
    category: 'checkout',
  },
  DETACHED_HEAD: {
    code: 'DETACHED_HEAD',
    message: 'HEAD detached at {{hash}}',
    explanation: "⚠️ You've checked out a specific commit, not a branch. Any new commits won't belong to a branch.",
    fix: 'Return to a branch: git checkout main',
    category: 'checkout',
  },
  MERGE_CONFLICT: {
    code: 'MERGE_CONFLICT',
    message: 'CONFLICT (content): Merge conflict in {{file}}\nAutomatic merge failed; fix conflicts and then commit the result.',
    explanation: "⚔️ Both branches modified the same file in different ways. Git doesn't know which version to keep — you must decide.",
    fix: 'Open the conflicted file, resolve the markers (<<<<<<, =======, >>>>>>>), then: git add <file> && git commit',
    category: 'merge',
  },
  MERGE_SELF: {
    code: 'MERGE_SELF',
    message: 'Already up to date.',
    explanation: "💡 You're trying to merge a branch into itself. Checkout the target branch first.",
    fix: 'Switch to target: git checkout main, then: git merge <branch>',
    category: 'merge',
  },
  MERGE_ERROR: {
    code: 'MERGE_ERROR',
    message: 'fatal: refusing to merge unrelated histories',
    explanation: "💡 The branches have no common ancestor. This usually happens when merging completely separate repositories.",
    fix: 'Use: git merge --allow-unrelated-histories <branch>',
    category: 'merge',
  },
  REMOTE_EXISTS: {
    code: 'REMOTE_EXISTS',
    message: (name) => `error: remote ${name} already exists.`,
    explanation: "💡 A remote with this name already exists. Each remote must have a unique name.",
    fix: 'View remotes: git remote -v. Remove old: git remote remove ' + '{{name}}',
    category: 'remote',
  },
  REMOTE_NOT_FOUND: {
    code: 'REMOTE_NOT_FOUND',
    message: (remote) => `error: '${remote}' does not appear to be a git repository\nfatal: Could not read from remote repository.`,
    explanation: "💡 The remote doesn't exist yet. You need to configure where to push/pull from.",
    fix: 'Add a remote: git remote add origin <url>',
    category: 'remote',
  },
  NOTHING_TO_PUSH: {
    code: 'NOTHING_TO_PUSH',
    message: 'Everything up-to-date',
    explanation: "💡 The remote already has all your commits. There's nothing new to push.",
    fix: 'Make a new commit first, then push.',
    category: 'remote',
  },
  NOTHING_TO_STASH: {
    code: 'NOTHING_TO_STASH',
    message: 'No local changes to save',
    explanation: "💡 There are no modified or new files to stash. Stash saves uncommitted work.",
    fix: 'Modify a file first, then run: git stash',
    category: 'stash',
  },
  STASH_EMPTY: {
    code: 'STASH_EMPTY',
    message: 'error: No stash entries found.',
    explanation: "💡 The stash is empty. There's nothing to pop.",
    fix: 'First stash something: git stash, then: git stash pop',
    category: 'stash',
  },
  NO_COMMITS: {
    code: 'NO_COMMITS',
    message: 'fatal: your current branch has no commits yet',
    explanation: "💡 This branch doesn't have any commits. Make your first commit before resetting.",
    fix: 'Make a commit: git add . && git commit -m "initial commit"',
    category: 'reset',
  },
  NO_PARENT_COMMIT: {
    code: 'NO_PARENT_COMMIT',
    message: 'fatal: ambiguous argument \'HEAD~1\': unknown revision',
    explanation: "💡 There's only one commit in history. You can't go back further.",
    fix: null,
    category: 'reset',
  },
  TAG_EXISTS: {
    code: 'TAG_EXISTS',
    message: (name) => `fatal: tag '${name}' already exists`,
    explanation: "💡 A tag with this name already exists. Tags are permanent labels for specific commits.",
    fix: 'Delete the tag first: git tag -d ' + '{{name}}',
    category: 'tag',
  },
  MISSING_COMMIT_FLAG: {
    code: 'MISSING_COMMIT_FLAG',
    message: 'error: switch \'m\' requires a value',
    explanation: "💡 The -m flag needs a message in quotes right after it.",
    fix: 'Run: git commit -m "your message"',
    category: 'commit',
  },
  GIT_NO_SUB: {
    code: 'GIT_NO_SUB',
    message: 'usage: git [--version] [--help] [-C <path>] [-c <name>=<value>]\n           [--exec-path[=<path>]] [--html-path] [--man-path] [--info-path]\n           [-p | --paginate | -P | --no-pager] [--no-replace-objects] [--bare]\n           [--git-dir=<path>] [--work-tree=<path>] [--namespace=<name>]\n           [--super-prefix=<path>] [--recover]\n           <command> [<args>]',
    explanation: "💡 You typed 'git' without a subcommand. Git needs to know what to do.",
    fix: 'Try: git init, git status, git add, git commit, git log',
    category: 'usage',
  },
  UNKNOWN_COMMAND: {
    code: 'UNKNOWN_COMMAND',
    message: (cmd) => `git: '${cmd}' is not a git command. See 'git --help'.`,
    explanation: "💡 This isn't a valid Git command. Check your spelling.",
    fix: 'Run: git help to see all available commands',
    category: 'usage',
  },
  UNKNOWN_SHELL_CMD: {
    code: 'UNKNOWN_SHELL_CMD',
    message: (cmd) => `command not found: ${cmd}`,
    explanation: "💡 This command isn't recognized in the Git Playground shell.",
    fix: 'Available commands: ls, touch, echo, cat, mkdir, pwd, clear, help, git',
    category: 'shell',
  },
  NO_CONFLICT: {
    code: 'NO_CONFLICT',
    message: 'error: no conflict to resolve',
    explanation: "💡 There's no active merge conflict. This command only applies during a conflict.",
    fix: null,
    category: 'merge',
  },
  USER_NOT_CONFIGURED: {
    code: 'USER_NOT_CONFIGURED',
    message: '*** Please tell me who you are.\n\nRun\n\n  git config --global user.email "you@example.com"\n  git config --global user.name "Your Name"',
    explanation: "💡 Git needs to know who is making commits. Configure your identity first.",
    fix: 'git config user.name "Your Name" && git config user.email "you@example.com"',
    category: 'config',
  },

  /**
   * Get a formatted error object with dynamic values substituted.
   */
  get(code, params = {}) {
    const err = ErrorLibrary[code];
    if (!err) return {
      code: 'UNKNOWN',
      message: `Unknown error: ${code}`,
      explanation: '',
      fix: null,
    };

    let message = typeof err.message === 'function'
      ? err.message(params.filename || params.name || params.ref || params.remote || params.cmd || '')
      : err.message;

    // Replace template placeholders
    for (const [key, val] of Object.entries(params)) {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), val);
    }

    return { ...err, message };
  },
};
