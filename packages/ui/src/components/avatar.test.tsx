import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from './avatar.js';

describe('Avatar', () => {
  it('shows initials from name', () => {
    render(<Avatar name="Nguyễn Văn A" />);
    expect(screen.getByLabelText('Nguyễn Văn A').textContent).toContain('NA');
  });
});
