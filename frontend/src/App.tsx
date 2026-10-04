import { useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Occurrence, Task, TaskInput } from './api';
import { api } from './api';
import { Calendar } from './components/Calendar';
import { DayPanel } from './components/DayPanel';
import { themeStorageKey, todayDateKey } from './planner/constants';
import type {
  CalendarView,
  DayDropProps,
  OccurrenceDrag,
  TaskDragHandleProps,
  TaskDropProps,
} from './planner/types';

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [isDarkMode, setIsDarkMode] = useState(
    () => window.localStorage.getItem(themeStorageKey) === 'dark',
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [actionError, setActionError] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedOccurrence, setDraggedOccurrence] = useState<OccurrenceDrag | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(themeStorageKey, isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  function closeModal() {
    setEditing(null);
    setIsModalClosing(true);
  }

  useEffect(() => {
    if (!selectedDate) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeModal();
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
  const occurrencesByDate = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const item of occurrences) {
      map.set(item.date, [...(map.get(item.date) ?? []), item]);
    }
    return map;
  }, [occurrences]);
  const selectedOccurrences = selectedDate ? occurrencesByDate.get(selectedDate) ?? [] : [];

  const updateQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['occurrences'] }),
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['skipped', selectedDate] }),
    ]);
  };
  const doneMutation = useMutation({
    mutationFn: ({ occurrence, done }: { occurrence: Occurrence; done: boolean }) =>
      api.setDone(occurrence.taskId, occurrence.occurrenceDate, done),
    onSuccess: updateQueries,
    onError: (error) => setActionError(error.message),
  });
  const skipMutation = useMutation({
    mutationFn: ({ taskId, date, skipped }: {
      taskId: string;
      date: string;
      skipped: boolean
    }) => api.setSkipped(taskId, date, skipped),
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
  const moveMutation = useMutation({
    mutationFn: ({ taskId, occurrenceDate, date }: OccurrenceDrag) =>
      api.moveOccurrence(taskId, occurrenceDate, date),
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
  const loadError = occurrencesQuery.isError || tasksQuery.isError
    ? String(occurrencesQuery.error ?? tasksQuery.error)
    : null;

  function isDraggingOccurrence(occurrence: Occurrence) {
    return draggedOccurrence !== null &&
      draggedOccurrence.taskId === occurrence.taskId &&
      draggedOccurrence.occurrenceDate === occurrence.occurrenceDate;
  }

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

  function taskDragHandleProps(occurrence: OccurrenceDrag): TaskDragHandleProps {
    return {
      draggable: !reorderMutation.isPending && !moveMutation.isPending,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', occurrence.taskId);
        event.dataTransfer.setData('application/x-month-planner-occurrence-date', occurrence.occurrenceDate);
        event.dataTransfer.setData('application/x-month-planner-display-date', occurrence.date);
        setDraggedTaskId(occurrence.taskId);
        setDraggedOccurrence(occurrence);
      },
      onDragEnd: () => {
        setDraggedTaskId(null);
        setDraggedOccurrence(null);
        setDropTargetDate(null);
      },
    };
  }

  function getDraggedOccurrence(event: DragEvent<HTMLElement>): OccurrenceDrag | null {
    const taskId = event.dataTransfer.getData('text/plain') || draggedOccurrence?.taskId;
    if (!taskId) return null;
    const fallback = draggedOccurrence?.taskId === taskId ? draggedOccurrence : null;
    const occurrenceDate =
      event.dataTransfer.getData('application/x-month-planner-occurrence-date') ||
      fallback?.occurrenceDate;
    const date =
      event.dataTransfer.getData('application/x-month-planner-display-date') ||
      fallback?.date;
    return occurrenceDate && date ? { taskId, occurrenceDate, date } : null;
  }

  function dropOccurrenceOnDate(event: DragEvent<HTMLElement>, date: string) {
    event.preventDefault();
    event.stopPropagation();
    setDropTargetDate(null);
    const occurrence = getDraggedOccurrence(event);
    if (!occurrence || occurrence.date === date) return;
    setActionError('');
    moveMutation.mutate({ ...occurrence, date });
  }

  function dayDropProps(date: string): DayDropProps {
    return {
      onDragOver: (event) => {
        if (draggedOccurrence && draggedOccurrence.date !== date) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setDropTargetDate(date);
        }
      },
      onDragLeave: (event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setDropTargetDate(null);
        }
      },
      onDrop: (event) => dropOccurrenceOnDate(event, date),
    };
  }

  function taskDropProps(taskId: string, targetDate?: string): TaskDropProps {
    return {
      onDragOver: (event) => {
        if (
          draggedTaskId &&
          (draggedTaskId !== taskId || (targetDate && draggedOccurrence?.date !== targetDate))
        ) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }
      },
      onDrop: (event) => {
        event.preventDefault();
        event.stopPropagation();
        const occurrence = getDraggedOccurrence(event);
        if (occurrence && targetDate && occurrence.date !== targetDate) {
          setActionError('');
          moveMutation.mutate({ ...occurrence, date: targetDate });
          return;
        }
        const sourceId = occurrence?.taskId ?? draggedTaskId;
        if (sourceId) reorderTask(sourceId, taskId);
      },
    };
  }

  return (
    <main className="app-shell" data-theme={isDarkMode ? 'dark' : 'light'}>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#" aria-label="Month Planner home">
            <span className="brand-mark">M</span>
            <span>month<span className="brand-light">planner</span></span>
          </a>
          <button
            type="button"
            className="theme-toggle"
            aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
            onClick={() => setIsDarkMode((current) => !current)}
          >
            <span aria-hidden="true">{isDarkMode ? '☀' : '☾'}</span>
            {isDarkMode ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </header>

      <section className="workspace">
        <div className="page-heading">
          <button type="button" className="primary-button" onClick={() => openModal(todayDateKey())}>
            <span className="plus">+</span> Add a task
          </button>
        </div>
        <Calendar
          currentDate={currentDate}
          days={days}
          month={month}
          periodTitle={periodTitle}
          view={view}
          tasks={tasks}
          occurrencesByDate={occurrencesByDate}
          isLoading={isLoading}
          loadError={loadError}
          dropTargetDate={dropTargetDate}
          onViewChange={setView}
          onToday={() => setCurrentDate(new Date())}
          onNavigate={setCurrentDate}
          onOpenDay={openDay}
          onSetDone={(occurrence, done) => {
            setActionError('');
            doneMutation.mutate({ occurrence, done });
          }}
          isDraggingOccurrence={isDraggingOccurrence}
          taskDragHandleProps={taskDragHandleProps}
          taskDropProps={taskDropProps}
          dayDropProps={dayDropProps}
        />
      </section>

      {actionError && <div className="global-error" role="alert">{actionError}</div>}

      {selectedDate && (
        <DayPanel
          date={selectedDate}
          isClosing={isModalClosing}
          editing={editing}
          tasks={tasks}
          occurrences={selectedOccurrences}
          skippedOccurrences={selectedQuery.data ?? []}
          onClose={closeModal}
          onClosed={() => {
            setSelectedDate(null);
            setIsModalClosing(false);
          }}
          onEdit={setEditing}
          onSave={saveTask}
          onSetDone={(occurrence, done) => doneMutation.mutate({ occurrence, done })}
          onSkip={(taskId, date, skipped) => skipMutation.mutate({ taskId, date, skipped })}
          onDelete={(taskId) => deleteMutation.mutate(taskId)}
          isDraggingOccurrence={isDraggingOccurrence}
          taskDragHandleProps={taskDragHandleProps}
          taskDropProps={(taskId) => taskDropProps(taskId)}
        />
      )}
    </main>
  );
}

export default App;
