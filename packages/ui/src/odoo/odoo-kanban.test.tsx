import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { KanbanBoard, KanbanColumn, KanbanCard } from './odoo-kanban.js';

describe('KanbanBoard / KanbanColumn / KanbanCard', () => {
  it('renders columns and cards with titles', () => {
    const { getByText, container } = render(
      <KanbanBoard>
        <KanbanColumn title="Draft" count={1}>
          <KanbanCard title="Nguyễn A" subtitle="English A2" footer="1.000.000 đ" colorIndex={1} />
        </KanbanColumn>
        <KanbanColumn title="Done">
          <KanbanCard title="Trần B" colorIndex={6} />
        </KanbanColumn>
      </KanbanBoard>,
    );
    expect(container.querySelector('.o-kanban-board')).toBeInTheDocument();
    expect(container.querySelectorAll('.o-kanban-col-body')).toHaveLength(2);
    expect(getByText('Draft')).toBeInTheDocument();
    expect(getByText('Nguyễn A')).toBeInTheDocument();
    expect(getByText('English A2')).toBeInTheDocument();
    expect(getByText('1.000.000 đ')).toBeInTheDocument();
    expect(getByText('Done')).toBeInTheDocument();
    expect(getByText('Trần B')).toBeInTheDocument();
  });

  it('sets the kanban color CSS variable from colorIndex', () => {
    const { container } = render(
      <KanbanCard title="X" colorIndex={4} />,
    );
    const card = container.querySelector('.o-kanban-card') as HTMLElement;
    expect(card.style.getPropertyValue('--odoo-kanban-card-color')).toBe(
      'var(--odoo-kanban-color-4)',
    );
  });

  it('fires onClick when the card is interactive', () => {
    const onClick = vi.fn();
    const { getByText } = render(<KanbanCard title="Click me" onClick={onClick} />);
    fireEvent.click(getByText('Click me'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults column count from child cards when count is omitted', () => {
    const { container } = render(
      <KanbanColumn title="Col">
        <KanbanCard title="A" />
        <KanbanCard title="B" />
      </KanbanColumn>,
    );
    expect(container.querySelector('.o-kanban-col-count')).toHaveTextContent('2');
  });
});
