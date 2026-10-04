import { format, parseISO } from 'date-fns';
import type { AnimationEvent } from 'react';
import type { Occurrence, SkippedOccurrence, Task, TaskInput } from '../api';
import { TaskForm } from './TaskForm';
import { defaultTaskColor } from '../planner/constants';
import type { OccurrenceDrag, TaskDragHandleProps, TaskDropProps } from '../planner/types';

interface DayPanelProps {
  date: string;
  isClosing: boolean;
  editing: Task | null;
  tasks: Task[];
  occurrences: Occurrence[];
  skippedOccurrences: SkippedOccurrence[];
  onClose: () => void;
  onClosed: () => void;
  onEdit: (task: Task | null) => void;
  onSave: (input: TaskInput, taskId?: string) => void;
  onSetDone: (occurrence: Occurrence, done: boolean) => void;
  onSkip: (taskId: string, date: string, skipped: boolean) => void;
  onDelete: (taskId: string) => void;
  isDraggingOccurrence: (occurrence: Occurrence) => boolean;
  taskDragHandleProps: (occurrence: OccurrenceDrag) => TaskDragHandleProps;
  taskDropProps: (taskId: string) => TaskDropProps;
}

export function DayPanel({
  date,
  isClosing,
  editing,
  tasks,
  occurrences,
  skippedOccurrences,
  onClose,
  onClosed,
  onEdit,
  onSave,
  onSetDone,
  onSkip,
  onDelete,
  isDraggingOccurrence,
  taskDragHandleProps,
  taskDropProps,
}: DayPanelProps) {
  function handleAnimationEnd(event: AnimationEvent<HTMLElement>) {
    // Keep the selected date mounted until the closing animation finishes.
    if (event.target === event.currentTarget && isClosing) onClosed();
  }

  return (
    <div
      className={`overlay${isClosing ? ' is-closing' : ''}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="day-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
        onAnimationEnd={handleAnimationEnd}
      >
        <button type="button" className="close-button" aria-label="Close details" onClick={onClose}>
          ×
        </button>
        <p className="eyebrow">{format(parseISO(date), 'EEEE').toUpperCase()}</p>
        <h2 id="panel-title">{format(parseISO(date), 'MMMM d, yyyy')}</h2>
        {editing ? (
          <TaskForm
            task={editing}
            date={date}
            onCancel={() => onEdit(null)}
            onSave={(input) => onSave(input, editing.id)}
          />
        ) : (
          <>
            <div className="panel-section-heading">
              <h3>Today’s tasks</h3>
              <span>{occurrences.length}</span>
            </div>
            {occurrences.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">☼</span>
                <strong>A little breathing room.</strong>
                <span>Nothing planned for this day yet.</span>
              </div>
            ) : (
              <div className="occurrence-list">
                {occurrences.map((item) => {
                  const task = tasks.find(({ id }) => id === item.taskId);
                  const dragIdentity = {
                    taskId: item.taskId,
                    date: item.date,
                    occurrenceDate: item.occurrenceDate,
                  };
                  return (
                    <article
                      className={`occurrence-card${item.overdue ? ' overdue-card' : ''}${isDraggingOccurrence(item) ? ' is-dragging' : ''}`}
                      {...taskDropProps(item.taskId)}
                      key={`${item.taskId}-${item.occurrenceDate}`}
                    >
                      <div className="occurrence-heading">
                        <button
                          type="button"
                          className="task-drag-handle"
                          aria-label={`Drag ${item.title} to move or reorder`}
                          title="Drag to move or reorder"
                          {...taskDragHandleProps(dragIdentity)}
                        >
                          ⠿
                        </button>
                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={(event) => onSetDone(item, event.target.checked)}
                          />
                          <span className="custom-check" />
                          <span className={`occurrence-title${item.done ? ' completed-title' : ''}`}>
                            {item.title}
                          </span>
                        </label>
                      </div>
                      <span className="occurrence-category">
                        <i style={{ backgroundColor: item.color ?? defaultTaskColor }} />
                        {task?.recurrenceType ?? 'task'}
                      </span>
                      {item.notes && <p className="occurrence-notes">{item.notes}</p>}
                      <div className="card-actions">
                        <button type="button" onClick={() => onEdit(task ?? null)} disabled={!task}>
                          Edit series
                        </button>
                        <button
                          type="button"
                          onClick={() => onSkip(item.taskId, item.occurrenceDate, true)}
                        >
                          Skip today
                        </button>
                        <button
                          type="button"
                          className="delete-action"
                          onClick={() => {
                            if (window.confirm('Delete this task and its entire series?')) {
                              onDelete(item.taskId);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {skippedOccurrences.length > 0 && (
              <>
                <div className="panel-section-heading skipped-heading">
                  <h3>Skipped today</h3>
                  <span>{skippedOccurrences.length}</span>
                </div>
                {skippedOccurrences.map((item) => (
                  <div className="skipped-row" key={`${item.taskId}-${item.occurrenceDate}`}>
                    <span>
                      <i style={{ backgroundColor: item.color ?? defaultTaskColor }} />
                      {item.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSkip(item.taskId, item.occurrenceDate, false)}
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </>
            )}
            <TaskForm date={date} onCancel={onClose} onSave={(input) => onSave(input)} compact />
          </>
        )}
      </section>
    </div>
  );
}
