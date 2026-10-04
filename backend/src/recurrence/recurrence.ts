import { addDays } from '../date-utils';

export type RecurrenceType = 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface RecurringTask {
  recurrenceType: RecurrenceType;
  startDate: string;
  endDate?: string | null;
  weekdays?: number[] | null;
  dayOfMonth?: number | null;
}

export function expandTaskDates(task: RecurringTask, from: string, to: string): string[] {
  const first = task.startDate > from ? task.startDate : from;
  const last = task.endDate && task.endDate < to ? task.endDate : to;
  if (first > last || task.startDate > to) return [];

  if (task.recurrenceType === 'once') {
    return task.startDate >= from && task.startDate <= to ? [task.startDate] : [];
  }

  const dates: string[] = [];
  const [startYear, startMonth, startDay] = task.startDate.split('-').map(Number);
  const startTimestamp = Date.UTC(startYear, startMonth - 1, startDay);
  let cursor = first;
  while (cursor <= last) {
    const [year, month, day] = cursor.split('-').map(Number);
    const weekdayMondayFirst = ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
    const daysFromStart = (Date.UTC(year, month - 1, day) - startTimestamp) / 86_400_000;
    const shouldInclude =
      task.recurrenceType === 'daily' ||
      (task.recurrenceType === 'weekly' && (task.weekdays ?? []).includes(weekdayMondayFirst)) ||
      // Keep the two-week cadence tied to the task's original start date.
      (task.recurrenceType === 'biweekly' && daysFromStart % 14 === 0) ||
      // Clamp dates such as the 31st to the final day of shorter months.
      (task.recurrenceType === 'monthly' &&
        day === Math.min(task.dayOfMonth ?? day, new Date(Date.UTC(year, month, 0)).getUTCDate()));
    if (shouldInclude) dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}
