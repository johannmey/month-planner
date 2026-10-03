import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Task } from '../tasks/task.entity';

@Entity()
@Unique(['taskId', 'occurrenceDate'])
export class OccurrenceMove {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  taskId!: string;

  @Column({ length: 10 })
  occurrenceDate!: string;

  @Column({ length: 10 })
  movedDate!: string;

  @ManyToOne(() => Task, (task) => task.occurrenceMoves, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task!: Task;
}
