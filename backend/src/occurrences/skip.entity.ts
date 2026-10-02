import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Task } from '../tasks/task.entity';

@Entity()
@Unique(['taskId', 'date'])
export class Skip {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  taskId!: string;

  @Column({ length: 10 })
  date!: string;

  @ManyToOne(() => Task, (task) => task.skips, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task!: Task;
}
