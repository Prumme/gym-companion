/**
 * @typedef {import('vitest/config').UserConfig['test']} VitestTestConfig
 * @type {{ test: VitestTestConfig }}
 */
export const vitestBaseConfig = {
  test: {
    globals: true,
    passWithNoTests: false,
    clearMocks: true,
    restoreMocks: true,
  },
};

export default vitestBaseConfig;
