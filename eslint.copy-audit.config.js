// Config AUDIT riêng — sinh worklist "định danh nội bộ trong chuỗi hiển thị".
// KHÔNG phải config chính: không được `pnpm lint`, lint-staged, hay CI tham
// chiếu. Rule ở đây land vào eslint.config.js chỉ ở Phase 5 của
// plans/260805-1153-chuan-hoa-tu-ngu-ui-frontend/, sau khi vi phạm đã dọn sạch.
//
// Chạy: npx eslint --config eslint.copy-audit.config.js apps/admin apps/lms -f json
import tseslint from 'typescript-eslint';

const INTERNAL_IDENTIFIER_PATTERN =
  'SettingsShell|FullCalendar|ConsoleEmailTransport|auth identity|super_admin' +
  '|AI agent|ai:recon|\\bCRUD\\b|testAppointment\\.|finance\\.refundCreate' +
  '|\\bEntity\\b|API .{0,40}chưa khả dụng';

export default [
  {
    files: ['apps/admin/**/*.{ts,tsx}', 'apps/lms/**/*.{ts,tsx}'],
    ignores: [
      'apps/admin/src/pages/design-lab.tsx',
      'apps/admin/src/pages/design-lab-wireframes.tsx',
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    // Registers the plugin so pre-existing eslint-disable directives resolve
    // to a known rule — without this, ESLint errors "Definition for rule not
    // found" on files that already suppress @typescript-eslint/* rules.
    plugins: { '@typescript-eslint': tseslint.plugin },
    // Those pre-existing directives suppress rules this audit config doesn't
    // enforce, so they'd report as "unused" noise on top of real findings —
    // silence that (mirrors eslint.config.js:47).
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `JSXAttribute[name.name=/^(title|subtitle|description|label|message|hint)$/] > Literal[value=/${INTERNAL_IDENTIFIER_PATTERN}/]`,
          message: 'internal-identifier-in-user-facing-string',
        },
      ],
    },
  },
];
