import { Module } from '@nestjs/common';
import { TournamentController } from './tournament/tournament.controller';
import { TournamentService } from './tournament/tournament.service';

@Module({
  controllers: [TournamentController],
  providers: [TournamentService]
})
export class AppModule {}
