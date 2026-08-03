declare module '@gym-companion/config/vitest/base' {
  import type { UserConfig } from 'vitest/config';

  export const vitestBaseConfig: {
    test: NonNullable<UserConfig['test']>;
  };

  export default vitestBaseConfig;
}

declare module '@gym-companion/config/eslint/base' {
  import type { Linter } from 'eslint';
  export const baseConfig: Linter.Config[];
  const config: Linter.Config[];
  export default config;
}

declare module '@gym-companion/config/eslint/react' {
  import type { Linter } from 'eslint';
  export const reactConfig: Linter.Config[];
  const config: Linter.Config[];
  export default config;
}

declare module '@gym-companion/config/eslint/node' {
  import type { Linter } from 'eslint';
  export const nodeConfig: Linter.Config[];
  const config: Linter.Config[];
  export default config;
}
