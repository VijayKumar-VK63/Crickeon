import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const players: Prisma.PlayerCreateManyInput[] = [
  { externalRef: 'cric-001', fullName: 'Virat Kohli', country: 'India', role: 'batsman', battingAvg: 57.2, strikeRate: 93.5, bowlingAvg: 0, economy: 0, fieldingRate: 8.9, formIndex: 1.08 },
  { externalRef: 'cric-002', fullName: 'Jasprit Bumrah', country: 'India', role: 'bowler', battingAvg: 9.1, strikeRate: 83, bowlingAvg: 23.4, economy: 4.6, fieldingRate: 8.2, formIndex: 1.12 },
  { externalRef: 'cric-003', fullName: 'Ben Stokes', country: 'England', role: 'all_rounder', battingAvg: 38.4, strikeRate: 95.7, bowlingAvg: 32.1, economy: 5.9, fieldingRate: 8.4, formIndex: 1.03 },
  { externalRef: 'cric-004', fullName: 'Jos Buttler', country: 'England', role: 'wicket_keeper', battingAvg: 41.8, strikeRate: 117.2, bowlingAvg: 0, economy: 0, fieldingRate: 8.1, formIndex: 1.05 },
  { externalRef: 'cric-005', fullName: 'Babar Azam', country: 'Pakistan', role: 'batsman', battingAvg: 54, strikeRate: 89.1, bowlingAvg: 0, economy: 0, fieldingRate: 8.0, formIndex: 0.98 },
  { externalRef: 'cric-006', fullName: 'Shaheen Afridi', country: 'Pakistan', role: 'bowler', battingAvg: 12.8, strikeRate: 79.4, bowlingAvg: 24.1, economy: 5.1, fieldingRate: 7.8, formIndex: 1.04 },
  { externalRef: 'cric-007', fullName: 'Glenn Maxwell', country: 'Australia', role: 'all_rounder', battingAvg: 34.6, strikeRate: 126.8, bowlingAvg: 36.3, economy: 6.7, fieldingRate: 8.6, formIndex: 1.01 },
  { externalRef: 'cric-008', fullName: 'Quinton de Kock', country: 'South Africa', role: 'wicket_keeper', battingAvg: 45.1, strikeRate: 96.1, bowlingAvg: 0, economy: 0, fieldingRate: 8.3, formIndex: 1.0 },
  { externalRef: 'cric-009', fullName: 'Trent Boult', country: 'New Zealand', role: 'bowler', battingAvg: 15.4, strikeRate: 87.5, bowlingAvg: 25.3, economy: 4.9, fieldingRate: 7.9, formIndex: 1.02 },
  { externalRef: 'cric-010', fullName: 'David Warner', country: 'Australia', role: 'batsman', battingAvg: 44.9, strikeRate: 97.9, bowlingAvg: 0, economy: 0, fieldingRate: 8.0, formIndex: 0.96 }
];

async function main() {
  await prisma.player.createMany({ data: players, skipDuplicates: true });
}

main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
