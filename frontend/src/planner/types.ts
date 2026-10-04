import type { DragEventHandler } from 'react';
import type { Occurrence } from '../api';

export type CalendarView = 'month' | 'week';

// The original occurrence date remains its identity even when it is displayed on another day.
export type OccurrenceDrag = Pick<Occurrence, 'taskId' | 'date' | 'occurrenceDate'>;

export interface TaskDragHandleProps {
  draggable: boolean;
  onDragStart: DragEventHandler<HTMLElement>;
  onDragEnd: DragEventHandler<HTMLElement>;
}

export interface TaskDropProps {
  onDragOver: DragEventHandler<HTMLElement>;
  onDrop: DragEventHandler<HTMLElement>;
}

export interface DayDropProps extends TaskDropProps {
  onDragLeave: DragEventHandler<HTMLElement>;
}
