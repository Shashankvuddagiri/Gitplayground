/**
 * CommandExecutor.js
 * Maps parsed commands → GitRepository actions → formatted terminal output.
 * Returns arrays of output line objects: { text, type } where type is
 * 'normal' | 'error' | 'success' | 'warning' | 'info' | 'diff-add' | 'diff-remove'
 */

import { ErrorLibrary } from './ErrorLibrary.js';
import { VimModal } from '../ui/VimModal.js';

export class CommandExecutor {
  constructor(repo) {
    this.repo = repo;
    this.commandHistory = [];
    this.vimModal = new VimModal();
  }

  /**
   * Execute a parsed command and return output lines.
   * @param {Object} cmd - Parsed command from CommandParser
   * @returns {Promise<{ lines: Array, triggerConflict: bool, levelEvent: string|null }>}
   */
  async execute(cmd) {
    this.commandHistory.push(cmd.raw);
    const out = { lines: [], triggerConflict: false, levelEvent: null };

    // Take snapshot before mutators for visual undo
    const mutators = ['init', 'add', 'commit', 'branch', 'checkout', 'switch', 'merge', 'stash', 'pull', 'reset', 'tag', 'rebase', 'cherry-pick', 'touch', 'echo'];
    if (mutators.includes(cmd.sub || cmd.base)) {
      this.repo.takeSnapshot();
    }

    try {
      if (cmd.base === 'git') {
        return await this._executeGit(cmd, out);
      } else {
        return this._executeShell(cmd, out);
      }
    } catch (e) {
      out.lines.push({ text: `fatal: unexpected error — ${e.message}`, type: 'error' });
      return out;
    }
  }

  // ─── Git Commands ─────────────────────────────────────────────────────────────
  async _executeGit(cmd, out) {
    switch (cmd.sub) {
      case 'init': return this._gitInit(cmd, out);
      case 'add': return this._gitAdd(cmd, out);
      case 'commit': return this._gitCommit(cmd, out);
      case 'status': return this._gitStatus(cmd, out);
      case 'log': return this._gitLog(cmd, out);
      case 'diff': return this._gitDiff(cmd, out);
      case 'branch': return this._gitBranch(cmd, out);
      case 'checkout': return this._gitCheckout(cmd, out);
      case 'switch': return this._gitSwitch(cmd, out);
      case 'merge': return this._gitMerge(cmd, out);
      case 'stash': return this._gitStash(cmd, out);
      case 'remote': return this._gitRemote(cmd, out);
      case 'push': return this._gitPush(cmd, out);
      case 'pull': return this._gitPull(cmd, out);
      case 'reset': return this._gitReset(cmd, out);
      case 'tag': return this._gitTag(cmd, out);
      case 'rebase': return this._gitRebase(cmd, out);
      case 'cherry-pick': return this._gitCherryPick(cmd, out);
      case 'config': return this._gitConfig(cmd, out);
      case 'show': return this._gitShow(cmd, out);
      case 'help': return this._gitHelp(cmd, out);
      case '--version': {
        out.lines.push({ text: 'git version 2.42.0 (GitPlayground Simulation)', type: 'info' });
        return out;
      }
      case null:
      case undefined: {
        const err = ErrorLibrary.get('GIT_NO_SUB');
        out.lines.push({ text: err.message, type: 'normal' });
        return out;
      }
      default: {
        const err = ErrorLibrary.get('UNKNOWN_COMMAND', { cmd: cmd.sub });
        out.lines.push({ text: err.message, type: 'error' });
        out.lines.push({ text: `\n💡 ${err.explanation}`, type: 'info' });
        if (err.fix) out.lines.push({ text: `🔧 Fix: ${err.fix}`, type: 'warning' });
        return out;
      }
    }
  }

  _gitInit(cmd, out) {
    const result = this.repo.init();
    if (result.alreadyInit) {
      out.lines.push({ text: `Reinitialized existing Git repository in .git/`, type: 'success' });
    } else {
      out.lines.push({ text: `Initialized empty Git repository in .git/`, type: 'success' });
      out.lines.push({ text: ``, type: 'normal' });
      out.lines.push({ text: `hint: Using 'main' as the name for the initial branch.`, type: 'info' });
    }
    out.levelEvent = 'git-init';
    return out;
  }

  _gitAdd(cmd, out) {
    const filename = cmd.args[0] || (cmd.flags['.'] ? '.' : null) || (cmd.flags['A'] ? '.' : null);

    if (!filename) {
      out.lines.push({ text: `Nothing specified, nothing added.`, type: 'warning' });
      out.lines.push({ text: `hint: Maybe you wanted to say 'git add .'?`, type: 'info' });
      return out;
    }

    const result = this.repo.addFile(filename);

    if (!result.success) {
      const err = ErrorLibrary.get(result.error, { filename: result.filename });
      out.lines.push({ text: err.message, type: 'error' });
      out.lines.push({ text: `\n💡 ${err.explanation}`, type: 'info' });
      if (err.fix) out.lines.push({ text: `🔧 Fix: ${err.fix}`, type: 'warning' });
      return out;
    }

    if (result.nothingAdded) {
      out.lines.push({ text: ``, type: 'normal' });
      return out;
    }

    // Git add is silent on success (like real git)
    out.levelEvent = 'git-add';
    return out;
  }

  async _gitCommit(cmd, out) {
    let message = cmd.flags['m'];
    const amend = cmd.flags['amend'];

    if (!message && !amend) {
      const edited = await this.vimModal.open("\n# Enter commit message...", 'COMMIT_EDITMSG');
      if (!edited || edited.trim() === '') {
        out.lines.push({ text: "error: aborting commit due to empty message.", type: "error" });
        return out;
      }
      message = edited.split('\n').filter(l => !l.startsWith('#')).join('\n').trim();
    }

    if (!message) message = 'amend: update last commit';

    const result = this.repo.commit(message);

    if (!result.success) {
      const err = ErrorLibrary.get(result.error);
      out.lines.push({ text: err.message, type: 'warning' });
      out.lines.push({ text: `\n💡 ${err.explanation}`, type: 'info' });
      if (err.fix) out.lines.push({ text: `🔧 Fix: ${err.fix}`, type: 'warning' });
      return out;
    }

    out.lines.push({ text: `[${result.branch} ${result.shortHash}] ${result.message}`, type: 'success' });
    const staged = Object.keys(this.repo.stagingArea).length;
    out.lines.push({ text: ` ${Object.keys(result ? {} : {}).length || 1} file(s) changed`, type: 'normal' });
    out.levelEvent = 'git-commit';
    return out;
  }

  _gitStatus(cmd, out) {
    const result = this.repo.status();

    if (!result.success) {
      const err = ErrorLibrary.get(result.error);
      out.lines.push({ text: err.message, type: 'error' });
      out.lines.push({ text: `\n💡 ${err.explanation}`, type: 'info' });
      if (err.fix) out.lines.push({ text: `🔧 Fix: ${err.fix}`, type: 'warning' });
      return out;
    }

    if (result.hasConflict) {
      out.lines.push({ text: `On branch ${result.branch || 'main'}`, type: 'normal' });
      out.lines.push({ text: `You have unmerged paths.`, type: 'error' });
      out.lines.push({ text: `  (fix conflicts and run "git commit")`, type: 'info' });
      out.lines.push({ text: `  (use "git merge --abort" to abort the merge)`, type: 'info' });
      out.lines.push({ text: ``, type: 'normal' });
      out.lines.push({ text: `Unmerged paths:`, type: 'error' });
      const conflicts = this.repo.conflictState?.conflicts || [];
      conflicts.forEach(f => {
        out.lines.push({ text: `\tboth modified:   ${f}`, type: 'error' });
      });
      return out;
    }

    out.lines.push({ text: `On branch ${result.branch || 'main'}`, type: 'normal' });

    if (result.clean) {
      out.lines.push({ text: `nothing to commit, working tree clean`, type: 'success' });
      out.levelEvent = 'git-status';
      return out;
    }

    if (result.staged.length > 0) {
      out.lines.push({ text: ``, type: 'normal' });
      out.lines.push({ text: `Changes to be committed:`, type: 'success' });
      out.lines.push({ text: `  (use "git restore --staged <file>..." to unstage)`, type: 'info' });
      result.staged.forEach(f => {
        out.lines.push({ text: `\t${f.status}:   ${f.name}`, type: 'success' });
      });
    }

    if (result.unstaged.length > 0) {
      out.lines.push({ text: ``, type: 'normal' });
      out.lines.push({ text: `Changes not staged for commit:`, type: 'warning' });
      out.lines.push({ text: `  (use "git add <file>..." to update what will be committed)`, type: 'info' });
      result.unstaged.forEach(f => {
        out.lines.push({ text: `\t${f.status}:   ${f.name}`, type: 'warning' });
      });
    }

    if (result.untracked.length > 0) {
      out.lines.push({ text: ``, type: 'normal' });
      out.lines.push({ text: `Untracked files:`, type: 'warning' });
      out.lines.push({ text: `  (use "git add <file>..." to include in what will be committed)`, type: 'info' });
      result.untracked.forEach(f => {
        out.lines.push({ text: `\t${f.name}`, type: 'warning' });
      });
    }

    out.levelEvent = 'git-status';
    return out;
  }

  _gitLog(cmd, out) {
    const result = this.repo.log();

    if (!result.success) {
      const err = ErrorLibrary.get(result.error);
      out.lines.push({ text: err.message, type: 'error' });
      return out;
    }

    if (result.empty) {
      out.lines.push({ text: `fatal: your current branch 'main' does not have any commits yet`, type: 'error' });
      return out;
    }

    const oneline = cmd.flags['oneline'] || cmd.flags['abbrev-commit'];
    const graph = cmd.flags['graph'];

    result.commits.forEach((commit, idx) => {
      if (oneline) {
        const isCurrent = idx === 0;
        const branchLabel = isCurrent ? ` (HEAD -> ${this.repo.currentBranch})` : '';
        out.lines.push({
          text: `${commit.shortHash}${branchLabel} ${commit.message}`,
          type: isCurrent ? 'success' : 'normal',
        });
      } else {
        const isFirst = idx === 0;
        out.lines.push({ text: `commit ${commit.hash}${isFirst ? ` (HEAD -> ${this.repo.currentBranch})` : ''}`, type: 'warning' });
        out.lines.push({ text: `Author: ${commit.author} <${commit.email}>`, type: 'normal' });
        out.lines.push({ text: `Date:   ${commit.timestamp.toDateString()} ${commit.timestamp.toTimeString().split(' ')[0]}`, type: 'normal' });
        out.lines.push({ text: ``, type: 'normal' });
        out.lines.push({ text: `    ${commit.message}`, type: 'normal' });
        if (idx < result.commits.length - 1) {
          out.lines.push({ text: ``, type: 'normal' });
        }
      }
    });

    out.levelEvent = 'git-log';
    return out;
  }

  _gitDiff(cmd, out) {
    const filename = cmd.args[0] || null;
    const result = this.repo.diff(filename);

    if (!result.success) {
      const err = ErrorLibrary.get(result.error);
      out.lines.push({ text: err.message, type: 'error' });
      return out;
    }

    const diffs = result.diffs;
    if (Object.keys(diffs).length === 0) {
      // No output, just like real git
      return out;
    }

    for (const [file, lines] of Object.entries(diffs)) {
      out.lines.push({ text: `diff --git a/${file} b/${file}`, type: 'info' });
      out.lines.push({ text: `--- a/${file}`, type: 'diff-remove' });
      out.lines.push({ text: `+++ b/${file}`, type: 'diff-add' });
      lines.forEach(line => {
        if (line.type === 'add') out.lines.push({ text: `+${line.line}`, type: 'diff-add' });
        else if (line.type === 'remove') out.lines.push({ text: `-${line.line}`, type: 'diff-remove' });
        else out.lines.push({ text: ` ${line.line}`, type: 'normal' });
      });
    }

    out.levelEvent = 'git-diff';
    return out;
  }

  _gitBranch(cmd, out) {
    const newName = cmd.args[0];
    const deleteFlag = cmd.flags['d'] || cmd.flags['D'];
    const listAll = cmd.flags['a'] || cmd.flags['all'];

    if (deleteFlag && newName) {
      const result = this.repo.deleteBranch(newName);
      if (!result.success) {
        const err = ErrorLibrary.get(result.error, { name: result.name });
        out.lines.push({ text: err.message, type: 'error' });
        if (err.explanation) out.lines.push({ text: `\n💡 ${err.explanation}`, type: 'info' });
        return out;
      }
      out.lines.push({ text: `Deleted branch ${newName}.`, type: 'success' });
      return out;
    }

    if (newName) {
      const result = this.repo.createBranch(newName);
      if (!result.success) {
        const err = ErrorLibrary.get(result.error, { name: result.name });
        out.lines.push({ text: err.message, type: 'error' });
        if (err.explanation) out.lines.push({ text: `\n💡 ${err.explanation}`, type: 'info' });
        return out;
      }
      // Silent on success like real git
      out.levelEvent = 'git-branch';
      return out;
    }

    // List branches
    for (const [name] of Object.entries(this.repo.branches)) {
      const isCurrent = name === this.repo.currentBranch;
      out.lines.push({
        text: isCurrent ? `* ${name}` : `  ${name}`,
        type: isCurrent ? 'success' : 'normal',
      });
    }

    if (Object.keys(this.repo.branches).length === 0) {
      out.lines.push({ text: `(no branches yet — make a commit first)`, type: 'info' });
    }

    out.levelEvent = 'git-branch';
    return out;
  }

  _gitCheckout(cmd, out) {
    const createNew = !!(cmd.flags['b'] || cmd.flags['B']);
    const ref = cmd.flags['b'] || cmd.flags['B'] || cmd.args[0];

    if (!ref) {
      out.lines.push({ text: `error: 'git checkout' requires a branch or commit`, type: 'error' });
      return out;
    }

    const result = this.repo.checkout(ref, createNew);

    if (!result.success) {
      const err = ErrorLibrary.get(result.error, { ref: result.ref || ref });
      out.lines.push({ text: err.message, type: 'error' });
      out.lines.push({ text: `\n💡 ${err.explanation}`, type: 'info' });
      if (err.fix) out.lines.push({ text: `🔧 Fix: ${err.fix}`, type: 'warning' });
      return out;
    }

    if (result.type === 'detached') {
      out.lines.push({ text: `Note: switching to '${result.shortHash}'.`, type: 'normal' });
      out.lines.push({ text: ``, type: 'normal' });
      out.lines.push({ text: `You are in 'detached HEAD' state. You can look around, make experimental`, type: 'warning' });
      out.lines.push({ text: `changes and commit them, and you can discard any commits you make in this`, type: 'warning' });
      out.lines.push({ text: `state without impacting any branches by switching back to a branch.`, type: 'warning' });
    } else if (result.created) {
      out.lines.push({ text: `Switched to a new branch '${ref}'`, type: 'success' });
    } else {
      out.lines.push({ text: `Switched to branch '${ref}'`, type: 'success' });
    }

    out.levelEvent = 'git-checkout';
    return out;
  }

  _gitSwitch(cmd, out) {
    // git switch is modern alias for checkout
    const createNew = !!(cmd.flags['c'] || cmd.flags['C']);
    const ref = cmd.flags['c'] || cmd.flags['C'] || cmd.args[0];
    return this._gitCheckout({ ...cmd, flags: { ...cmd.flags, b: createNew ? ref : undefined }, args: [ref] }, out);
  }

  _gitMerge(cmd, out) {
    const branchName = cmd.args[0];
    const abort = cmd.flags['abort'];

    if (abort) {
      this.repo.conflictState = null;
      out.lines.push({ text: `Merge aborted.`, type: 'warning' });
      return out;
    }

    if (!branchName) {
      out.lines.push({ text: `error: No branch specified to merge`, type: 'error' });
      return out;
    }

    const result = this.repo.merge(branchName);

    if (result.alreadyUpToDate) {
      out.lines.push({ text: `Already up to date.`, type: 'success' });
      return out;
    }

    if (!result.success) {
      if (result.error === 'MERGE_CONFLICT') {
        out.lines.push({ text: `Auto-merging ${result.conflicts.join(', ')}`, type: 'warning' });
        result.conflicts.forEach(f => {
          out.lines.push({ text: `CONFLICT (content): Merge conflict in ${f}`, type: 'error' });
        });
        out.lines.push({ text: `Automatic merge failed; fix conflicts and then commit the result.`, type: 'error' });
        out.lines.push({ text: ``, type: 'normal' });
        out.lines.push({ text: `⚔️  Merge conflict detected! Open the Conflict Editor on the right panel.`, type: 'warning' });
        out.triggerConflict = true;
        out.conflictData = {
          ours: result.ours,
          theirs: result.theirs,
          conflicts: result.conflicts,
          theirBranch: branchName,
        };
        out.levelEvent = 'merge-conflict';
        return out;
      }

      const err = ErrorLibrary.get(result.error, { name: branchName });
      out.lines.push({ text: err.message, type: 'error' });
      if (err.explanation) out.lines.push({ text: `\n💡 ${err.explanation}`, type: 'info' });
      if (err.fix) out.lines.push({ text: `🔧 Fix: ${err.fix}`, type: 'warning' });
      return out;
    }

    if (result.fastForward) {
      out.lines.push({ text: `Updating ${result.from?.slice(0, 7) || '0000000'}..${result.to?.slice(0, 7)}`, type: 'normal' });
      out.lines.push({ text: `Fast-forward`, type: 'success' });
    } else {
      out.lines.push({ text: `Merge made by the 'ort' strategy.`, type: 'success' });
    }

    out.levelEvent = 'git-merge';
    return out;
  }

  _gitStash(cmd, out) {
    const sub = cmd.args[0] || 'push';

    if (sub === 'pop') {
      const result = this.repo.stashPop();
      if (!result.success) {
        const err = ErrorLibrary.get(result.error);
        out.lines.push({ text: err.message, type: 'error' });
        if (err.explanation) out.lines.push({ text: `\n💡 ${err.explanation}`, type: 'info' });
        return out;
      }
      out.lines.push({ text: `On branch ${this.repo.currentBranch}`, type: 'normal' });
      out.lines.push({ text: `Changes not staged for commit:`, type: 'warning' });
      out.lines.push({ text: `Dropped refs/stash@{0} (${result.message})`, type: 'success' });
      out.levelEvent = 'git-stash-pop';
      return out;
    }

    if (sub === 'list') {
      if (this.repo.stash.length === 0) {
        // Silent when empty
        return out;
      }
      this.repo.stash.forEach((entry, i) => {
        out.lines.push({ text: `stash@{${i}}: ${entry.message}`, type: 'normal' });
      });
      return out;
    }

    // Default: push
    const result = this.repo.stashPush(cmd.flags['m']);
    if (!result.success) {
      const err = ErrorLibrary.get(result.error);
      out.lines.push({ text: err.message, type: 'warning' });
      if (err.explanation) out.lines.push({ text: `\n💡 ${err.explanation}`, type: 'info' });
      return out;
    }
    out.lines.push({ text: `Saved working directory and index state ${result.message}`, type: 'success' });
    out.levelEvent = 'git-stash';
    return out;
  }

  _gitRemote(cmd, out) {
    const sub = cmd.args[0];

    if (sub === 'add') {
      const name = cmd.args[1];
      const url = cmd.args[2];
      if (!name || !url) {
        out.lines.push({ text: `usage: git remote add <name> <url>`, type: 'error' });
        return out;
      }
      const result = this.repo.addRemote(name, url);
      if (!result.success) {
        const err = ErrorLibrary.get(result.error, { name: result.name });
        out.lines.push({ text: err.message, type: 'error' });
        return out;
      }
      // Silent on success
      out.levelEvent = 'git-remote-add';
      return out;
    }

    if (sub === 'remove' || sub === 'rm') {
      const name = cmd.args[1];
      if (this.repo.remotes[name]) {
        delete this.repo.remotes[name];
        out.lines.push({ text: ``, type: 'normal' });
      } else {
        out.lines.push({ text: `error: No such remote: ${name}`, type: 'error' });
      }
      return out;
    }

    // List remotes
    const flag = cmd.flags['v'] || cmd.flags['verbose'];
    for (const [name, remote] of Object.entries(this.repo.remotes)) {
      if (flag) {
        out.lines.push({ text: `${name}\t${remote.url} (fetch)`, type: 'normal' });
        out.lines.push({ text: `${name}\t${remote.url} (push)`, type: 'normal' });
      } else {
        out.lines.push({ text: name, type: 'normal' });
      }
    }

    return out;
  }

  _gitPush(cmd, out) {
    const remote = cmd.args[0] || 'origin';
    const branch = cmd.args[1] || null;
    const result = this.repo.push(remote, branch);

    if (!result.success) {
      const err = ErrorLibrary.get(result.error, { remote });
      out.lines.push({ text: err.message, type: 'error' });
      if (err.explanation) out.lines.push({ text: `\n💡 ${err.explanation}`, type: 'info' });
      if (err.fix) out.lines.push({ text: `🔧 Fix: ${err.fix}`, type: 'warning' });
      return out;
    }

    if (result.alreadyUpToDate) {
      out.lines.push({ text: `Everything up-to-date`, type: 'success' });
      return out;
    }

    out.lines.push({ text: `Enumerating objects: 3, done.`, type: 'normal' });
    out.lines.push({ text: `Counting objects: 100% (3/3), done.`, type: 'normal' });
    out.lines.push({ text: `Writing objects: 100% (3/3), done.`, type: 'normal' });
    out.lines.push({ text: `remote:`, type: 'normal' });
    out.lines.push({ text: `To ${this.repo.remotes[remote]?.url || remote}`, type: 'normal' });
    out.lines.push({ text: `   ${result.hash}  ${result.branch} -> ${result.branch}`, type: 'success' });
    out.levelEvent = 'git-push';
    return out;
  }

  _gitPull(cmd, out) {
    const remote = cmd.args[0] || 'origin';
    const branch = cmd.args[1] || null;
    const result = this.repo.pull(remote, branch);

    if (!result.success) {
      const err = ErrorLibrary.get(result.error, { remote });
      out.lines.push({ text: err.message, type: 'error' });
      if (err.explanation) out.lines.push({ text: `\n💡 ${err.explanation}`, type: 'info' });
      if (err.fix) out.lines.push({ text: `🔧 Fix: ${err.fix}`, type: 'warning' });
      return out;
    }

    if (result.alreadyUpToDate) {
      out.lines.push({ text: `Already up to date.`, type: 'success' });
      return out;
    }

    out.lines.push({ text: `remote: Counting objects: 3, done.`, type: 'normal' });
    out.lines.push({ text: `Updating ${result.from}..${result.to}`, type: 'normal' });
    out.lines.push({ text: `Fast-forward`, type: 'success' });
    out.levelEvent = 'git-pull';
    return out;
  }

  _gitReset(cmd, out) {
    const hardFlag = cmd.flags['hard'];
    const softFlag = cmd.flags['soft'];
    const mode = hardFlag ? 'hard' : (softFlag ? 'soft' : 'mixed');
    const ref = cmd.args[0] || null;

    const result = this.repo.resetHead(mode, ref);

    if (!result.success) {
      const err = ErrorLibrary.get(result.error);
      out.lines.push({ text: err.message, type: 'error' });
      if (err.explanation) out.lines.push({ text: `\n💡 ${err.explanation}`, type: 'info' });
      if (err.fix) out.lines.push({ text: `🔧 Fix: ${err.fix}`, type: 'warning' });
      return out;
    }

    if (mode === 'hard') {
      out.lines.push({ text: `HEAD is now at ${result.hash}`, type: 'warning' });
    } else {
      out.lines.push({ text: `Unstaged changes after reset:`, type: 'warning' });
    }

    out.levelEvent = 'git-reset';
    return out;
  }

  async _gitRebase(cmd, out) {
    const branch = cmd.args[0];
    const isInteractive = cmd.flags['i'] || cmd.flags['interactive'];

    if (!branch) {
      out.lines.push({ text: `usage: git rebase <branch>`, type: 'error' });
      out.lines.push({ text: ``, type: 'normal' });
      out.lines.push({ text: `💡 Hint: Try 'git rebase -i HEAD~3' to rewrite history, or specify a branch name.`, type: 'info' });
      return out;
    }

    if (isInteractive) {
      const todoRes = this.repo.getRebaseTodo(branch);
      if (!todoRes.success) {
        out.lines.push({ text: `fatal: ${todoRes.error}`, type: 'error' });
        return out;
      }

      const editedTodo = await this.vimModal.open(todoRes.todo);
      
      if (editedTodo === null) {
        out.lines.push({ text: `rebase: aborted by user`, type: 'warning' });
        return out;
      }

      const result = this.repo.applyRebaseTodo(editedTodo, todoRes.baseHash);
      if (!result.success) {
        out.lines.push({ text: `fatal: rebase failed`, type: 'error' });
        return out;
      }

      out.lines.push({ text: `Successfully rebased and updated ${this.repo.currentBranch}.`, type: 'success' });
      out.levelEvent = 'git-rebase-interactive';
      return out;
    }

    const result = this.repo.rebase(branch);
    if (!result.success) {
      const err = ErrorLibrary.get(result.error) || { message: result.error };
      out.lines.push({ text: err.message, type: 'error' });
      return out;
    }
    if (result.fastForward) {
      out.lines.push({ text: `Fast-forwarded ${this.repo.currentBranch} to ${branch}.`, type: 'success' });
    } else if (result.alreadyUpToDate) {
      out.lines.push({ text: `Current branch ${this.repo.currentBranch} is up to date.`, type: 'success' });
    } else {
      out.lines.push({ text: result.message, type: 'success' });
    }
    out.levelEvent = 'git-rebase';
    return out;
  }

  _gitCherryPick(cmd, out) {
    const hash = cmd.args[0];
    if (!hash) {
      out.lines.push({ text: `usage: git cherry-pick <commit-hash>`, type: 'error' });
      return out;
    }
    const result = this.repo.cherryPick(hash);
    if (!result.success) {
      out.lines.push({ text: `fatal: bad revision '${hash}'`, type: 'error' });
      return out;
    }
    out.lines.push({ text: `[${this.repo.currentBranch} ${result.newCommit.shortHash}] Cherry-picked: ${result.newCommit.message}`, type: 'success' });
    out.levelEvent = 'git-cherry-pick';
    return out;
  }

  _gitTag(cmd, out) {
    const name = cmd.args[0];
    const deleteFlag = cmd.flags['d'];

    if (!name) {
      // List tags
      for (const tag of Object.keys(this.repo.tags)) {
        out.lines.push({ text: tag, type: 'normal' });
      }
      return out;
    }

    const result = this.repo.createTag(name);
    if (!result.success) {
      const err = ErrorLibrary.get(result.error, { name });
      out.lines.push({ text: err.message, type: 'error' });
      return out;
    }
    // Silent
    return out;
  }

  _gitConfig(cmd, out) {
    const key = cmd.args[0];
    const value = cmd.args[1];

    if (!key) {
      out.lines.push({ text: `usage: git config [<options>] <key> [<value>]`, type: 'normal' });
      return out;
    }

    if (value) {
      this.repo.setConfig(key, value);
      out.lines.push({ text: ``, type: 'normal' });
    } else {
      const val = this.repo.config[key];
      if (val !== undefined) {
        out.lines.push({ text: val, type: 'normal' });
      } else {
        out.lines.push({ text: ``, type: 'normal' });
      }
    }

    out.levelEvent = 'git-config';
    return out;
  }

  _gitShow(cmd, out) {
    const ref = cmd.args[0] || this.repo.branches[this.repo.currentBranch];
    const commit = this.repo.getCommitByHash(ref) || this.repo.getCurrentCommit();
    if (!commit) {
      out.lines.push({ text: `fatal: bad object`, type: 'error' });
      return out;
    }
    out.lines.push({ text: `commit ${commit.hash}`, type: 'warning' });
    out.lines.push({ text: `Author: ${commit.author} <${commit.email}>`, type: 'normal' });
    out.lines.push({ text: `Date:   ${commit.timestamp.toDateString()}`, type: 'normal' });
    out.lines.push({ text: ``, type: 'normal' });
    out.lines.push({ text: `    ${commit.message}`, type: 'normal' });
    return out;
  }

  _gitHelp(cmd, out) {
    const commands = [
      ['git init', 'Initialize a new repository'],
      ['git add <file>', 'Stage changes for commit'],
      ['git add .', 'Stage all changes'],
      ['git commit -m "msg"', 'Create a commit with a message'],
      ['git status', 'Show working tree status'],
      ['git log', 'Show commit history'],
      ['git log --oneline', 'Compact commit history'],
      ['git diff', 'Show unstaged changes'],
      ['git branch', 'List branches'],
      ['git branch <name>', 'Create a branch'],
      ['git checkout <branch>', 'Switch branches'],
      ['git checkout -b <branch>', 'Create and switch to new branch'],
      ['git merge <branch>', 'Merge a branch into current'],
      ['git stash', 'Shelve working changes temporarily'],
      ['git stash pop', 'Restore stashed changes'],
      ['git remote add origin <url>', 'Add a remote repository'],
      ['git push origin main', 'Push commits to remote'],
      ['git pull origin main', 'Pull changes from remote'],
      ['git reset --hard HEAD~1', 'Undo last commit (destructive)'],
      ['git tag <name>', 'Create a tag on current commit'],
      ['git config user.name "Name"', 'Set your Git identity'],
      ['history', 'View all commands and outputs in this session'],
    ];

    out.lines.push({ text: `Git Playground — Available Commands`, type: 'success' });
    out.lines.push({ text: `${'─'.repeat(50)}`, type: 'info' });
    commands.forEach(([cmd, desc]) => {
      out.lines.push({ text: `  ${cmd.padEnd(35)} ${desc}`, type: 'normal' });
    });
    out.lines.push({ text: ``, type: 'normal' });
    out.lines.push({ text: `Shell: ls, touch, nano, cat, mkdir, pwd, clear`, type: 'info' });
    return out;
  }

  _executeShell(cmd, out) {
    switch (cmd.base) {
      case 'ls': return this._shellLs(cmd, out);
      case 'touch': return this._shellTouch(cmd, out);
      case 'echo': return this._shellEcho(cmd, out);
      case 'cat': return this._shellCat(cmd, out);
      case 'mkdir': return this._shellMkdir(cmd, out);
      case 'pwd': return this._shellPwd(cmd, out);
      case 'nano':
      case 'vim':
      case 'vi': return this._shellNano(cmd, out);
      case 'clear': {
        out.clear = true;
        return out;
      }
      case 'undo': {
        const res = this.repo.restoreSnapshot();
        if (res.success) {
          out.lines.push({ text: `⏪ Rewound repository to previous state.`, type: 'success' });
          out.levelEvent = 'undo';
        } else {
          out.lines.push({ text: `Cannot undo any further.`, type: 'warning' });
        }
        return out;
      }
      case 'help': return this._gitHelp(cmd, out);
      case 'history': {
        this.commandHistory.slice(-20).forEach((h, i) => {
          out.lines.push({ text: `  ${String(i + 1).padStart(3)}  ${h}`, type: 'normal' });
        });
        return out;
      }
      case '': return out;
      default: {
        const err = ErrorLibrary.get('UNKNOWN_SHELL_CMD', { cmd: cmd.base });
        out.lines.push({ text: err.message, type: 'error' });
        if (err.explanation) out.lines.push({ text: `\n💡 ${err.explanation}`, type: 'info' });
        if (err.fix) out.lines.push({ text: `🔧 Fix: ${err.fix}`, type: 'warning' });
        return out;
      }
    }
  }

  _shellLs(cmd, out) {
    const files = this.repo.listFiles();
    if (files.length === 0) {
      return out; // empty directory
    }
    // Display in columns
    out.lines.push({ text: files.join('   '), type: 'normal' });
    return out;
  }

  _shellTouch(cmd, out) {
    const filename = cmd.args[0];
    if (!filename) {
      out.lines.push({ text: `touch: missing file operand`, type: 'error' });
      return out;
    }
    const result = this.repo.touchFile(filename);
    out.levelEvent = 'touch-file';
    return out;
  }

  _shellEcho(cmd, out) {
    // echo "content" > filename  OR  echo text
    const raw = cmd.raw;
    const redirectMatch = raw.match(/echo\s+["']?(.+?)["']?\s*>\s*(.+)/);
    if (redirectMatch) {
      const content = redirectMatch[1].trim();
      const filename = redirectMatch[2].trim();
      this.repo.writeFile(filename, content);
      out.levelEvent = 'write-file';
      return out;
    }
    // Just print
    const text = cmd.args.join(' ');
    out.lines.push({ text: text, type: 'normal' });
    return out;
  }

  _shellCat(cmd, out) {
    const filename = cmd.args[0];
    if (!filename) {
      out.lines.push({ text: `cat: missing operand`, type: 'error' });
      return out;
    }
    const result = this.repo.readFile(filename);
    if (!result.success) {
      out.lines.push({ text: `cat: ${filename}: No such file or directory`, type: 'error' });
      return out;
    }
    const lines = result.content.split('\n');
    lines.forEach(line => out.lines.push({ text: line, type: 'normal' }));
    return out;
  }

  _shellMkdir(cmd, out) {
    const dirname = cmd.args[0];
    if (!dirname) {
      out.lines.push({ text: `mkdir: missing operand`, type: 'error' });
      return out;
    }
    // Simulated directory — just acknowledge
    out.lines.push({ text: ``, type: 'normal' });
    return out;
  }

  _shellPwd(cmd, out) {
    out.lines.push({ text: `/home/user/project`, type: 'normal' });
    return out;
  }

  async _shellNano(cmd, out) {
    const filename = cmd.args[0];
    if (!filename) {
      out.lines.push({ text: `usage: ${cmd.base} <filename>`, type: 'error' });
      return out;
    }

    // Read current content if it exists
    const readRes = this.repo.readFile(filename);
    const initialContent = readRes.success ? readRes.content : '';

    const edited = await this.vimModal.open(initialContent, filename);
    
    if (edited !== null) {
      this.repo.writeFile(filename, edited);
      out.lines.push({ text: `📝 Saved ${filename}`, type: 'success' });
    } else {
      out.lines.push({ text: `Edit aborted.`, type: 'warning' });
    }
    
    return out;
  }
}
