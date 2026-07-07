// CMC Mantine theme — single source of brand values (mirrors tokens.css).
// Color palette derives from the same design decisions as --cmc-brand (#0071e3).
// Do NOT hardcode these values in component files; import cmcTheme instead.

import { createTheme } from '@mantine/core';
import type { MantineThemeOverride } from '@mantine/core';

export const cmcTheme: MantineThemeOverride = createTheme({
  primaryColor: 'blue',
  primaryShade: 6,
  // 10-stop palette: index 6 = #0071e3 (matches --cmc-brand in tokens.css).
  colors: {
    blue: [
      '#e8f1fc',
      '#c5d9f7',
      '#9dbef1',
      '#74a2eb',
      '#4d88e4',
      '#2a70db',
      '#0071e3',
      '#005bc0',
      '#00449d',
      '#002d7a',
    ],
  },
  defaultRadius: 'xs',
  radius: { xs: '4px', sm: '6px', md: '8px', lg: '12px', xl: '16px' },
  fontFamily: 'var(--cmc-font-sans)',
  fontSizes: { xs: '11px', sm: '13px', md: '14px', lg: '16px', xl: '18px' },
  components: {
    Button: { defaultProps: { radius: 'xs' } },
    TextInput: { defaultProps: { radius: 'xs' } },
    Select: { defaultProps: { radius: 'xs' } },
    Table: { defaultProps: { striped: false, highlightOnHover: true } },
  },
});
