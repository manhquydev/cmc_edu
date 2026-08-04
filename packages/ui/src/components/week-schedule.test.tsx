import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WeekSchedule } from './week-schedule.js';

describe('WeekSchedule', () => {
  it('renders day headers and session titles', () => {
    render(
      <MemoryRouter>
        <WeekSchedule
          days={[
            {
              key: 'mon',
              weekday: 'T2',
              dayNum: '3',
              sessions: [{ title: 'ENG-A1', status: 'active' }],
            },
            { key: 'tue', weekday: 'T3', dayNum: '4', isToday: true, sessions: [] },
            { key: 'wed', weekday: 'T4', dayNum: '5', sessions: [] },
            { key: 'thu', weekday: 'T5', dayNum: '6', sessions: [] },
            { key: 'fri', weekday: 'T6', dayNum: '7', sessions: [] },
            { key: 'sat', weekday: 'T7', dayNum: '8', isWeekend: true, sessions: [] },
            { key: 'sun', weekday: 'CN', dayNum: '9', isWeekend: true, sessions: [] },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('T2')).toBeInTheDocument();
    expect(screen.getByText('ENG-A1')).toBeInTheDocument();
    expect(screen.getByLabelText('Lịch tuần')).toBeInTheDocument();
  });
});
