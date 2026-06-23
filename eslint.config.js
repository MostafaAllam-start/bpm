import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      // Type-aware linting. Surfaces real latent issues (floating promises,
      // unsafe `any` flows); the noisy rules are staged to `warn` below so the
      // gate stays green while the burn-down happens incrementally.
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        // Type-aware, auto-discovers the nearest tsconfig for each file.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Type-aware rules staged to `warn` so type-checked linting is ON and the
      // CI gate stays green while pre-existing violations are burned down
      // file-by-file (then promoted back to `error`). See CLAUDE.md → "Lint
      // burn-down". Promise rules lead the list — they catch real unhandled
      // rejections and should be the first promoted back to `error`.
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-redundant-type-constituents': 'warn',

      // Pre-existing patterns flagged by newer plugin rules; predate this work.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
  // Node-side tooling files: turn off the type-aware rules (they aren't part of
  // the app's typed program in the same way) and use Node globals.
  {
    files: ['vite.config.ts', 'vitest.config.ts', 'vitest.setup.ts', 'aliases.ts', 'eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
])
