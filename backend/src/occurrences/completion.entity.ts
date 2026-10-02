import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Task } from '../tasks/task.entity';

@Entity()
@Unique(['taskId', 'date'])
export class Completion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  taskId!: string;

  @Column({ length: 10 })
  date!: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  completedAt!: Date;

  @ManyToOne(() => Task, (task) => task.completions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task!: Task;
}
