/**
 * GitRepository.js
 * In-memory simulation of a Git repository's state.
 * This is the single source of truth for the entire Git state machine.
 */

export class GitRepository {
  constructor() {
    this.reset();
  }

  reset() {
    this.initialized = false;
    this.workingTree = {};       // { filename: { content, status: 'untracked'|'modified'|'deleted' } }
    this.stagingArea = {};       // { filename: content }
    this.commits = [];           // [{ hash, message, tree, parent, author, timestamp, branch }]
    this.branches = {};          // { branchName: commitHash }
    this.HEAD = { type: 'branch', ref: 'main' };
    this.remotes = {};           // { remoteName: { url, refs: { branchName: hash } } }
    this.config = { 'user.name': '', 'user.email': '' };
    this.stash = [];             // [{ message, tree, stagingArea }]
    this.tags = {};              // { tagName: commitHash }
    this.currentBranch = 'main';
    this.conflictState = null;   // active conflict data if any
    this.snapshots = [];         // visual undo snapshots
    this.reflog = [];            // ref histories
    this._eventListeners = {};
  }

  // ─── Event System ────────────────────────────────────────────────────────────
  on(event, cb) {
    if (!this._eventListeners[event]) this._eventListeners[event] = [];
    this._eventListeners[event].push(cb);
  }
  emit(event, data) {
    (this._eventListeners[event] || []).forEach(cb => cb(data));
  }

  // ─── Reflog & GitIgnore Utils ────────────────────────────────────────────────
  _isIgnored(filename) {
    if (!this.workingTree['.gitignore'] || filename === '.gitignore') return false;
    const lines = this.workingTree['.gitignore'].content.split('\n')
      .map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    return lines.some(pattern => {
      if (pattern.startsWith('*')) return filename.endsWith(pattern.slice(1));
      return filename === pattern || filename.startsWith(pattern + '/');
    });
  }

  _recordReflog(action) {
    const hash = this.HEAD.type === 'detached' ? this.HEAD.ref : (this.branches[this.HEAD.ref] || '0000000');
    this.reflog.unshift({ hash, headRef: this.HEAD.ref, action, timestamp: Date.now() });
  }

  // ─── Core Git Operations ──────────────────────────────────────────────────────

  init() {
    if (this.initialized) {
      return { success: true, message: 'Reinitialized existing Git repository in .git/', alreadyInit: true };
    }
    this.initialized = true;
    this.branches['main'] = null;
    this.HEAD = { type: 'branch', ref: 'main' };
    this.currentBranch = 'main';
    this.emit('init', {});
    return { success: true, message: 'Initialized empty Git repository in .git/' };
  }

  addFile(filename, content) {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };
    if (filename === '.') {
      // git add . — stage all
      let count = 0;
      for (const [name, file] of Object.entries(this.workingTree)) {
        if (!this._isIgnored(name)) {
          this.stagingArea[name] = file.content;
          count++;
        }
      }
      if (count === 0) return { success: true, message: '', nothingAdded: true };
      this.emit('add', { filename: '.' });
      return { success: true, count };
    }
    if (this._isIgnored(filename)) {
      return { success: false, error: 'FILE_IGNORED', filename };
    }
    if (!this.workingTree[filename]) {
      return { success: false, error: 'FILE_NOT_FOUND', filename };
    }
    this.stagingArea[filename] = this.workingTree[filename].content;
    this.emit('add', { filename });
    return { success: true };
  }

  commit(message, author) {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };
    if (!message || message.trim() === '') return { success: false, error: 'EMPTY_COMMIT_MSG' };

    const staged = Object.keys(this.stagingArea);
    if (staged.length === 0) {
      // Check if there's anything changed vs last commit
      return { success: false, error: 'NOTHING_TO_COMMIT' };
    }

    const parentHash = this.branches[this.currentBranch] || null;
    const hash = this._generateHash(message + Date.now() + JSON.stringify(this.stagingArea));
    const shortHash = hash.slice(0, 7);

    const commit = {
      hash,
      shortHash,
      message,
      tree: { ...this.stagingArea },
      parent: parentHash,
      author: author || this.config['user.name'] || 'User',
      email: this.config['user.email'] || 'user@example.com',
      timestamp: new Date(),
      branch: this.currentBranch,
    };

    this.commits.push(commit);
    this.branches[this.currentBranch] = hash;
    this.stagingArea = {};
    this._recordReflog(`commit: ${message}`);
    this.emit('commit', { commit });
    return { success: true, hash, shortHash, message, branch: this.currentBranch };
  }

  createBranch(name, fromRef) {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };
    if (this.branches[name] !== undefined) return { success: false, error: 'BRANCH_EXISTS', name };
    const baseHash = fromRef ? this.branches[fromRef] : this.branches[this.currentBranch];
    this.branches[name] = baseHash || null;
    this.emit('branch', { name });
    return { success: true, name };
  }

  deleteBranch(name) {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };
    if (name === this.currentBranch) return { success: false, error: 'CANNOT_DELETE_CURRENT_BRANCH', name };
    if (this.branches[name] === undefined) return { success: false, error: 'BRANCH_NOT_FOUND', name };
    delete this.branches[name];
    return { success: true };
  }

  checkout(ref, createNew = false) {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };

    if (createNew) {
      const created = this.createBranch(ref);
      if (!created.success) return created;
    }

    if (this.branches[ref] !== undefined) {
      this.currentBranch = ref;
      this.HEAD = { type: 'branch', ref };
      // Restore working tree to match that branch's commit
      const commitHash = this.branches[ref];
      if (commitHash) {
        const commit = this.getCommitByHash(commitHash);
        if (commit) {
          this.workingTree = Object.fromEntries(
            Object.entries(commit.tree).map(([k, v]) => [k, { content: v, status: 'committed' }])
          );
        }
      }
      this._recordReflog(`checkout: moving from ${this.HEAD.ref} to ${ref}`);
      this.emit('checkout', { ref, type: 'branch' });
      return { success: true, ref, type: 'branch', created: createNew };
    }

    // Check if it's a commit hash
    const commit = this.commits.find(c => c.hash === ref || c.shortHash === ref);
    if (commit) {
      this.HEAD = { type: 'detached', ref: commit.hash };
      this.currentBranch = null;
      this.workingTree = Object.fromEntries(
        Object.entries(commit.tree).map(([k, v]) => [k, { content: v, status: 'committed' }])
      );
      this.emit('checkout', { ref: commit.hash, type: 'detached' });
      return { success: true, ref: commit.hash, type: 'detached', shortHash: commit.shortHash };
    }

    return { success: false, error: 'REF_NOT_FOUND', ref };
  }

  merge(branchName) {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };
    if (this.branches[branchName] === undefined) return { success: false, error: 'BRANCH_NOT_FOUND', name: branchName };
    if (branchName === this.currentBranch) return { success: false, error: 'MERGE_SELF' };

    const ourHash = this.branches[this.currentBranch];
    const theirHash = this.branches[branchName];

    if (ourHash === theirHash) return { success: true, alreadyUpToDate: true };

    // Check if fast-forward is possible
    if (!ourHash) {
      // Our branch has no commits yet — fast forward
      this.branches[this.currentBranch] = theirHash;
      const commit = this.getCommitByHash(theirHash);
      if (commit) {
        this.workingTree = Object.fromEntries(
          Object.entries(commit.tree).map(([k, v]) => [k, { content: v, status: 'committed' }])
        );
      }
      return { success: true, fastForward: true, from: ourHash, to: theirHash };
    }

    // Check ancestry for fast-forward
    const isFastForward = this._isAncestor(ourHash, theirHash);
    if (isFastForward) {
      this.branches[this.currentBranch] = theirHash;
      const commit = this.getCommitByHash(theirHash);
      if (commit) {
        this.workingTree = Object.fromEntries(
          Object.entries(commit.tree).map(([k, v]) => [k, { content: v, status: 'committed' }])
        );
      }
      return { success: true, fastForward: true, from: ourHash, to: theirHash };
    }

    // Check for conflicts
    const ourCommit = this.getCommitByHash(ourHash);
    const theirCommit = this.getCommitByHash(theirHash);

    if (!ourCommit || !theirCommit) {
      return { success: false, error: 'MERGE_ERROR' };
    }

    const conflicts = this._detectConflicts(ourCommit.tree, theirCommit.tree);

    if (conflicts.length > 0) {
      this.conflictState = {
        ours: ourCommit.tree,
        theirs: theirCommit.tree,
        theirBranch: branchName,
        conflicts,
      };
      return {
        success: false,
        error: 'MERGE_CONFLICT',
        conflicts,
        ours: ourCommit.tree,
        theirs: theirCommit.tree,
      };
    }

    // No conflicts — create merge commit
    const mergedTree = { ...ourCommit.tree, ...theirCommit.tree };
    const mergeMsg = `Merge branch '${branchName}' into ${this.currentBranch}`;
    const hash = this._generateHash(mergeMsg + Date.now());
    const mergeCommit = {
      hash,
      shortHash: hash.slice(0, 7),
      message: mergeMsg,
      tree: mergedTree,
      parent: ourHash,
      parent2: theirHash,
      author: this.config['user.name'] || 'User',
      email: this.config['user.email'] || 'user@example.com',
      timestamp: new Date(),
      branch: this.currentBranch,
    };
    this.commits.push(mergeCommit);
    this.branches[this.currentBranch] = hash;
    this.workingTree = Object.fromEntries(
      Object.entries(mergedTree).map(([k, v]) => [k, { content: v, status: 'committed' }])
    );
    this.emit('merge', { mergeCommit });
    return { success: true, mergeCommit, fastForward: false };
  }

  cherryPick(hash) {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };
    const targetCommit = this.getCommitByHash(hash);
    if (!targetCommit) return { success: false, error: 'COMMIT_NOT_FOUND', hash };
    
    // Simplistic cherry-pick: apply files that exist in the commit tree
    const targetTree = targetCommit.tree;
    const parentCommit = this.getCommitByHash(targetCommit.parent);
    const parentTree = parentCommit ? parentCommit.tree : {};

    const diffs = {};
    for (const [file, content] of Object.entries(targetTree)) {
      if (parentTree[file] !== content) diffs[file] = content;
    }
    
    // Apply to current working tree & stage
    for (const [file, content] of Object.entries(diffs)) {
      this.workingTree[file] = { content, status: 'modified' };
      this.stagingArea[file] = content;
    }

    const commitRes = this.commit(`Cherry-picked: ${targetCommit.message}`, targetCommit.author);
    return { success: true, originalHash: targetCommit.shortHash, newCommit: commitRes };
  }

  getRebaseTodo(ref) {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };
    const headHash = this.branches[this.currentBranch];
    if (!headHash) return { success: false, error: 'NO_COMMITS' };

    // Resolve base hash (e.g., HEAD~3)
    let baseHash = ref;
    if (ref.startsWith('HEAD~')) {
      const count = parseInt(ref.split('~')[1]);
      let curr = headHash;
      for (let i = 0; i < count; i++) {
        const c = this.getCommitByHash(curr);
        if (!c?.parent) break;
        curr = c.parent;
      }
      baseHash = curr;
    }

    // Collect commits from baseHash up to headHash
    const commitsToRebase = [];
    let curr = headHash;
    while (curr && curr !== baseHash) {
      const c = this.getCommitByHash(curr);
      if (!c) break;
      commitsToRebase.unshift(c);
      curr = c.parent;
    }

    if (commitsToRebase.length === 0) return { success: false, error: 'NOTHING_TO_REBASE' };

    const todo = commitsToRebase.map(c => `pick ${c.shortHash} ${c.message}`).join('\n');
    const header = `# Interactive Rebase\n# Commands:\n# pick = use commit\n# reword = use commit, but edit the commit message\n# edit = use commit, but stop for amending\n# squash = use commit, but meld into previous commit\n# drop = remove commit\n\n`;
    
    return { success: true, todo: header + todo, baseHash, commits: commitsToRebase };
  }

  applyRebaseTodo(todoStr, baseHash) {
    const lines = todoStr.split('\n').filter(l => l && !l.startsWith('#'));
    let currentParent = baseHash;
    const newCommits = [];

    for (const line of lines) {
      const parts = line.split(' ');
      const action = parts[0];
      const hash = parts[1];
      const message = parts.slice(2).join(' ');

      const originalCommit = this.getCommitByHash(hash);
      if (!originalCommit) continue;

      if (action === 'pick' || action === 'reword') {
        const newHash = this._generateHash(message + Date.now() + JSON.stringify(originalCommit.tree));
        const newCommit = {
          ...originalCommit,
          hash: newHash,
          shortHash: newHash.slice(0, 7),
          message: action === 'reword' ? message : originalCommit.message,
          parent: currentParent,
          timestamp: new Date()
        };
        this.commits.push(newCommit);
        currentParent = newHash;
        newCommits.push(newCommit);
      } else if (action === 'squash') {
        if (newCommits.length === 0) {
            // Cannot squash first commit of rebase
            continue;
        }
        const lastCommit = newCommits[newCommits.length - 1];
        lastCommit.message += '\n\n' + originalCommit.message;
        lastCommit.tree = { ...lastCommit.tree, ...originalCommit.tree };
        // Update hash because content changed
        const updatedHash = this._generateHash(lastCommit.message + lastCommit.timestamp + JSON.stringify(lastCommit.tree));
        lastCommit.hash = updatedHash;
        lastCommit.shortHash = updatedHash.slice(0, 7);
        currentParent = updatedHash;
      } else if (action === 'drop') {
        continue;
      }
    }

    this.branches[this.currentBranch] = currentParent;
    const headCommit = this.getCommitByHash(currentParent);
    if (headCommit) {
        this.workingTree = Object.fromEntries(
            Object.entries(headCommit.tree).map(([k, v]) => [k, { content: v, status: 'committed' }])
        );
    }
    this.emit('repositoryChanged', {});
    return { success: true };
  }

  rebase(branchName) {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };
    if (this.branches[branchName] === undefined) return { success: false, error: 'BRANCH_NOT_FOUND', name: branchName };
    if (branchName === this.currentBranch) return { success: false, error: 'REBASE_SELF' };

    const ourHash = this.branches[this.currentBranch];
    const theirHash = this.branches[branchName];

    if (ourHash === theirHash) return { success: true, alreadyUpToDate: true };

    const isFastForward = this._isAncestor(ourHash, theirHash);
    if (isFastForward) {
      // Just fast forward
      this.branches[this.currentBranch] = theirHash;
      return { success: true, fastForward: true };
    }

    // Simplistic rebase: just reset to branchName, but we don't rewrite history properly yet.
    // For educational purposes, point currentBranch to theirHash and fake a merge of ours. 
    this.branches[this.currentBranch] = theirHash;
    const mergeRes = this.merge(this.currentBranch /* wait, no, complex to simulate accurately */);
    
    // Actual simulation fake:
    const ourCommit = this.getCommitByHash(ourHash);
    const theirCommit = this.getCommitByHash(theirHash);
    
    const mergedTree = { ...theirCommit.tree, ...ourCommit.tree };
    const hash2 = this._generateHash("rebase" + Date.now());
    const rebaseCommit = {
      hash: hash2,
      shortHash: hash2.slice(0, 7),
      message: ourCommit.message,
      tree: mergedTree,
      parent: theirHash,
      author: ourCommit.author,
      timestamp: new Date(),
      branch: this.currentBranch
    };
    this.commits.push(rebaseCommit);
    this.branches[this.currentBranch] = hash2;
    this.workingTree = Object.fromEntries(
      Object.entries(mergedTree).map(([k, v]) => [k, { content: v, status: 'committed' }])
    );
    this.stagingArea = {};
    return { success: true, message: `Successfully rebased and updated ${this.currentBranch}.` };
  }

  resolveConflict(filename, resolvedContent) {
    if (!this.conflictState) return { success: false, error: 'NO_CONFLICT' };
    this.workingTree[filename] = { content: resolvedContent, status: 'modified' };
    this.stagingArea[filename] = resolvedContent;
    this.conflictState.conflicts = this.conflictState.conflicts.filter(c => c !== filename);
    if (this.conflictState.conflicts.length === 0) {
      this.conflictState = null;
    }
    return { success: true };
  }

  status() {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };

    const staged = [];
    const unstaged = [];
    const untracked = [];

    const lastCommitTree = this._getHeadTree();

    for (const [name, file] of Object.entries(this.workingTree)) {
      const isStaged = this.stagingArea[name] !== undefined;
      const inLastCommit = lastCommitTree[name] !== undefined;

      if (isStaged) {
        staged.push({ name, status: inLastCommit ? 'modified' : 'new file' });
      } else if (file.status === 'untracked') {
        untracked.push({ name });
      } else if (inLastCommit && lastCommitTree[name] !== file.content) {
        unstaged.push({ name, status: 'modified' });
      }
    }

    for (const [name] of Object.entries(lastCommitTree)) {
      if (!this.workingTree[name] && !this.stagingArea[name]) {
        unstaged.push({ name, status: 'deleted' });
      }
    }

    return {
      success: true,
      branch: this.currentBranch,
      staged,
      unstaged,
      untracked,
      hasConflict: !!this.conflictState,
      clean: staged.length === 0 && unstaged.length === 0 && untracked.length === 0,
    };
  }

  log(options = {}) {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };
    const headHash = this.branches[this.currentBranch];
    if (!headHash) return { success: true, commits: [], empty: true };

    const log = [];
    let current = headHash;
    let safety = 0;
    while (current && safety < 100) {
      const commit = this.getCommitByHash(current);
      if (!commit) break;
      log.push(commit);
      current = commit.parent;
      safety++;
    }
    return { success: true, commits: log };
  }

  diff(filename) {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };
    const lastTree = this._getHeadTree();
    const results = {};

    const files = filename ? [filename] : Object.keys(this.workingTree);
    for (const name of files) {
      const oldContent = lastTree[name] || '';
      const newContent = this.workingTree[name]?.content || '';
      if (oldContent !== newContent) {
        results[name] = this._generateDiff(oldContent, newContent);
      }
    }
    return { success: true, diffs: results };
  }

  stashPush(message) {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };
    const dirtyFiles = Object.entries(this.workingTree).filter(([, f]) => f.status !== 'committed');
    if (dirtyFiles.length === 0 && Object.keys(this.stagingArea).length === 0) {
      return { success: false, error: 'NOTHING_TO_STASH' };
    }
    const entry = {
      message: message || `WIP on ${this.currentBranch}: ${this.branches[this.currentBranch]?.slice(0, 7) || 'initial'}`,
      tree: { ...this.workingTree },
      stagingArea: { ...this.stagingArea },
    };
    this.stash.unshift(entry);
    // Clear working changes
    const lastTree = this._getHeadTree();
    this.workingTree = Object.fromEntries(
      Object.entries(lastTree).map(([k, v]) => [k, { content: v, status: 'committed' }])
    );
    this.stagingArea = {};
    return { success: true, message: entry.message, index: 0 };
  }

  stashPop() {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };
    if (this.stash.length === 0) return { success: false, error: 'STASH_EMPTY' };
    const entry = this.stash.shift();
    this.workingTree = { ...entry.tree };
    this.stagingArea = { ...entry.stagingArea };
    return { success: true, message: entry.message };
  }

  addRemote(name, url) {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };
    if (this.remotes[name]) return { success: false, error: 'REMOTE_EXISTS', name };
    this.remotes[name] = { url, refs: {} };
    return { success: true };
  }

  push(remote = 'origin', branch) {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };
    if (!this.remotes[remote]) return { success: false, error: 'REMOTE_NOT_FOUND', remote };
    const targetBranch = branch || this.currentBranch;
    const hash = this.branches[targetBranch];
    if (!hash) return { success: false, error: 'NOTHING_TO_PUSH' };
    this.remotes[remote].refs[targetBranch] = hash;
    const commit = this.getCommitByHash(hash);
    return { success: true, remote, branch: targetBranch, hash: hash.slice(0, 7), message: commit?.message };
  }

  pull(remote = 'origin', branch) {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };
    if (!this.remotes[remote]) return { success: false, error: 'REMOTE_NOT_FOUND', remote };
    const targetBranch = branch || this.currentBranch;
    const remoteHash = this.remotes[remote].refs[targetBranch];
    if (!remoteHash) return { success: true, alreadyUpToDate: true };
    const localHash = this.branches[targetBranch];
    if (localHash === remoteHash) return { success: true, alreadyUpToDate: true };
    // Simulate fast-forward pull
    this.branches[targetBranch] = remoteHash;
    return { success: true, from: localHash?.slice(0, 7), to: remoteHash.slice(0, 7) };
  }

  resetHead(mode = 'mixed', ref) {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };
    const currentHash = this.branches[this.currentBranch];
    if (!currentHash) return { success: false, error: 'NO_COMMITS' };

    let targetHash = currentHash;
    if (ref === 'HEAD~1' || ref === 'HEAD^') {
      const currentCommit = this.getCommitByHash(currentHash);
      if (!currentCommit?.parent) return { success: false, error: 'NO_PARENT_COMMIT' };
      targetHash = currentCommit.parent;
    }

    const targetCommit = this.getCommitByHash(targetHash);
    if (!targetCommit) return { success: false, error: 'COMMIT_NOT_FOUND' };

    this.branches[this.currentBranch] = targetHash;

    if (mode === 'hard') {
      this.workingTree = Object.fromEntries(
        Object.entries(targetCommit.tree).map(([k, v]) => [k, { content: v, status: 'committed' }])
      );
      this.stagingArea = {};
    } else if (mode === 'soft') {
      // Keep working tree + staging
    } else {
      // mixed — clear staging, keep working tree
      this.stagingArea = {};
    }
    return { success: true, mode, hash: targetHash.slice(0, 7) };
  }

  createTag(name, ref) {
    if (!this.initialized) return { success: false, error: 'NOT_A_REPO' };
    if (this.tags[name]) return { success: false, error: 'TAG_EXISTS', name };
    const hash = ref ? this.branches[ref] : this.branches[this.currentBranch];
    if (!hash) return { success: false, error: 'NO_COMMITS' };
    this.tags[name] = hash;
    return { success: true, name, hash: hash.slice(0, 7) };
  }

  setConfig(key, value) {
    this.config[key] = value;
    return { success: true, key, value };
  }

  // ─── File System Simulation ───────────────────────────────────────────────────

  touchFile(name, content = '') {
    if (this.workingTree[name]) {
      // file already exists
      return { success: true, existed: true };
    }
    this.workingTree[name] = { content, status: 'untracked' };
    this.emit('fileCreated', { name });
    return { success: true, created: true };
  }

  writeFile(name, content) {
    const existed = !!this.workingTree[name];
    const lastTree = this._getHeadTree();
    const inCommit = lastTree[name] !== undefined;
    this.workingTree[name] = {
      content,
      status: inCommit ? 'modified' : 'untracked',
    };
    this.emit('fileWritten', { name, content });
    return { success: true, existed };
  }

  readFile(name) {
    if (this.workingTree[name]) return { success: true, content: this.workingTree[name].content };
    return { success: false, error: 'FILE_NOT_FOUND', filename: name };
  }

  listFiles() {
    return Object.keys(this.workingTree);
  }

  // ─── Undo & Snapshots ────────────────────────────────────────────────────────

  takeSnapshot() {
    this.snapshots.push(JSON.stringify({
      workingTree: this.workingTree,
      stagingArea: this.stagingArea,
      commits: this.commits,
      branches: this.branches,
      HEAD: this.HEAD,
      remotes: this.remotes,
      stash: this.stash,
      tags: this.tags,
      currentBranch: this.currentBranch,
      conflictState: this.conflictState
    }));
  }

  restoreSnapshot() {
    if (!this.snapshots || this.snapshots.length === 0) return { success: false, error: 'NO_SNAPSHOTS' };
    const raw = this.snapshots.pop();
    const parsed = JSON.parse(raw);
    Object.assign(this, parsed);
    this.emit('checkout', { ref: this.currentBranch }); // triggers UI update
    return { success: true };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  getCommitByHash(hash) {
    if (!hash) return null;
    return this.commits.find(c => c.hash === hash || c.shortHash === hash) || null;
  }

  getCurrentCommit() {
    const hash = this.branches[this.currentBranch];
    return hash ? this.getCommitByHash(hash) : null;
  }

  getGitTree() {
    // Returns an ASCII-friendly tree structure for visualization
    const branchTips = Object.entries(this.branches);
    return { commits: this.commits, branches: this.branches, HEAD: this.HEAD };
  }

  _getHeadTree() {
    const hash = this.branches[this.currentBranch];
    if (!hash) return {};
    const commit = this.getCommitByHash(hash);
    return commit ? { ...commit.tree } : {};
  }

  _generateHash(input) {
    let hash = 0;
    const str = input + Math.random().toString(36);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    // Convert to hex-like 40-char string
    const base = Math.abs(hash).toString(16).padStart(8, '0');
    const random = Math.random().toString(16).slice(2).padStart(32, '0');
    return (base + random).slice(0, 40);
  }

  _isAncestor(ancestorHash, descendantHash) {
    let current = descendantHash;
    let safety = 0;
    while (current && safety < 100) {
      if (current === ancestorHash) return true;
      const commit = this.getCommitByHash(current);
      if (!commit) break;
      current = commit.parent;
      safety++;
    }
    return false;
  }

  _detectConflicts(ourTree, theirTree) {
    const conflicts = [];
    for (const [name, content] of Object.entries(theirTree)) {
      if (ourTree[name] !== undefined && ourTree[name] !== content) {
        conflicts.push(name);
      }
    }
    return conflicts;
  }

  _generateDiff(oldContent, newContent) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diff = [];
    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= oldLines.length) {
        diff.push({ type: 'add', line: newLines[i], lineNum: i + 1 });
      } else if (i >= newLines.length) {
        diff.push({ type: 'remove', line: oldLines[i], lineNum: i + 1 });
      } else if (oldLines[i] !== newLines[i]) {
        diff.push({ type: 'remove', line: oldLines[i], lineNum: i + 1 });
        diff.push({ type: 'add', line: newLines[i], lineNum: i + 1 });
      } else {
        diff.push({ type: 'context', line: oldLines[i], lineNum: i + 1 });
      }
    }
    return diff;
  }

  generateConflictMarkers(filename) {
    if (!this.conflictState) return null;
    const ours = this.conflictState.ours[filename] || '';
    const theirs = this.conflictState.theirs[filename] || '';
    return [
      `<<<<<<< HEAD`,
      ours,
      `=======`,
      theirs,
      `>>>>>>> ${this.conflictState.theirBranch}`,
    ].join('\n');
  }

  // ─── Persistence & Serialization ───────────────────────────────────────────

  /**
   * Serializes the entire repository state into a plain JSON-friendly object.
   */
  serialize() {
    return {
      initialized:    this.initialized,
      workingTree:    this.workingTree,
      stagingArea:    this.stagingArea,
      commits:        this.commits, // Note: Dates become strings in JSON
      branches:       this.branches,
      HEAD:           this.HEAD,
      remotes:        this.remotes,
      config:         this.config,
      stash:          this.stash,
      tags:           this.tags,
      currentBranch:  this.currentBranch,
      conflictState:  this.conflictState,
      reflog:         this.reflog
    };
  }

  /**
   * Hydrates the repository state from a serialized object.
   * @param {Object} data 
   */
  deserialize(data) {
    if (!data) return;

    // Direct assignment for simple properties
    this.initialized    = data.initialized;
    this.workingTree    = data.workingTree    || {};
    this.stagingArea    = data.stagingArea    || {};
    this.branches       = data.branches       || {};
    this.HEAD           = data.HEAD           || { type: 'branch', ref: 'main' };
    this.remotes        = data.remotes        || {};
    this.config         = data.config         || { 'user.name': '', 'user.email': '' };
    this.stash          = data.stash          || [];
    this.tags           = data.tags           || {};
    this.currentBranch  = data.currentBranch  || 'main';
    this.conflictState  = data.conflictState  || null;
    this.reflog         = data.reflog         || [];

    // Hydrate Commits (specifically reconstruct Date objects)
    this.commits = (data.commits || []).map(c => ({
      ...c,
      timestamp: c.timestamp ? new Date(c.timestamp) : new Date()
    }));

    // Reset undo stack on hydration to avoid cross-session confusion
    this.snapshots = [];
    
    this.emit('repositoryChanged', {});
    this.emit('checkout', { ref: this.currentBranch }); // triggers UI refresh
  }
}
