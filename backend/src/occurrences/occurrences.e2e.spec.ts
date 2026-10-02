import type { INestApplication } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addDays, localDateKey } from '../date-utils';

describe('Planner API', () => {
  let application: INestApplication | undefined;
  let baseUrl: string;
  let tempDirectory: string;
  const previousDatabasePath = process.env.PLANNER_DB_PATH;

  beforeAll(async () => {
    tempDirectory = await mkdtemp(join(tmpdir(), 'month-planner-test-'));
    process.env.PLANNER_DB_PATH = join(tempDirectory, 'planner.sqlite');
    const [{ NestFactory }, { AppModule }, { ValidationPipe }] = await Promise.all([
      import('@nestjs/core'),
      import('../app.module'),
      import('@nestjs/common'),
    ]);

    application = await NestFactory.create(AppModule, { logger: false });
    application.setGlobalPrefix('api');
    application.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await application.listen(0, '127.0.0.1');
    const address = application.getHttpServer().address() as AddressInfo | null;
    if (!address) throw new Error('Test server did not bind to a port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  }, 20_000);

  afterAll(async () => {
    await application?.close();
    if (previousDatabasePath === undefined) delete process.env.PLANNER_DB_PATH;
    else process.env.PLANNER_DB_PATH = previousDatabasePath;
    if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true });
  });

  it('creates tasks, tracks completion and skips, validates updates, and deletes a series', async () => {
    const date = localDateKey();
    const createResponse = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'API integration task',
        recurrenceType: 'biweekly',
        startDate: date,
        color: '#6383b0',
      }),
    });
    expect(createResponse.status).toBe(201);
    const task = await createResponse.json() as { id: string };

    const nextOccurrence = addDays(date, 14);
    const occurrenceUrl = `${baseUrl}/api/occurrences?from=${date}&to=${nextOccurrence}`;
    const initialOccurrences = await fetch(occurrenceUrl).then((response) => response.json()) as Array<{
      taskId: string;
      date: string;
      done: boolean;
    }>;
    expect(initialOccurrences.filter(({ taskId }) => taskId === task.id).map(({ date: occurrenceDate }) => occurrenceDate))
      .toEqual([date, nextOccurrence]);
    expect(initialOccurrences.find(({ taskId }) => taskId === task.id)?.done).toBe(false);

    const completionResponse = await fetch(`${baseUrl}/api/tasks/${task.id}/completions/${date}`, {
      method: 'PUT',
    });
    expect(completionResponse.status).toBe(200);
    const completedOccurrences = await fetch(occurrenceUrl).then((response) => response.json()) as Array<{
      taskId: string;
      date: string;
      done: boolean;
    }>;
    expect(completedOccurrences.find(({ taskId }) => taskId === task.id)?.done).toBe(true);

    await fetch(`${baseUrl}/api/tasks/${task.id}/skips/${date}`, { method: 'PUT' });
    const skippedResponse = await fetch(`${baseUrl}/api/skips?date=${date}`);
    const skipped = await skippedResponse.json() as Array<{ taskId: string }>;
    expect(skipped.some(({ taskId }) => taskId === task.id)).toBe(true);
    await fetch(`${baseUrl}/api/tasks/${task.id}/skips/${date}`, { method: 'DELETE' });

    const invalidUpdate = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: null }),
    });
    expect(invalidUpdate.status).toBe(400);

    const deleteResponse = await fetch(`${baseUrl}/api/tasks/${task.id}`, { method: 'DELETE' });
    expect(deleteResponse.status).toBe(200);
    const remainingTasks = await fetch(`${baseUrl}/api/tasks`).then((response) => response.json()) as Array<{ id: string }>;
    expect(remainingTasks.some(({ id }) => id === task.id)).toBe(false);
  }, 20_000);

  it('persists task order and returns occurrences in that order', async () => {
    const date = localDateKey();
    const taskIds: string[] = [];
    for (const title of ['First task', 'Second task', 'Third task']) {
      const response = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, recurrenceType: 'once', startDate: date }),
      });
      expect(response.status).toBe(201);
      const task = await response.json() as { id: string };
      taskIds.push(task.id);
    }

    const reorderedIds = [...taskIds].reverse();
    const reorderResponse = await fetch(`${baseUrl}/api/tasks/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds: reorderedIds }),
    });
    expect(reorderResponse.status).toBe(200);

    const tasks = await fetch(`${baseUrl}/api/tasks`).then((response) => response.json()) as Array<{
      id: string;
      sortOrder: number;
    }>;
    expect(tasks.map(({ id }) => id)).toEqual(reorderedIds);
    expect(tasks.map(({ sortOrder }) => sortOrder)).toEqual([0, 1, 2]);

    const occurrences = await fetch(`${baseUrl}/api/occurrences?from=${date}&to=${date}`)
      .then((response) => response.json()) as Array<{ taskId: string }>;
    expect(occurrences.map(({ taskId }) => taskId)).toEqual(reorderedIds);

    await fetch(`${baseUrl}/api/tasks/${reorderedIds[0]}/completions/${date}`, { method: 'PUT' });
    const sortedOccurrences = await fetch(`${baseUrl}/api/occurrences?from=${date}&to=${date}`)
      .then((response) => response.json()) as Array<{ taskId: string; done: boolean }>;
    expect(sortedOccurrences.map(({ taskId }) => taskId)).toEqual([
      ...reorderedIds.slice(1),
      reorderedIds[0],
    ]);
    expect(sortedOccurrences.at(-1)?.done).toBe(true);

    const incompleteOrder = await fetch(`${baseUrl}/api/tasks/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds: reorderedIds.slice(1) }),
    });
    expect(incompleteOrder.status).toBe(400);
  }, 20_000);
});
