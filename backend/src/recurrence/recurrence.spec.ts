import { expandTaskDates } from './recurrence';

describe('expandTaskDates', () => {
  it('expands selected weekdays Monday-first', () => {
    expect(
      expandTaskDates(
        { recurrenceType: 'weekly', startDate: '2026-09-01', weekdays: [1, 3, 5] },
        '2026-09-01',
        '2026-09-07',
      ),
    ).toEqual(['2026-09-02', '2026-09-04', '2026-09-07']);
  });

  it('repeats every 14 days from the task start date', () => {
    expect(
      expandTaskDates(
        { recurrenceType: 'biweekly', startDate: '2026-10-01' },
        '2026-10-01',
        '2026-10-31',
      ),
    ).toEqual(['2026-10-01', '2026-10-15', '2026-10-29']);
  });

  it('clamps monthly day 31 to the final day of each month', () => {
    expect(
      expandTaskDates(
        { recurrenceType: 'monthly', startDate: '2026-01-31', dayOfMonth: 31 },
        '2026-02-01',
        '2026-04-30',
      ),
    ).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('respects inclusive start and end dates', () => {
    expect(
      expandTaskDates(
        { recurrenceType: 'daily', startDate: '2026-09-01', endDate: '2026-09-03' },
        '2026-09-02',
        '2026-09-05',
      ),
    ).toEqual(['2026-09-02', '2026-09-03']);
  });

  it('returns one-off tasks only on their start date', () => {
    expect(expandTaskDates({ recurrenceType: 'once', startDate: '2026-09-03' }, '2026-09-01', '2026-09-10'))
      .toEqual(['2026-09-03']);
  });
});
