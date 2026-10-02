import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Completion } from '../occurrences/completion.entity';
import { Skip } from '../occurrences/skip.entity';

export type TaskRecurrence = 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

@Entity()
@Check(`"recurrenceType" IN ('once', 'daily', 'weekly', 'biweekly', 'monthly')`)
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 160 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  color!: string | null;

  @Column()
  recurrenceType!: TaskRecurrence;

  @Column({ length: 10 })
  startDate!: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  endDate!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  weekdays!: number[] | null;

  @Column({ type: 'integer', nullable: true })
  dayOfMonth!: number | null;

  @Column({ type: 'integer', default: 0 })
  sortOrder!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => Completion, (completion) => completion.task, { cascade: true })
  completions!: Completion[];

  @OneToMany(() => Skip, (skip) => skip.task, { cascade: true })
  skips!: Skip[];
}
