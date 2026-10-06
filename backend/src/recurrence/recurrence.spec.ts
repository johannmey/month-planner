import { expandTaskDates, getMonthlyRecurrencePattern } from './recurrence';

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

  it('repeats on the selected ordinal weekday each month', () => {
    expect(
      expandTaskDates(
        {
          recurrenceType: 'monthly',
          startDate: '2026-10-01',
          weekOfMonth: 2,
          weekdayOfMonth: 6,
        },
        '2026-10-01',
        '2026-12-31',
      ),
    ).toEqual(['2026-10-10', '2026-11-14', '2026-12-12']);
  });

  it('skips months without the selected fifth weekday', () => {
    expect(
      expandTaskDates(
        {
          recurrenceType: 'monthly',
          startDate: '2026-01-01',
          weekOfMonth: 5,
          weekdayOfMonth: 6,
        },
        '2026-02-01',
        '2026-05-31',
      ),
    ).toEqual(['2026-05-30']);
  });

  it('infers a weekday pattern for existing day-of-month schedules', () => {
    expect(
      getMonthlyRecurrencePattern({
        startDate: '2026-09-20',
        dayOfMonth: 10,
      }),
    ).toEqual({ weekOfMonth: 2, weekdayOfMonth: 6 });
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
