// Minimal ESLint flat config — enforces the "một cửa" (single-door) UI-import
// rule ONLY. Deliberately enables NO other rulesets: this codebase has never
// been linted, so a recommended ruleset would surface an unrelated storm of
// pre-existing findings. The single job here is to prevent apps from importing
// a UI library directly instead of going through @cmc/ui.
//
// Scope: apps/admin/** (fully migrated to Astryx in Phase 3). apps/lms/** is
// added in Phase 4 once it is migrated too — scoping it now would flag lms's
// still-present Mantine imports and make lint red prematurely.
//
// Whitelist: apps/admin/src/main.tsx is the one entry allowed to import the
// design-system CSS/reset directly (red-team F14 — reset.css is app-scoped and
// not re-exported through @cmc/ui).
import tseslint from 'typescript-eslint';

const BANNED_UI_IMPORTS = {
  patterns: [
    {
      group: ['@mantine', '@mantine/*'],
      message:
        'Do not import @mantine/* in apps. UI comes through the @cmc/ui single door — migrate this to an Astryx primitive/component re-exported from @cmc/ui.',
    },
    {
      group: ['@astryxdesign', '@astryxdesign/*'],
      message:
        'Do not import @astryxdesign/* directly in apps. Import the primitive/component from @cmc/ui (the single door). Only main.tsx may import the reset/theme CSS.',
    },
  ],
};

export default [
  {
    files: ['apps/admin/**/*.{ts,tsx}'],
    ignores: ['apps/admin/src/main.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    // Register the plugin so pre-existing `// eslint-disable @typescript-eslint/*`
    // directives in source resolve to a known rule (left OFF here — we enforce
    // only the import rule). Without this, ESLint errors "rule not found".
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      'no-restricted-imports': ['error', BANNED_UI_IMPORTS],
    },
  },
];
