import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { isDateKey, localDateKey } from '../date-utils';
import { expandTaskDates } from '../recurrence/recurrence';
import { Task } from '../tasks/task.entity';
import { Completion } from './completion.entity';
import { Skip } from './skip.entity';

export interface TaskOccurrence {
  taskId: string;
  date: string;
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
  ) {}

  async list(from: string, to: string): Promise<TaskOccurrence[]> {
    this.validateRange(from, to);
    const allTasks = await this.tasks.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } });
    const candidates: Array<{ task: Task; date: string }> = [];
    for (const task of allTasks) {
      for (const date of expandTaskDates(task, from, to)) candidates.push({ task, date });
    }
    if (candidates.length === 0) return [];

    const taskIds = [...new Set(candidates.map(({ task }) => task.id))];
    const dates = [...new Set(candidates.map(({ date }) => date))];
    const [completions, skips] = await Promise.all([
      this.completions.find({ where: { taskId: In(taskIds), date: In(dates) } }),
      this.skips.find({ where: { taskId: In(taskIds), date: In(dates) } }),
    ]);
    const doneKeys = new Set(completions.map(({ taskId, date }) => `${taskId}:${date}`));
    const skippedKeys = new Set(skips.map(({ taskId, date }) => `${taskId}:${date}`));
    const today = localDateKey();

    return candidates
      .filter(({ task, date }) => !skippedKeys.has(`${task.id}:${date}`))
      .map(({ task, date }) => ({
        taskId: task.id,
        date,
        title: task.title,
        notes: task.notes,
        color: task.color,
        done: doneKeys.has(`${task.id}:${date}`),
        overdue: date < today && !doneKeys.has(`${task.id}:${date}`),
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || Number(a.done) - Number(b.done));
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

  async listSkipped(date: string): Promise<Array<{ taskId: string; title: string; color: string | null }>> {
    if (!isDateKey(date)) throw new BadRequestException('Date must be a valid YYYY-MM-DD date');
    const rows = await this.skips.find({ where: { date }, relations: { task: true } });
    return rows
      .filter(({ task }) => expandTaskDates(task, date, date).includes(date))
      .map(({ task }) => ({ taskId: task.id, title: task.title, color: task.color }));
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
