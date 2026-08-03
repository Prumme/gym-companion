import nodeConfig from '@gym-companion/config/eslint/node';

export default [
  ...nodeConfig,
  {
    ignores: ['dist/**'],
  },
];
