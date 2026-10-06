import { useState } from 'react';
import type { FormEvent } from 'react';
import type { RecurrenceType, Task, TaskInput } from '../api';
import {
  taskColors,
  weekdayLabels,
  weekdayFromDate,
  weekOfMonthFromDate,
} from '../planner/constants';

interface TaskFormProps {
  date: string;
  task?: Task;
  compact?: boolean;
  onCancel: () => void;
  onSave: (input: TaskInput) => void;
}

export function TaskForm({
  date,
  task,
  compact = false,
  onCancel,
  onSave,
}: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [color, setColor] = useState(task?.color ?? taskColors[0]);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(task?.recurrenceType ?? 'once');
  const [startDate, setStartDate] = useState(task?.startDate ?? date);
  const [endDate, setEndDate] = useState(task?.endDate ?? '');
  const patternDate = task?.startDate ?? date;
  const [weekOfMonth, setWeekOfMonth] = useState(
    task?.weekOfMonth ?? weekOfMonthFromDate(patternDate),
  );
  const [weekdayOfMonth, setWeekdayOfMonth] = useState(
    task?.weekdayOfMonth ?? weekdayFromDate(patternDate),
  );
  const [selectedDays, setSelectedDays] = useState<number[]>(task?.weekdays ?? []);
  const [error, setError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (recurrenceType === 'weekly' && selectedDays.length === 0) {
      setError('Select at least one weekday.');
      return;
    }

    onSave({
      title: title.trim(),
      notes: notes.trim() || null,
      color: color || null,
      recurrenceType,
      startDate,
      endDate: endDate || null,
      weekdays: recurrenceType === 'weekly' ? [...selectedDays].sort() : null,
      dayOfMonth: null,
      weekOfMonth: recurrenceType === 'monthly' ? weekOfMonth : null,
      weekdayOfMonth: recurrenceType === 'monthly' ? weekdayOfMonth : null,
    });
  }

  return (
    <form className={`task-form${compact ? ' compact-form' : ''}`} onSubmit={submit}>
      <div className="form-title-row">
        <h3>{task ? 'Edit task series' : 'Add a task'}</h3>
        {task && (
          <button type="button" className="text-button" onClick={onCancel}>Cancel</button>
        )}
      </div>
      <label className="field-label">
        Task name
        <input
          autoFocus={!compact}
          maxLength={160}
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Water the plants"
        />
      </label>
      <label className="field-label">
        Notes <span className="optional-label">Optional</span>
        <textarea
          maxLength={2000}
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Anything helpful to remember…"
        />
      </label>
      <label className="field-label">
        Repeat
        <select
          value={recurrenceType}
          onChange={(event) => setRecurrenceType(event.target.value as RecurrenceType)}
        >
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
            return (
              <button
                type="button"
                key={weekday}
                className={selectedDays.includes(weekday) ? 'selected' : ''}
                onClick={() => setSelectedDays((current) =>
                  current.includes(weekday)
                    ? current.filter((day) => day !== weekday)
                    : [...current, weekday])}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      {recurrenceType === 'monthly' && (
        <div className="date-fields">
          <label className="field-label">
            Week of month
            <select
              value={weekOfMonth}
              onChange={(event) => setWeekOfMonth(Number(event.target.value))}
            >
              <option value={1}>First</option>
              <option value={2}>Second</option>
              <option value={3}>Third</option>
              <option value={4}>Fourth</option>
              <option value={5}>Fifth</option>
            </select>
          </label>
          <label className="field-label">
            Day of week
            <select
              value={weekdayOfMonth}
              onChange={(event) => setWeekdayOfMonth(Number(event.target.value))}
            >
              {weekdayLabels.map((label, index) => (
                <option key={label} value={index + 1}>{label}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="date-fields">
        <label className="field-label">
          Starts
          <input
            type="date"
            required
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>
        <label className="field-label">
          Ends <span className="optional-label">Optional</span>
          <input
            type="date"
            min={startDate}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
      </div>
      <div className="field-label">Color</div>
      <div className="color-picker">
        {taskColors.map((swatch) => (
          <button
            type="button"
            key={swatch}
            aria-label={`Select ${swatch} task color`}
            className={color === swatch ? 'active' : ''}
            style={{ backgroundColor: swatch }}
            onClick={() => setColor(swatch)}
          />
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
        <button className="primary-button" type="submit">
          {task ? 'Save changes' : 'Add task'}
        </button>
      </div>
    </form>
  );
}
