import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { TasksModule } from './tasks/tasks.module';
import { OccurrencesModule } from './occurrences/occurrences.module';
import { Task } from './tasks/task.entity';
import { Completion } from './occurrences/completion.entity';
import { Skip } from './occurrences/skip.entity';

const databasePath = process.env.PLANNER_DB_PATH ?? join(__dirname, '..', 'data', 'planner.db');
mkdirSync(dirname(databasePath), { recursive: true });

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqljs',
      location: databasePath,
      autoSave: true,
      entities: [Task, Completion, Skip],
      synchronize: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'frontend', 'dist'),
      serveRoot: '/',
      exclude: ['/api/{*path}'],
    }),
    TasksModule,
    OccurrencesModule,
  ],
})
export class AppModule {}
