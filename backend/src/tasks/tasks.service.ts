import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isDateKey } from '../date-utils';
import { getMonthlyRecurrencePattern } from '../recurrence/recurrence';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { Task } from './task.entity';

@Injectable()
export class TasksService {
  constructor(@InjectRepository(Task) private readonly tasks: Repository<Task>) {}

  async findAll(): Promise<Task[]> {
    const tasks = await this.tasks.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } });
    return tasks.map((task) => task.recurrenceType === 'monthly'
      ? { ...task, ...getMonthlyRecurrencePattern(task) }
      : task);
  }

  async create(dto: CreateTaskDto): Promise<Task> {
    this.validateTaskDates(dto);
    const [lastTask] = await this.tasks.find({
      select: { sortOrder: true },
      order: { sortOrder: 'DESC', createdAt: 'DESC' },
      take: 1,
    });
    return this.tasks.save(this.tasks.create({
      ...dto,
      notes: dto.notes?.trim() || null,
      weekdays: dto.weekdays ?? null,
      dayOfMonth: dto.dayOfMonth ?? null,
      endDate: dto.endDate ?? null,
      color: dto.color ?? null,
      weekOfMonth: dto.weekOfMonth ?? null,
      weekdayOfMonth: dto.weekdayOfMonth ?? null,
      sortOrder: (lastTask?.sortOrder ?? -1) + 1,
    }));
  }

  async reorder(taskIds: string[]): Promise<Task[]> {
    return this.tasks.manager.transaction(async (manager) => {
      const tasks = await manager.getRepository(Task).find();
      const tasksById = new Map(tasks.map((task) => [task.id, task]));
      if (
        taskIds.length !== tasks.length
        || new Set(taskIds).size !== tasks.length
        || taskIds.some((id) => !tasksById.has(id))
      ) {
        throw new BadRequestException('Task order must include every task exactly once');
      }

      const orderedTasks = taskIds.map((id, sortOrder) => {
        const task = tasksById.get(id);
        if (!task) throw new BadRequestException('Task order contains an unknown task');
        task.sortOrder = sortOrder;
        return task;
      });
      return manager.getRepository(Task).save(orderedTasks);
    });
  }

  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.tasks.findOneBy({ id });
    if (!task) throw new NotFoundException('Task not found');
    const merged = { ...task, ...dto };
    this.validateTaskDates(merged);
    Object.assign(task, dto);
    if (dto.notes !== undefined) task.notes = dto.notes?.trim() || null;
    if (dto.weekdays !== undefined) task.weekdays = dto.weekdays;
    if (dto.dayOfMonth !== undefined) task.dayOfMonth = dto.dayOfMonth;
    if (dto.weekOfMonth !== undefined) task.weekOfMonth = dto.weekOfMonth;
    if (dto.weekdayOfMonth !== undefined) task.weekdayOfMonth = dto.weekdayOfMonth;
    if (dto.endDate !== undefined) task.endDate = dto.endDate;
    return this.tasks.save(task);
  }

  async remove(id: string): Promise<void> {
    const task = await this.tasks.findOne({
      where: { id },
      relations: { completions: true, skips: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    await this.tasks.remove(task);
  }

  private validateTaskDates(task: Partial<Task>): void {
    if (task.startDate && !isDateKey(task.startDate)) throw new BadRequestException('Invalid start date');
    if (task.endDate && !isDateKey(task.endDate)) throw new BadRequestException('Invalid end date');
    if (task.startDate && task.endDate && task.endDate < task.startDate) {
      throw new BadRequestException('End date must be on or after start date');
    }
    if (task.recurrenceType === 'weekly' && (!task.weekdays || task.weekdays.length === 0)) {
      throw new BadRequestException('Choose at least one weekday for weekly tasks');
    }
    if (task.recurrenceType === 'monthly') {
      const hasWeek = task.weekOfMonth != null;
      const hasWeekday = task.weekdayOfMonth != null;
      if (hasWeek !== hasWeekday) {
        throw new BadRequestException('Choose both a week and a weekday for monthly tasks');
      }
      if (!hasWeek && (!task.dayOfMonth || task.dayOfMonth < 1 || task.dayOfMonth > 31)) {
        throw new BadRequestException('Choose a week and weekday for monthly tasks');
      }
    }
  }
}
