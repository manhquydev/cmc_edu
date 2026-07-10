// Minimal ESLint flat config — enforces the "một cửa" (single-door) UI-import
// rule ONLY. Deliberately enables NO other rulesets: this codebase has never
// been linted, so a recommended ruleset would surface an unrelated storm of
// pre-existing findings. The single job here is to prevent apps from importing
// a UI library directly instead of going through @cmc/ui.
//
// Scope: apps/admin/** (Phase 3) + apps/lms/** (Phase 4) — both fully migrated
// to Astryx, so the one-door rule now guards both apps.
//
// Whitelist: each app's src/main.tsx is fully exempt (the one entry allowed to
// import design-system CSS/reset + providers directly — red-team F14: reset.css
// is app-scoped, not re-exported through @cmc/ui). Note this exempts the whole
// file, not just its CSS imports — main.tsx is hand-reviewed as the single door,
// so a stray component import there would not be caught by this rule.
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
    files: ['apps/admin/**/*.{ts,tsx}', 'apps/lms/**/*.{ts,tsx}'],
    ignores: ['apps/admin/src/main.tsx', 'apps/lms/src/main.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    // Register the plugin so pre-existing `// eslint-disable @typescript-eslint/*`
    // directives in source resolve to a known rule (left OFF here — we enforce
    // only the import rule). Without this, ESLint errors "rule not found".
    plugins: { '@typescript-eslint': tseslint.plugin },
    // Those pre-existing directives suppress rules we don't enforce, so they'd
    // report as "unused" noise — silence that (keeps the authors' intentional
    // suppressions intact for when the rules are later enabled).
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'no-restricted-imports': ['error', BANNED_UI_IMPORTS],
    },
  },
];
