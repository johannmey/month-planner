import { addDays } from '../date-utils';

export type RecurrenceType = 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface RecurringTask {
  recurrenceType: RecurrenceType;
  startDate: string;
  endDate?: string | null;
  weekdays?: number[] | null;
  dayOfMonth?: number | null;
  weekOfMonth?: number | null;
  weekdayOfMonth?: number | null;
}

export interface MonthlyRecurrencePattern {
  weekOfMonth: number;
  weekdayOfMonth: number;
}

export function getMonthlyRecurrencePattern(
  task: Pick<RecurringTask, 'startDate' | 'dayOfMonth' | 'weekOfMonth' | 'weekdayOfMonth'>,
): MonthlyRecurrencePattern {
  if (task.weekOfMonth != null && task.weekdayOfMonth != null) {
    return { weekOfMonth: task.weekOfMonth, weekdayOfMonth: task.weekdayOfMonth };
  }

  // Convert older day-of-month schedules using their first scheduled date after the series starts.
  const [startYear, startMonth, startDay] = task.startDate.split('-').map(Number);
  const requestedDay = Math.max(1, Math.min(task.dayOfMonth ?? startDay, 31));
  let year = startYear;
  let month = startMonth;
  let day = Math.min(requestedDay, new Date(Date.UTC(year, month, 0)).getUTCDate());
  let candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  if (candidate < task.startDate) {
    const nextMonth = new Date(Date.UTC(year, month, 1));
    year = nextMonth.getUTCFullYear();
    month = nextMonth.getUTCMonth() + 1;
    day = Math.min(requestedDay, new Date(Date.UTC(year, month, 0)).getUTCDate());
  }

  const weekdayMondayFirst =
    ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
  return {
    weekOfMonth: Math.floor((day - 1) / 7) + 1,
    weekdayOfMonth: weekdayMondayFirst,
  };
}

export function expandTaskDates(task: RecurringTask, from: string, to: string): string[] {
  const first = task.startDate > from ? task.startDate : from;
  const last = task.endDate && task.endDate < to ? task.endDate : to;
  if (first > last || task.startDate > to) return [];

  if (task.recurrenceType === 'once') {
    return task.startDate >= from && task.startDate <= to ? [task.startDate] : [];
  }

  const dates: string[] = [];
  const monthlyPattern = task.recurrenceType === 'monthly'
    ? getMonthlyRecurrencePattern(task)
    : null;
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
      (task.recurrenceType === 'monthly' &&
        monthlyPattern?.weekOfMonth === Math.floor((day - 1) / 7) + 1 &&
        monthlyPattern.weekdayOfMonth === weekdayMondayFirst);
    if (shouldInclude) dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}
