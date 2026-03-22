import { Injectable } from '@nestjs/common';

export interface ModelAdvisor {
  suggestBid(input: { budget: number; currentPrice: number; roleScarcity: number; demandIndex: number }): number;
  suggestField(input: { batterStyle: 'right' | 'left'; runRate: number; wicketNeed: number }): string[];
  suggestBowler(input: { over: number; requiredRate: number; bowlers: Array<{ id: string; economy: number; fatigue: number }> }): string;
}

class RuleBasedAdvisor implements ModelAdvisor {
  suggestBid(input: { budget: number; currentPrice: number; roleScarcity: number; demandIndex: number }) {
    const ceiling = input.budget * 0.18;
    const urgencyFactor = 1 + input.roleScarcity * 0.12 + input.demandIndex * 0.08;
    return Math.round(Math.min(ceiling, input.currentPrice * urgencyFactor));
  }

  suggestField(input: { batterStyle: 'right' | 'left'; runRate: number; wicketNeed: number }) {
    const attacking = input.wicketNeed > 0.6;
    if (attacking) {
      return input.batterStyle === 'right'
        ? ['slip', 'gully', 'short-cover', 'mid-off', 'fine-leg']
        : ['slip', 'point', 'short-midwicket', 'mid-on', 'third-man'];
    }
    return ['deep-cover', 'long-off', 'long-on', 'deep-square-leg', 'third-man'];
  }

  suggestBowler(input: { over: number; requiredRate: number; bowlers: Array<{ id: string; economy: number; fatigue: number }> }) {
    const deathOver = input.over >= 16;
    const sorted = [...input.bowlers].sort((a, b) => {
      const aScore = a.economy + a.fatigue * (deathOver ? 1.7 : 1.1);
      const bScore = b.economy + b.fatigue * (deathOver ? 1.7 : 1.1);
      return aScore - bScore;
    });
    return sorted[0]?.id ?? 'no-available-bowler';
  }
}

@Injectable()
export class AiService {
  private readonly advisor: ModelAdvisor;

  constructor() {
    this.advisor = new RuleBasedAdvisor();
  }

  suggestBid(input: { budget: number; currentPrice: number; roleScarcity: number; demandIndex: number }) {
    return { suggestedBid: this.advisor.suggestBid(input) };
  }

  suggestField(input: { batterStyle: 'right' | 'left'; runRate: number; wicketNeed: number }) {
    return { placements: this.advisor.suggestField(input) };
  }

  suggestBowler(input: { over: number; requiredRate: number; bowlers: Array<{ id: string; economy: number; fatigue: number }> }) {
    return { bowlerId: this.advisor.suggestBowler(input) };
  }
}
