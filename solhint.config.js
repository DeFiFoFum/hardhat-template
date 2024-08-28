/**
 * Set the Solidity compiler versions
 */
// NOTE: Setting to '0.8.19` for now as certain chains do not support the push0 opcode.
// https://medium.com/coinmonks/push0-opcode-a-significant-update-in-the-latest-solidity-version-0-8-20-ea028668028a
const SOLC_COMPILER_VERSIONS = ['0.8.19']

/**
 *
 * - Github: https://github.com/protofire/solhint
 * - Supported Rules: https://github.com/protofire/solhint/blob/master/docs/rules.md
 * - Configure linter with inline comments:
 *    https://github.com/protofire/solhint#configure-the-linter-with-comments
 * - Create a shareable solhint config through npm:
 *    https://github.com/protofire/solhint/blob/master/docs/shareable-configs.md
 * - "error", "warn", "off" are generally the choices below
 */
module.exports = {
  extends: 'solhint:recommended',
  plugins: [],
  rules: {
    // Best Practice Rules
    'constructor-syntax': 'warn',
    'max-line-length': ['warn', 120],
    // "code-complexity": ["warn", 7], // Not included in recommended
    // "function-max-lines": [ "warn",50 ], // Not included in recommended

    // Style Guide Rules
    'func-visibility': ['error', { ignoreConstructors: true }], // Set ignoreConstructors to true if using solidity >=0.7.0
    'reason-string': ['warn', { maxLength: 50 }], // Revert reason length
    'func-param-name-mixedcase': 'error',
    'modifier-name-mixedcase': 'error',
    'private-vars-leading-underscore': ['error', { strict: false }],
    ordering: 'warn',

    // Security Rules
    'compiler-version': [
      'warn',
      SOLC_COMPILER_VERSIONS[0],
      // NOTE: Custom value added in template to support exporting multiple compiler versions
      SOLC_COMPILER_VERSIONS,
    ],
    'avoid-sha3': 'error',
    'avoid-suicide': 'error',
    'avoid-throw': 'error',
    // "not-rely-on-time": "off",
  },
}
