import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state.js';

describe('EmptyState', () => {
  const defaultIcons = [
    ['first-run', 'plus'],
    ['filtered', 'search'],
    ['done', 'check-circle'],
    ['error', 'alert'],
  ] as const;

  it.each(defaultIcons)('uses the default %s icon', (kind, iconName) => {
    const { container } = render(<EmptyState title="Trống" kind={kind} />);

    expect(container.querySelector(`svg[data-icon="${iconName}"]`)).toBeInTheDocument();
  });

  it('prefers an explicit icon over the kind default', () => {
    const { container, getByTestId } = render(
      <EmptyState
        title="Trống"
        kind="error"
        icon={<span data-testid="explicit-icon">Riêng</span>}
      />,
    );

    expect(getByTestId('explicit-icon')).toBeInTheDocument();
    expect(container.querySelector('svg[data-icon="alert"]')).not.toBeInTheDocument();
  });
});
