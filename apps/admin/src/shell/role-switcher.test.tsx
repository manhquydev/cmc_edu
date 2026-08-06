// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleSwitcher } from './role-switcher.js';

const source = readFileSync(resolve(process.cwd(), 'src/shell/role-switcher.tsx'), 'utf8');

describe('RoleSwitcher', () => {
  it('renders the dev selector in non-production unit tests', () => {
    render(<RoleSwitcher />);
    expect(screen.getByText('Dev:')).toBeInTheDocument();
    expect(screen.getByLabelText('Dev role')).toBeInTheDocument();
  });

  it('source-gates the component with import.meta.env.PROD early return', () => {
    // Vite inlines PROD at build time — unit tests always run DEV. Contract-
    // test the production null path so it cannot be deleted silently.
    expect(source).toMatch(/if\s*\(\s*import\.meta\.env\.PROD\s*\)\s*return\s+null/);
  });
});
