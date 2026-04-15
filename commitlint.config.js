const types = [
  'feat',     // New feature
  'fix',      // Bug fix
  'docs',     // Documentation changes
  'style',    // Code formatting (no code change)
  'refactor', // Code refactoring
  'perf',     // Performance improvement
  'test',     // Adding or fixing tests
  'build',    // Build system changes
  'ci',       // CI configuration
  'chore',    // Other changes
];

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      types,
    ],
  },
  helpUrl: `https://github.com/conventional-changelog/commitlint/#what-is-commitlint;\n    Required types: ${types.join(', ')}`,
};
