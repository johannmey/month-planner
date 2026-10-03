export type RecurrenceType =
  'once'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly';

export interface Task {
  id: string;
  sortOrder: number;
  title: string;
  notes: string | null;
  color: string | null;
  recurrenceType: RecurrenceType;
  startDate: string;
  endDate: string | null;
  weekdays: number[] | null;
  dayOfMonth: number | null;
}

export interface Occurrence {
  taskId: string;
  date: string;
  occurrenceDate: string;
  title: string;
  notes: string | null;
  color: string | null;
  done: boolean;
  overdue: boolean;
}

export interface SkippedOccurrence {
  taskId: string;
  occurrenceDate: string;
  title: string;
  color: string | null;
}

export type TaskInput = Omit<Task, 'id' | 'sortOrder'>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as {
      message?: string | string[]
    } | null;
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new Error(message || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  tasks: () => request<Task[]>('/tasks'),
  occurrences: (from: string, to: string) =>
    request<Occurrence[]>(`/occurrences?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  skipped: (date: string) => request<SkippedOccurrence[]>(`/skips?date=${encodeURIComponent(date)}`),
  createTask: (task: TaskInput) => request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  }),
  updateTask: (id: string, task: Partial<TaskInput>) =>
    request<Task>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(task),
    }),
  reorderTasks: (taskIds: string[]) => request<Task[]>('/tasks/order', {
    method: 'PUT',
    body: JSON.stringify({ taskIds }),
  }),
  deleteTask: (id: string) => request<{
    deleted: boolean
  }>(`/tasks/${id}`, { method: 'DELETE' }),
  setDone: (id: string, date: string, done: boolean) =>
    request(`/tasks/${id}/completions/${date}`, { method: done ? 'PUT' : 'DELETE' }),
  setSkipped: (id: string, date: string, skipped: boolean) =>
    request(`/tasks/${id}/skips/${date}`, { method: skipped ? 'PUT' : 'DELETE' }),
  moveOccurrence: (id: string, occurrenceDate: string, date: string) =>
    request<{ moved: true }>(`/tasks/${id}/occurrences/${occurrenceDate}/move`, {
      method: 'PUT',
      body: JSON.stringify({ date }),
    }),
};
