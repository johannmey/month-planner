import {
  addMonths,
  addWeeks,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  subMonths,
  subWeeks,
} from 'date-fns';
import type { Occurrence, Task } from '../api';
import { defaultTaskColor, weekdayLabels } from '../planner/constants';
import type {
  CalendarView,
  DayDropProps,
  OccurrenceDrag,
  TaskDragHandleProps,
  TaskDropProps,
} from '../planner/types';

interface CalendarProps {
  currentDate: Date;
  days: Date[];
  month: Date;
  periodTitle: string;
  view: CalendarView;
  tasks: Task[];
  occurrencesByDate: Map<string, Occurrence[]>;
  isLoading: boolean;
  loadError: string | null;
  dropTargetDate: string | null;
  onViewChange: (view: CalendarView) => void;
  onToday: () => void;
  onNavigate: (date: Date) => void;
  onOpenDay: (date: string) => void;
  onSetDone: (occurrence: Occurrence, done: boolean) => void;
  isDraggingOccurrence: (occurrence: Occurrence) => boolean;
  taskDragHandleProps: (occurrence: OccurrenceDrag) => TaskDragHandleProps;
  taskDropProps: (taskId: string, targetDate?: string) => TaskDropProps;
  dayDropProps: (date: string) => DayDropProps;
}

export function Calendar({
  currentDate,
  days,
  month,
  periodTitle,
  view,
  tasks,
  occurrencesByDate,
  isLoading,
  loadError,
  dropTargetDate,
  onViewChange,
  onToday,
  onNavigate,
  onOpenDay,
  onSetDone,
  isDraggingOccurrence,
  taskDragHandleProps,
  taskDropProps,
  dayDropProps,
}: CalendarProps) {
  const monthStart = startOfMonth(currentDate);

  return (
    <section
      className="calendar-card"
      aria-label={view === 'week' ? 'Weekly calendar' : 'Monthly calendar'}
    >
      <div className="calendar-toolbar">
        <div className="month-title">
          <h2>{periodTitle}</h2>
          <span>{tasks.length} {tasks.length === 1 ? 'routine' : 'routines'} in your planner</span>
        </div>
        <div className="month-actions">
          <div className="view-switch" role="group" aria-label="Calendar view">
            <button type="button" aria-pressed={view === 'month'} onClick={() => onViewChange('month')}>
              Month
            </button>
            <button type="button" aria-pressed={view === 'week'} onClick={() => onViewChange('week')}>
              Week
            </button>
          </div>
          <button type="button" className="today-button" onClick={onToday}>Today</button>
          <button
            type="button"
            className="icon-button"
            aria-label={view === 'week' ? 'Previous week' : 'Previous month'}
            onClick={() => onNavigate(view === 'week'
              ? subWeeks(currentDate, 1)
              : startOfMonth(subMonths(monthStart, 1)))}
          >
            ‹
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={view === 'week' ? 'Next week' : 'Next month'}
            onClick={() => onNavigate(view === 'week'
              ? addWeeks(currentDate, 1)
              : startOfMonth(addMonths(monthStart, 1)))}
          >
            ›
          </button>
        </div>
      </div>
      <div className="weekday-row">
        {weekdayLabels.map((day) => <div key={day}>{day}</div>)}
      </div>
      {isLoading ? (
        <div className="loading-state">Getting your {view} ready…</div>
      ) : loadError ? (
        <div className="error-state">Couldn't load your planner. {loadError}</div>
      ) : (
        <div className={`calendar-grid${view === 'week' ? ' week-view' : ''}`}>
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const items = occurrencesByDate.get(key) ?? [];
            const visibleItems = view === 'week' ? items : items.slice(0, 5);
            const inMonth = view === 'week' || isSameMonth(day, month);
            return (
              <div
                className={`day-cell${inMonth ? '' : ' outside'}${isToday(day) ? ' current-day' : ''}${dropTargetDate === key ? ' is-drop-target' : ''}`}
                key={key}
                {...dayDropProps(key)}
              >
                <button
                  type="button"
                  className="day-open"
                  onClick={() => onOpenDay(key)}
                  aria-label={`Open ${format(day, 'EEEE, MMMM d')}, ${items.length} tasks`}
                >
                  <span className="day-number">{format(day, 'd')}</span>
                </button>
                <div className="cell-tasks">
                  {visibleItems.map((item) => (
                    <div
                      key={`${item.taskId}-${item.occurrenceDate}`}
                      className={`calendar-task${item.done ? ' is-done' : ''}${item.overdue ? ' is-overdue' : ''}${isDraggingOccurrence(item) ? ' is-dragging' : ''}`}
                      title={item.title}
                      {...taskDropProps(item.taskId, item.date)}
                    >
                      <button
                        type="button"
                        className="task-drag-handle"
                        aria-label={`Drag ${item.title} to move or reorder`}
                        title="Drag to move or reorder"
                        {...taskDragHandleProps(item)}
                      >
                        ⠿
                      </button>
                      <label className="calendar-task-content">
                        <input
                          className="calendar-task-check"
                          type="checkbox"
                          checked={item.done}
                          aria-label={`Mark ${item.title} ${item.done ? 'not done' : 'done'}`}
                          onChange={(event) => onSetDone(item, event.target.checked)}
                        />
                        <span className="task-dot" style={{ backgroundColor: item.color ?? defaultTaskColor }} />
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
                      onClick={() => onOpenDay(key)}
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
        <span><i className="legend-dot today-dot" /> Today</span>
        <span><i className="legend-dot overdue-dot" /> Needs attention</span>
        <span className="footer-hint">Drag tasks to move or reorder · Select a day for details</span>
      </footer>
    </section>
  );
}
