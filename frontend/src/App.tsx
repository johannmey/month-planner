import { useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, Occurrence, RecurrenceType, Task, TaskInput } from './api';

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const colors = ['#d6785f', '#d6a448', '#6b9b83', '#6383b0', '#9a75aa', '#75818a'];
const today = () => format(new Date(), 'yyyy-MM-dd');

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [actionError, setActionError] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  function closeModal() {
    setEditing(null);
    setIsModalClosing(true);
  }

  useEffect(() => {
    if (!selectedDate) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDate]);

  const queryClient = useQueryClient();
  const month = startOfMonth(currentDate);
  const gridStart = view === 'week'
    ? startOfWeek(currentDate, { weekStartsOn: 1 })
    : startOfWeek(month, { weekStartsOn: 1 });
  const gridEnd = view === 'week'
    ? endOfWeek(currentDate, { weekStartsOn: 1 })
    : endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const from = format(gridStart, 'yyyy-MM-dd');
  const to = format(gridEnd, 'yyyy-MM-dd');
  const periodTitle = view === 'week'
    ? gridStart.getFullYear() === gridEnd.getFullYear()
      ? `${format(gridStart, 'MMM d')} – ${format(gridEnd, 'MMM d, yyyy')}`
      : `${format(gridStart, 'MMM d, yyyy')} – ${format(gridEnd, 'MMM d, yyyy')}`
    : format(month, 'MMMM yyyy');
  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: api.tasks });
  const occurrencesQuery = useQuery({
    queryKey: ['occurrences', from, to],
    queryFn: () => api.occurrences(from, to),
  });
  const selectedQuery = useQuery({
    queryKey: ['skipped', selectedDate],
    queryFn: () => api.skipped(selectedDate!),
    enabled: selectedDate !== null,
  });
  const occurrences = occurrencesQuery.data ?? [];
  const byDate = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const item of occurrences) map.set(item.date, [...(map.get(item.date) ?? []), item]);
    return map;
  }, [occurrences]);
  const selectedOccurrences = selectedDate ? byDate.get(selectedDate) ?? [] : [];
  const updateQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['occurrences'] }),
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['skipped', selectedDate] }),
    ]);
  };
  const doneMutation = useMutation({
    mutationFn: ({ occurrence, done }: {
      occurrence: Occurrence;
      done: boolean
    }) =>
      api.setDone(occurrence.taskId, occurrence.date, done),
    onSuccess: updateQueries,
    onError: (error) => setActionError(error.message),
  });
  const skipMutation = useMutation({
    mutationFn: ({ taskId, date, skipped }: {
      taskId: string;
      date: string;
      skipped: boolean
    }) =>
      api.setSkipped(taskId, date, skipped),
    onSuccess: async () => {
      setActionError('');
      await updateQueries();
    },
    onError: (error) => setActionError(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: api.deleteTask,
    onSuccess: async () => {
      setActionError('');
      await updateQueries();
    },
    onError: (error) => setActionError(error.message),
  });
  const saveMutation = useMutation({
    mutationFn: ({ input, taskId }: { input: TaskInput; taskId?: string }) =>
      taskId ? api.updateTask(taskId, input) : api.createTask(input),
    onSuccess: async (_task, variables) => {
      setActionError('');
      await updateQueries();
      setEditing(null);
      if (!variables.taskId) closeModal();
    },
    onError: (error) => setActionError(error.message),
  });
  const reorderMutation = useMutation({
    mutationFn: api.reorderTasks,
    onSuccess: async () => {
      setActionError('');
      await updateQueries();
    },
    onError: (error) => setActionError(error.message),
  });

  function saveTask(input: TaskInput, taskId?: string) {
    setActionError('');
    saveMutation.mutate({ input, taskId });
  }

  function openModal(date: string) {
    setSelectedDate(date);
    setEditing(null);
    setActionError('');
    setIsModalClosing(false);
  }

  function openDay(date: string) {
    setCurrentDate(parseISO(date));
    openModal(date);
  }

  const tasks = tasksQuery.data ?? [];
  const isLoading = tasksQuery.isPending || occurrencesQuery.isPending;

  function reorderTask(sourceId: string, targetId: string) {
    if (sourceId === targetId || reorderMutation.isPending) return;
    const taskIds = tasks.map(({ id }) => id);
    const sourceIndex = taskIds.indexOf(sourceId);
    const targetIndex = taskIds.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    taskIds.splice(sourceIndex, 1);
    taskIds.splice(targetIndex, 0, sourceId);
    setActionError('');
    reorderMutation.mutate(taskIds);
  }

  function taskDragHandleProps(taskId: string) {
    return {
      draggable: tasks.length > 1 && !reorderMutation.isPending,
      onDragStart: (event: React.DragEvent<HTMLElement>) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', taskId);
        setDraggedTaskId(taskId);
      },
      onDragEnd: () => setDraggedTaskId(null),
    };
  }

  function taskDropProps(taskId: string) {
    return {
      onDragOver: (event: React.DragEvent<HTMLElement>) => {
        if (draggedTaskId && draggedTaskId !== taskId) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }
      },
      onDrop: (event: React.DragEvent<HTMLElement>) => {
        event.preventDefault();
        const sourceId = event.dataTransfer.getData('text/plain') || draggedTaskId;
        if (sourceId) reorderTask(sourceId, taskId);
      },
    };
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Month Planner home">
          <span className="brand-mark">M</span><span>month<span
          className="brand-light">planner</span></span>
        </a>
      </header>

      <section className="workspace">
        <div className="page-heading">
          <button className="primary-button" onClick={() => openModal(today())}>
            <span className="plus">+</span> Add a task
          </button>
        </div>

        <section className="calendar-card"
                 aria-label={view === 'week' ? 'Weekly calendar' : 'Monthly calendar'}>
          <div className="calendar-toolbar">
            <div className="month-title">
              <h2>{periodTitle}</h2>
              <span>{tasks.length} {tasks.length === 1 ? 'routine' : 'routines'} in your planner</span>
            </div>
            <div className="month-actions">
              <div className="view-switch" role="group" aria-label="Calendar view">
                <button type="button" aria-pressed={view === 'month'}
                        onClick={() => setView('month')}>Month</button>
                <button type="button" aria-pressed={view === 'week'}
                        onClick={() => setView('week')}>Week</button>
              </div>
              <button className="today-button"
                      onClick={() => setCurrentDate(new Date())}>Today
              </button>
              <button className="icon-button"
                      aria-label={view === 'week' ? 'Previous week' : 'Previous month'}
                      onClick={() => setCurrentDate(view === 'week'
                        ? subWeeks(currentDate, 1)
                        : startOfMonth(subMonths(month, 1)))}>‹
              </button>
              <button className="icon-button"
                      aria-label={view === 'week' ? 'Next week' : 'Next month'}
                      onClick={() => setCurrentDate(view === 'week'
                        ? addWeeks(currentDate, 1)
                        : startOfMonth(addMonths(month, 1)))}>›
              </button>
            </div>
          </div>
          <div className="weekday-row">{weekdayLabels.map((day) => <div
            key={day}>{day}</div>)}</div>
          {isLoading ? (
            <div className="loading-state">Getting your {view} ready…</div>
          ) : occurrencesQuery.isError || tasksQuery.isError ? (
            <div className="error-state">Couldn't load your
              planner. {String(occurrencesQuery.error ?? tasksQuery.error)}</div>
          ) : (
            <div className={`calendar-grid${view === 'week' ? ' week-view' : ''}`}>
              {days.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const items = byDate.get(key) ?? [];
                const visibleItems = view === 'week' ? items : items.slice(0, 5);
                const inMonth = view === 'week' || isSameMonth(day, month);
                return (
                  <div
                    className={`day-cell${inMonth ? '' : ' outside'}${isToday(day) ? ' current-day' : ''}`}
                    key={key}
                  >
                    <button
                      type="button"
                      className="day-open"
                      onClick={() => openDay(key)}
                      aria-label={`Open ${format(day, 'EEEE, MMMM d')}, ${items.length} tasks`}
                    >
                      <span className="day-number">{format(day, 'd')}</span>
                    </button>
                    <div className="cell-tasks">
                      {visibleItems.map((item) => (
                        <div
                          key={`${item.taskId}-${item.date}`}
                          className={`calendar-task${item.done ? ' is-done' : ''}${item.overdue ? ' is-overdue' : ''}${draggedTaskId === item.taskId ? ' is-dragging' : ''}`}
                          title={item.title}
                          {...taskDropProps(item.taskId)}
                        >
                          <button
                            type="button"
                            className="task-drag-handle"
                            aria-label={`Drag ${item.title} to reorder`}
                            title="Drag to reorder"
                            {...taskDragHandleProps(item.taskId)}
                          >⠿</button>
                          <label className="calendar-task-content">
                            <input
                              className="calendar-task-check"
                              type="checkbox"
                              checked={item.done}
                              aria-label={`Mark ${item.title} ${item.done ? 'not done' : 'done'}`}
                              onChange={(event) => {
                                setActionError('');
                                doneMutation.mutate({
                                  occurrence: item,
                                  done: event.target.checked,
                                });
                              }}
                            />
                            <span className="task-dot"
                                  style={{ backgroundColor: item.color ?? colors[0] }}/>
                            <span className="task-label">{item.title}</span>
                          </label>
                        </div>
                      ))}
                      {view === 'month' && items.length > 5 && (
                        <button
                          type="button"
                          className="more-tasks"
                          aria-label={`See all ${items.length} tasks for ${format(day, 'MMMM d')}`}
                          title={`See all ${items.length} tasks`}
                          onClick={() => openDay(key)}
                        >
                          <span className="more-full">See all {items.length} tasks</span>
                          <span className="more-compact">+{items.length - 5} more</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <footer className="calendar-footer">
            <span><i className="legend-dot today-dot"/> Today</span>
            <span><i className="legend-dot overdue-dot"/> Needs attention</span>
            <span className="footer-hint">Drag tasks to reorder · Select a day for details</span>
          </footer>
        </section>
      </section>

      {actionError &&
        <div className="global-error" role="alert">{actionError}</div>}

      {selectedDate && (
        <div className={`overlay${isModalClosing ? ' is-closing' : ''}`}
             role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeModal();
          }
        }}>
          <section className="day-panel" role="dialog" aria-modal="true"
                   aria-labelledby="panel-title"
                   onAnimationEnd={(event) => {
                     if (event.target === event.currentTarget && isModalClosing) {
                       setSelectedDate(null);
                       setIsModalClosing(false);
                     }
                   }}>
            <button className="close-button" aria-label="Close details"
                    onClick={closeModal}>×
            </button>
            <p
              className="eyebrow">{format(parseISO(selectedDate), 'EEEE').toUpperCase()}</p>
            <h2
              id="panel-title">{format(parseISO(selectedDate), 'MMMM d, yyyy')}</h2>
            {editing ? (
              <TaskForm task={editing} date={selectedDate}
                        onCancel={() => setEditing(null)}
                        onSave={(input) => saveTask(input, editing.id)}/>
            ) : (
              <>
                <div className="panel-section-heading">
                  <h3>Today’s tasks</h3>
                  <span>{selectedOccurrences.length}</span>
                </div>
                {selectedOccurrences.length === 0 ? (
                  <div className="empty-state"><span
                    className="empty-icon">☼</span><strong>A little breathing
                    room.</strong><span>Nothing planned for this day yet.</span>
                  </div>
                ) : (
                  <div className="occurrence-list">
                    {selectedOccurrences.map((item) => {
                      const task = tasks.find(({ id }) => id === item.taskId);
                      return (
                        <article
                          className={`occurrence-card${item.overdue ? ' overdue-card' : ''}${draggedTaskId === item.taskId ? ' is-dragging' : ''}`}
                          {...taskDropProps(item.taskId)}
                          key={`${item.taskId}-${item.date}`}>
                          <div className="occurrence-heading">
                            <button
                              type="button"
                              className="task-drag-handle"
                              aria-label={`Drag ${item.title} to reorder`}
                              title="Drag to reorder"
                              {...taskDragHandleProps(item.taskId)}
                            >⠿</button>
                            <label className="check-row">
                              <input
                                type="checkbox"
                                checked={item.done}
                                onChange={(event) => doneMutation.mutate({
                                  occurrence: item,
                                  done: event.target.checked,
                                })}
                              />
                              <span className="custom-check"/>
                              <span
                                className={`occurrence-title${item.done ? ' completed-title' : ''}`}>{item.title}</span>
                            </label>
                          </div>
                          <span className="occurrence-category"><i
                            style={{ backgroundColor: item.color ?? colors[0] }}/>{task?.recurrenceType ?? 'task'}</span>
                          {item.notes &&
                            <p className="occurrence-notes">{item.notes}</p>}
                          <div className="card-actions">
                            <button onClick={() => setEditing(task ?? null)}
                                    disabled={!task}>Edit series
                            </button>
                            <button onClick={() => skipMutation.mutate({
                              taskId: item.taskId,
                              date: item.date,
                              skipped: true,
                            })}>Skip today
                            </button>
                            <button className="delete-action" onClick={() => {
                              if (window.confirm('Delete this task and its entire series?')) deleteMutation.mutate(item.taskId);
                            }}>Delete
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
                {(selectedQuery.data?.length ?? 0) > 0 && (
                  <>
                    <div className="panel-section-heading skipped-heading">
                      <h3>Skipped today</h3>
                      <span>{selectedQuery.data!.length}</span></div>
                    {selectedQuery.data!.map((item) => (
                      <div className="skipped-row" key={item.taskId}>
                        <span><i
                          style={{ backgroundColor: item.color ?? colors[0] }}/>{item.title}</span>
                        <button onClick={() => skipMutation.mutate({
                          taskId: item.taskId,
                          date: selectedDate,
                          skipped: false,
                        })}>Restore
                        </button>
                      </div>
                    ))}
                  </>
                )}
                <TaskForm date={selectedDate}
                          onCancel={closeModal}
                          onSave={(input) => saveTask(input)} compact/>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

interface TaskFormProps {
  date: string;
  task?: Task;
  compact?: boolean;
  onCancel: () => void;
  onSave: (input: TaskInput) => void;
}

function TaskForm({
                    date,
                    task,
                    compact = false,
                    onCancel,
                    onSave,
                  }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [color, setColor] = useState(task?.color ?? colors[0]);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(task?.recurrenceType ?? 'once');
  const [startDate, setStartDate] = useState(task?.startDate ?? date);
  const [endDate, setEndDate] = useState(task?.endDate ?? '');
  const [dayOfMonth, setDayOfMonth] = useState(String(task?.dayOfMonth ?? Number(date.slice(-2))));
  const [selectedDays, setSelectedDays] = useState<number[]>(task?.weekdays ?? []);
  const [error, setError] = useState('');

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (recurrenceType === 'weekly' && selectedDays.length === 0) {
      setError('Select at least one weekday.');
      return;
    }
    const input: TaskInput = {
      title: title.trim(),
      notes: notes.trim() || null,
      color: color || null,
      recurrenceType,
      startDate,
      endDate: endDate || null,
      weekdays: recurrenceType === 'weekly' ? selectedDays.sort() : null,
      dayOfMonth: recurrenceType === 'monthly' ? Number(dayOfMonth) : null,
    };
    onSave(input);
  }

  return (
    <form className={`task-form${compact ? ' compact-form' : ''}`}
          onSubmit={submit}>
      <div className="form-title-row">
        <h3>{task ? 'Edit task series' : 'Add a task'}</h3>{task &&
        <button type="button" className="text-button"
                onClick={onCancel}>Cancel</button>}</div>
      <label className="field-label">Task name<input autoFocus={!compact}
                                                     maxLength={160} required
                                                     value={title}
                                                     onChange={(event) => setTitle(event.target.value)}
                                                     placeholder="e.g. Water the plants"/></label>
      <label className="field-label">Notes <span
        className="optional-label">Optional</span><textarea maxLength={2000}
                                                            rows={2}
                                                            value={notes}
                                                            onChange={(event) => setNotes(event.target.value)}
                                                            placeholder="Anything helpful to remember…"/></label>
      <label className="field-label">Repeat
        <select value={recurrenceType}
                onChange={(event) => setRecurrenceType(event.target.value as RecurrenceType)}>
          <option value="once">Just once</option>
          <option value="daily">Every day</option>
          <option value="weekly">Every week</option>
          <option value="biweekly">Every two weeks</option>
          <option value="monthly">Every month</option>
        </select>
      </label>
      {recurrenceType === 'weekly' && (
        <div className="weekday-picker" aria-label="Choose weekdays">
          {weekdayLabels.map((label, index) => {
            const weekday = index + 1;
            return <button type="button" key={weekday}
                           className={selectedDays.includes(weekday) ? 'selected' : ''}
                           onClick={() => setSelectedDays((current) => current.includes(weekday) ? current.filter((day) => day !== weekday) : [...current, weekday])}>{label}</button>;
          })}
        </div>
      )}
      {recurrenceType === 'monthly' &&
        <label className="field-label">Day of month<input type="number" min="1"
                                                          max="31"
                                                          value={dayOfMonth}
                                                          onChange={(event) => setDayOfMonth(event.target.value)}/></label>}
      <div className="date-fields">
        <label className="field-label">Starts<input type="date" required
                                                    value={startDate}
                                                    onChange={(event) => setStartDate(event.target.value)}/></label>
        <label className="field-label">Ends <span
          className="optional-label">Optional</span><input type="date"
                                                           min={startDate}
                                                           value={endDate}
                                                           onChange={(event) => setEndDate(event.target.value)}/></label>
      </div>
      <div className="field-label">Color</div>
      <div className="color-picker">{colors.map((swatch) => <button
        type="button" key={swatch} aria-label={`Select ${swatch} task color`}
        className={color === swatch ? 'active' : ''}
        style={{ backgroundColor: swatch }}
        onClick={() => setColor(swatch)}/>)}</div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="secondary-button"
                onClick={onCancel}>Cancel
        </button>
        <button className="primary-button"
                type="submit">{task ? 'Save changes' : 'Add task'}</button>
      </div>
    </form>
  );
}

export default App;
