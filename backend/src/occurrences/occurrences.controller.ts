import { Body, Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import { MoveOccurrenceDto } from './dto/move-occurrence.dto';
import { OccurrencesService } from './occurrences.service';

@Controller()
export class OccurrencesController {
  constructor(private readonly occurrences: OccurrencesService) {}

  @Get('occurrences')
  list(@Query('from') from: string, @Query('to') to: string) {
    return this.occurrences.list(from ?? '', to ?? '');
  }

  @Get('skips')
  listSkipped(@Query('date') date: string) {
    return this.occurrences.listSkipped(date ?? '');
  }

  @Put('tasks/:id/occurrences/:occurrenceDate/move')
  move(
    @Param('id') id: string,
    @Param('occurrenceDate') occurrenceDate: string,
    @Body() input: MoveOccurrenceDto,
  ) {
    return this.occurrences.move(id, occurrenceDate, input.date);
  }

  @Put('tasks/:id/completions/:date')
  complete(@Param('id') id: string, @Param('date') date: string) {
    return this.occurrences.setCompletion(id, date, true).then(() => ({ done: true }));
  }

  @Delete('tasks/:id/completions/:date')
  uncomplete(@Param('id') id: string, @Param('date') date: string) {
    return this.occurrences.setCompletion(id, date, false).then(() => ({ done: false }));
  }

  @Put('tasks/:id/skips/:date')
  skip(@Param('id') id: string, @Param('date') date: string) {
    return this.occurrences.setSkipped(id, date, true).then(() => ({ skipped: true }));
  }

  @Delete('tasks/:id/skips/:date')
  unskip(@Param('id') id: string, @Param('date') date: string) {
    return this.occurrences.setSkipped(id, date, false).then(() => ({ skipped: false }));
  }
}
