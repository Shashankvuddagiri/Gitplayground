/**
 * CommandParser.js
 * Tokenizes raw terminal input into structured command objects.
 */

export class CommandParser {
  /**
   * Parse a raw input string into a structured command object.
   * @param {string} input
   * @returns {{ base, sub, args, flags, raw, error }}
   */
  static parse(input) {
    const raw = input.trim();
    if (!raw) return { base: '', sub: '', args: [], flags: {}, raw };

    const tokens = CommandParser._tokenize(raw);
    if (tokens.length === 0) return { base: '', sub: '', args: [], flags: {}, raw };

    const base = tokens[0].toLowerCase();

    if (base === 'git') {
      return CommandParser._parseGit(tokens, raw);
    }

    // Non-git commands
    return CommandParser._parseShell(tokens, raw);
  }

  static _parseGit(tokens, raw) {
    if (tokens.length < 2) {
      return { base: 'git', sub: null, args: [], flags: {}, raw, error: 'GIT_NO_SUB' };
    }

    const sub = tokens[1].toLowerCase();
    const rest = tokens.slice(2);
    const { args, flags } = CommandParser._extractFlagsAndArgs(rest);

    return { base: 'git', sub, args, flags, raw };
  }

  static _parseShell(tokens, raw) {
    const base = tokens[0].toLowerCase();
    const rest = tokens.slice(1);
    const { args, flags } = CommandParser._extractFlagsAndArgs(rest);
    return { base, sub: null, args, flags, raw };
  }

  static _extractFlagsAndArgs(tokens) {
    const flags = {};
    const args = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.startsWith('--')) {
        // Long flag: --amend, --oneline, --hard
        const key = token.slice(2);
        const next = tokens[i + 1];
        if (next && !next.startsWith('-')) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      } else if (token.startsWith('-') && token.length > 1 && !/^-\d/.test(token)) {
        // Short flag(s): -m, -am, -b
        const flagChars = token.slice(1).split('');
        for (let j = 0; j < flagChars.length; j++) {
          const char = flagChars[j];
          // If last char and next token isn't a flag, treat next as its value
          const isLast = j === flagChars.length - 1;
          if (isLast) {
            const next = tokens[i + 1];
            const needsValue = ['m', 'b', 'u', 'r', 'c', 'X', 'S'].includes(char);
            if (needsValue && next && !next.startsWith('-')) {
              flags[char] = next;
              i++;
            } else {
              flags[char] = true;
            }
          } else {
            flags[char] = true;
          }
        }
      } else {
        args.push(token);
      }
    }

    return { flags, args };
  }

  /**
   * Tokenizes input respecting single and double quotes.
   */
  static _tokenize(input) {
    const tokens = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];

      if (ch === "'" && !inDouble) {
        inSingle = !inSingle;
      } else if (ch === '"' && !inSingle) {
        inDouble = !inDouble;
      } else if (ch === ' ' && !inSingle && !inDouble) {
        if (current.length > 0) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += ch;
      }
    }

    if (current.length > 0) tokens.push(current);
    return tokens;
  }

  /**
   * Returns a hint for partial commands (for autocomplete).
   */
  static getSuggestions(partial) {
    const gitSubs = [
      'init', 'add', 'commit', 'status', 'log', 'diff', 'branch',
      'checkout', 'merge', 'stash', 'remote', 'push', 'pull',
      'reset', 'tag', 'config', 'clone', 'fetch', 'rebase',
      'revert', 'cherry-pick', 'show', 'help',
    ];

    const shellCmds = ['ls', 'touch', 'echo', 'cat', 'mkdir', 'pwd', 'clear', 'help', 'history', 'git'];

    const tokens = CommandParser._tokenize(partial);

    if (tokens.length === 0) return shellCmds;

    if (tokens[0].toLowerCase() === 'git') {
      if (tokens.length === 1) return gitSubs.map(s => `git ${s}`);
      const sub = tokens[1].toLowerCase();
      return gitSubs.filter(s => s.startsWith(sub)).map(s => `git ${s}`);
    }

    return shellCmds.filter(c => c.startsWith(tokens[0].toLowerCase()));
  }
}
