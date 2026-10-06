import { format } from 'date-fns';

export const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const taskColors = ['#d6785f', '#d6a448', '#6b9b83', '#6383b0', '#9a75aa', '#75818a'];
export const defaultTaskColor = taskColors[0];
export const themeStorageKey = 'month-planner-theme';

export function todayDateKey(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function weekOfMonthFromDate(dateKey: string): number {
  return Math.floor((Number(dateKey.slice(-2)) - 1) / 7) + 1;
}

export function weekdayFromDate(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
}
