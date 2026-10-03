import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../tasks/task.entity';
import { Completion } from './completion.entity';
import { OccurrenceMove } from './occurrence-move.entity';
import { Skip } from './skip.entity';
import { OccurrencesController } from './occurrences.controller';
import { OccurrencesService } from './occurrences.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Completion, Skip, OccurrenceMove])],
  controllers: [OccurrencesController],
  providers: [OccurrencesService],
})
export class OccurrencesModule {}
