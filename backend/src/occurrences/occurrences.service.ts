import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { isDateKey, localDateKey } from '../date-utils';
import { expandTaskDates } from '../recurrence/recurrence';
import { Task } from '../tasks/task.entity';
import { Completion } from './completion.entity';
import { OccurrenceMove } from './occurrence-move.entity';
import { Skip } from './skip.entity';

export interface TaskOccurrence {
  taskId: string;
  date: string;
  occurrenceDate: string;
  title: string;
  notes: string | null;
  color: string | null;
  done: boolean;
  overdue: boolean;
}

@Injectable()
export class OccurrencesService {
  constructor(
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(Completion) private readonly completions: Repository<Completion>,
    @InjectRepository(Skip) private readonly skips: Repository<Skip>,
    @InjectRepository(OccurrenceMove) private readonly moves: Repository<OccurrenceMove>,
  ) {}

  async list(from: string, to: string): Promise<TaskOccurrence[]> {
    this.validateRange(from, to);
    const allTasks = await this.tasks.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } });
    if (allTasks.length === 0) return [];

    const taskById = new Map(allTasks.map((task) => [task.id, task]));
    const moves = await this.moves.find({ where: { taskId: In(allTasks.map(({ id }) => id)) } });
    const movedOccurrences = new Map(
      moves.map((move) => [`${move.taskId}:${move.occurrenceDate}`, move]),
    );
    const candidates: Array<{ task: Task; date: string; occurrenceDate: string }> = [];
    for (const task of allTasks) {
      for (const occurrenceDate of expandTaskDates(task, from, to)) {
        if (movedOccurrences.has(`${task.id}:${occurrenceDate}`)) continue;
        candidates.push({ task, date: occurrenceDate, occurrenceDate });
      }
    }
    for (const move of moves) {
      const task = taskById.get(move.taskId);
      if (
        task &&
        move.movedDate >= from &&
        move.movedDate <= to &&
        expandTaskDates(task, move.occurrenceDate, move.occurrenceDate).includes(move.occurrenceDate)
      ) {
        candidates.push({ task, date: move.movedDate, occurrenceDate: move.occurrenceDate });
      }
    }
    if (candidates.length === 0) return [];

    const taskIds = [...new Set(candidates.map(({ task }) => task.id))];
    const dates = [...new Set(candidates.map(({ occurrenceDate }) => occurrenceDate))];
    const [completions, skips] = await Promise.all([
      this.completions.find({ where: { taskId: In(taskIds), date: In(dates) } }),
      this.skips.find({ where: { taskId: In(taskIds), date: In(dates) } }),
    ]);
    const doneKeys = new Set(completions.map(({ taskId, date }) => `${taskId}:${date}`));
    const skippedKeys = new Set(skips.map(({ taskId, date }) => `${taskId}:${date}`));
    const today = localDateKey();

    return candidates
      .filter(({ task, occurrenceDate }) =>
        !skippedKeys.has(`${task.id}:${occurrenceDate}`),
      )
      .map(({ task, date, occurrenceDate }) => ({
        taskId: task.id,
        date,
        occurrenceDate,
        title: task.title,
        notes: task.notes,
        color: task.color,
        done: doneKeys.has(`${task.id}:${occurrenceDate}`),
        overdue: date < today && !doneKeys.has(`${task.id}:${occurrenceDate}`),
      }))
      .sort((a, b) =>
        a.date.localeCompare(b.date) ||
        Number(a.done) - Number(b.done) ||
        (taskById.get(a.taskId)?.sortOrder ?? 0) - (taskById.get(b.taskId)?.sortOrder ?? 0) ||
        a.occurrenceDate.localeCompare(b.occurrenceDate),
      );
  }

  async move(taskId: string, occurrenceDate: string, movedDate: string): Promise<{ moved: true }> {
    await this.assertOccurrence(taskId, occurrenceDate);
    if (!isDateKey(movedDate)) {
      throw new BadRequestException('Date must be a valid YYYY-MM-DD date');
    }
    if (movedDate === occurrenceDate) {
      await this.moves.delete({ taskId, occurrenceDate });
    } else {
      await this.moves.upsert({ taskId, occurrenceDate, movedDate }, ['taskId', 'occurrenceDate']);
    }
    return { moved: true };
  }

  async setCompletion(taskId: string, date: string, done: boolean): Promise<void> {
    await this.assertOccurrence(taskId, date);
    if (done) {
      await this.completions.upsert({ taskId, date }, ['taskId', 'date']);
    } else {
      await this.completions.delete({ taskId, date });
    }
  }

  async setSkipped(taskId: string, date: string, skipped: boolean): Promise<void> {
    await this.assertOccurrence(taskId, date);
    if (skipped) {
      await this.skips.upsert({ taskId, date }, ['taskId', 'date']);
    } else {
      await this.skips.delete({ taskId, date });
    }
  }

  async listSkipped(date: string): Promise<Array<{
    taskId: string;
    occurrenceDate: string;
    title: string;
    color: string | null;
  }>> {
    if (!isDateKey(date)) throw new BadRequestException('Date must be a valid YYYY-MM-DD date');
    const rows = await this.skips.find({ relations: { task: true } });
    const moveRows = rows.length > 0
      ? await this.moves.find({
        where: { taskId: In([...new Set(rows.map(({ taskId }) => taskId))]) },
      })
      : [];
    const movedDates = new Map(
      moveRows.map((move) => [`${move.taskId}:${move.occurrenceDate}`, move.movedDate]),
    );
    return rows
      .filter(({ task, date: occurrenceDate }) =>
        expandTaskDates(task, occurrenceDate, occurrenceDate).includes(occurrenceDate) &&
        (movedDates.get(`${task.id}:${occurrenceDate}`) ?? occurrenceDate) === date,
      )
      .map(({ task, date: occurrenceDate }) => ({
        taskId: task.id,
        occurrenceDate,
        title: task.title,
        color: task.color,
      }));
  }

  private async assertOccurrence(taskId: string, date: string): Promise<void> {
    if (!isDateKey(date)) throw new BadRequestException('Date must be a valid YYYY-MM-DD date');
    const task = await this.tasks.findOneBy({ id: taskId });
    if (!task) throw new NotFoundException('Task not found');
    if (!expandTaskDates(task, date, date).includes(date)) {
      throw new BadRequestException('The selected date is not an occurrence of this task');
    }
  }

  private validateRange(from: string, to: string): void {
    if (!isDateKey(from) || !isDateKey(to) || from > to) {
      throw new BadRequestException('Use valid from and to dates in YYYY-MM-DD format');
    }
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
    if (days > 366) throw new BadRequestException('Date range cannot exceed one year');
  }
}
