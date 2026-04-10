/**
 * MergeConflictEngine.js
 * Pre-defined merge conflict scenarios for Level 8.
 * Generates realistic conflict markers and validates user resolutions.
 */

export const conflictScenarios = [
  {
    id: 'feature_readme',
    name: 'README Conflict',
    description: 'Both main and feature branches edited README.md',
    filename: 'README.md',
    baseBranch: 'main',
    featureBranch: 'feature',

    mainContent: `# My Project

This is the main branch version.
Author: Alice
Version: 1.0`,

    featureContent: `# My Project

This is the feature branch version.
Author: Bob
Version: 2.0-beta`,

    conflictMarkers: `# My Project

<<<<<<< HEAD
This is the main branch version.
Author: Alice
Version: 1.0
=======
This is the feature branch version.
Author: Bob
Version: 2.0-beta
>>>>>>> feature`,

    expectedResolutions: [
      // Any resolution that removes conflict markers is valid
      (resolved) => !resolved.includes('<<<<<<<') && !resolved.includes('=======') && !resolved.includes('>>>>>>>'),
    ],

    hint: 'Remove the conflict markers (<<<, ===, >>>) and keep the version you want (or combine both).',
    successMessage: '✅ Conflict resolved! You can now commit the resolution.',
  },

  {
    id: 'app_js_conflict',
    name: 'App Logic Conflict',
    description: 'Two developers modified the same function in app.js',
    filename: 'app.js',
    baseBranch: 'main',
    featureBranch: 'feature-login',

    mainContent: `function greet(name) {
  return "Hello, " + name;
}

module.exports = { greet };`,

    featureContent: `function greet(name, language) {
  if (language === 'es') return "Hola, " + name;
  return "Hello, " + name;
}

module.exports = { greet };`,

    conflictMarkers: `<<<<<<< HEAD
function greet(name) {
  return "Hello, " + name;
=======
function greet(name, language) {
  if (language === 'es') return "Hola, " + name;
  return "Hello, " + name;
>>>>>>> feature-login
}

module.exports = { greet };`,

    expectedResolutions: [
      (resolved) => !resolved.includes('<<<<<<<') && !resolved.includes('>>>>>>>'),
    ],

    hint: 'Both branches changed the greet() function. Decide which version (or combination) you want to keep.',
    successMessage: '✅ Merge conflict resolved! The feature has been integrated.',
  },
];

export class MergeConflictEngine {
  constructor(repo) {
    this.repo = repo;
    this.activeScenario = null;
  }

  /**
   * Set up a specific conflict scenario in the repo.
   * This creates the branches, files, and commits needed.
   */
  setupScenario(scenarioId) {
    const scenario = conflictScenarios.find(s => s.id === scenarioId) || conflictScenarios[0];
    this.activeScenario = scenario;

    // Reset and init
    this.repo.reset();
    this.repo.init();

    // Create initial file on main
    this.repo.touchFile(scenario.filename, '# My Project\nInitial content');
    this.repo.addFile('.');
    this.repo.commit('Initial commit');

    // Create feature branch and make change
    this.repo.createBranch(scenario.featureBranch);
    this.repo.checkout(scenario.featureBranch);
    this.repo.writeFile(scenario.filename, scenario.featureContent);
    this.repo.addFile(scenario.filename);
    this.repo.commit(`Add feature changes to ${scenario.filename}`);

    // Back to main branch, make conflicting change
    this.repo.checkout(scenario.baseBranch);
    this.repo.writeFile(scenario.filename, scenario.mainContent);
    this.repo.addFile(scenario.filename);
    this.repo.commit(`Update ${scenario.filename} on main`);

    // Now set up the conflict state manually
    const mainCommit = this.repo.getCurrentCommit();
    this.repo.checkout(scenario.featureBranch);
    const featureCommit = this.repo.getCurrentCommit();
    this.repo.checkout(scenario.baseBranch);

    this.repo.conflictState = {
      ours: mainCommit ? mainCommit.tree : {},
      theirs: featureCommit ? featureCommit.tree : {},
      theirBranch: scenario.featureBranch,
      conflicts: [scenario.filename],
    };

    // Write the conflict markers to working tree
    this.repo.workingTree[scenario.filename] = {
      content: scenario.conflictMarkers,
      status: 'conflict',
    };

    return {
      scenario,
      conflictFile: scenario.filename,
      conflictContent: scenario.conflictMarkers,
    };
  }

  /**
   * Validate a user's resolved content for the active conflict.
   */
  validateResolution(filename, resolvedContent) {
    if (!this.activeScenario) return { valid: false, error: 'No active scenario' };

    const hasConflictMarkers = ['<<<<<<<', '=======', '>>>>>>>'].some(
      marker => resolvedContent.includes(marker)
    );

    if (hasConflictMarkers) {
      return {
        valid: false,
        error: 'Conflict markers are still present. Remove all <<<<<<, =======, and >>>>>>> lines.',
      };
    }

    if (resolvedContent.trim() === '') {
      return {
        valid: false,
        error: 'Empty resolution. Please keep at least some content.',
      };
    }

    // All validators pass
    return { valid: true, message: this.activeScenario.successMessage };
  }

  /**
   * Apply a successful resolution to the repo.
   */
  applyResolution(filename, resolvedContent) {
    const validation = this.validateResolution(filename, resolvedContent);
    if (!validation.valid) return { success: false, error: validation.error };

    this.repo.resolveConflict(filename, resolvedContent);

    return { success: true, message: validation.message };
  }

  getHint() {
    return this.activeScenario?.hint || 'Remove conflict markers and keep the version you prefer.';
  }

  getScenarioList() {
    return conflictScenarios.map(({ id, name, description }) => ({ id, name, description }));
  }
}
