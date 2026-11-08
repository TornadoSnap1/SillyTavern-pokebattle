import { Dex } from '@pkmn/sim';
import { BattlePlayer } from '../node_modules/@pkmn/sim/build/esm/sim/battle-stream.mjs';
import { PRNG } from '../node_modules/@pkmn/sim/build/esm/sim/prng.mjs';
import { isFainted, makePlan, switchOptions, targetsFor, moveChoices, gimmicksFor } from './battle-choices.mjs';
import { PublicBattleState, defensiveTypes } from './battle-public-state.mjs';

// Only the AI's request and publicly revealed battle messages are used.
// No opponent team, pending player command, or omniscient Battle instance is read.
export class BasicPlayerAI extends BattlePlayer {
  constructor(stream, options = {}) {
    super(stream);
    this.prng = PRNG.get(options.seed);
    this.observed = new PublicBattleState();
    this.seen = this.observed.active;
    this.lastMoves = new Map();
  }
  receiveLine(line) {
    this.observed.observe(line);
    super.receiveLine(line);
  }
  receiveError(error) {
    // Engine default is always a legal fallback; never retry an invalid heuristic choice.
    if (/choice|target|move|switch/i.test(error.message)) this.choose('default');
    else throw error;
  }
  scoreMove(moveName, actor, target, slot, baseName) {
    let move = Dex.moves.get(moveName);
    if (move.isMax && move.category !== 'Status' && baseName) {
      const base = Dex.moves.get(baseName);
      move = { ...move, category:base.category, basePower:base.maxMove?.basePower || 100 };
    }
    const own = Dex.species.get(actor.details.split(',')[0]);
    const foe = target ? Dex.species.get(target.species) : null;
    const foeTypes = defensiveTypes(target);
    const hp = Number(actor.condition.split('/')[0]) / Math.max(1, Number(actor.condition.split('/')[1]?.split(' ')[0]));
    const targetStatus = target?.condition?.split(' ')[1];
    if (move.category === 'Status') {
      if (move.heal) return hp < 0.5 ? 100 * (1 - hp) : 2;
      if (move.status) {
        if (targetStatus) return 1;
        const types = foeTypes || [];
        if (['psn', 'tox'].includes(move.status) && types.some(t => ['Poison', 'Steel'].includes(t))) return 0;
        if (move.status === 'brn' && types.includes('Fire')) return 0;
        if (move.status === 'par' && types.includes('Electric')) return 0;
        return move.accuracy === true ? 34 : 34 * Number(move.accuracy || 100) / 100;
      }
      if (move.boosts) return this.lastMoves.get(slot) === move.id || hp < 0.55 ? 4 : 30;
      if (move.id === 'protect' || move.id === 'detect') return this.lastMoves.get(slot) === move.id ? 0 : 8;
      return 12;
    }
    if (foe && !Dex.getImmunity(move.type, foeTypes)) return 0;
    const ability = target?.ability;
    if ((move.type === 'Ground' && ability === 'Levitate') ||
        (move.type === 'Water' && ['Water Absorb', 'Storm Drain', 'Dry Skin'].includes(ability)) ||
        (move.type === 'Electric' && ['Volt Absorb', 'Lightning Rod', 'Motor Drive'].includes(ability)) ||
        (move.type === 'Fire' && ability === 'Flash Fire')) return 0;
    const stats = actor.stats || own.baseStats;
    const attack = stats[move.category === 'Physical' ? 'atk' : 'spa'] || 80;
    // Coarse estimate, not an exact damage calculator or prediction search.
    const defense = foe?.baseStats?.[move.category === 'Physical' ? 'def' : 'spd'] || 80;
    const ratio = Math.max(0.35, Math.min(2, attack / (defense * 1.5)));
    const effectiveness = foe ? 2 ** Dex.getEffectiveness(move.type, foeTypes) : 1;
    const accuracy = move.accuracy === true ? 1 : Number(move.accuracy || 100) / 100;
    const power = move.basePower || (move.damage ? 75 : 40);
    let score = power * ratio * effectiveness * accuracy * (own.types.includes(move.type) ? 1.5 : 1);
    if (move.category === 'Physical' && actor.condition.includes('brn')) score *= 0.5;
    const foeHP = target ? Number(target.condition.split('/')[0]) / Number(target.condition.split('/')[1]?.split(' ')[0] || 100) : 1;
    if (move.priority > 0 && foeHP < 0.25) score *= 1.4;
    if (move.selfdestruct) score *= 0.65;
    return score;
  }
  receiveRequest(request) {
    if (request.wait) return;
    if (request.teamPreview) return this.choose('default');
    const plan = makePlan(request);
    if (request.forceSwitch) {
      for (const slot of plan.slots) {
        const available = switchOptions(request, plan.commands, slot);
        plan.commands[slot] = available.length ? `switch ${available[0].slot}` : 'pass';
      }
      return this.choose(plan.commands.join(', '));
    }
    const ownID = request.side.id;
    const foeID = ownID === 'p1' ? 'p2' : 'p1';
    const count = request.active?.length || 1;
    const opponents = Array.from({ length: count }, (_, i) => this.seen.get(`${foeID}${String.fromCharCode(97 + i)}`));
    const ownAlive = request.active.map((_, i) => !isFainted(request.side.pokemon[i]));
    const foeAlive = opponents.map(p => !p || !isFainted(p));
    for (const slot of plan.slots) {
      const actor = request.side.pokemon[slot];
      const active = request.active[slot];
      const gimmicks = gimmicksFor(request, slot, plan.commands);
      const special = gimmicks.mega ? 'mega' : gimmicks.dynamax ? 'dynamax' : gimmicks.tera ? 'terastallize' : '';
      const moves = moveChoices(active, special === 'dynamax');
      const options = [];
      moves.forEach((entry, index) => {
        if (entry.disabled) return;
        const base = active.moves[index];
        const targetType = entry.target || Dex.moves.get(entry.move || entry.id).target;
        const targets = count > 1 ? targetsFor(targetType, slot, ownAlive, foeAlive) : [];
        const needsTarget = ['normal', 'any', 'adjacentFoe', 'adjacentAlly', 'adjacentAllyOrSelf'].includes(targetType);
        if (count > 1 && needsTarget && !targets.length) return;
        for (const target of (targets.length ? targets : [null])) {
          const foe = target > 0 ? opponents[target - 1] : opponents.find((p, i) => foeAlive[i]);
          let score = this.scoreMove(entry.move || entry.id || base?.move, actor, foe, slot, base?.id || base?.move);
          if (target < 0 && Dex.moves.get(entry.move || entry.id).category !== 'Status') score = -1000;
          options.push({ index, target, score: score * (0.92 + this.prng.random() * 0.16), move: entry.move || entry.id });
        }
      });
      options.sort((a, b) => b.score - a.score);
      const best = options[0];
      const bench = active.trapped ? [] : switchOptions(request, plan.commands, slot);
      // Switch only out of an obviously ineffective attacking position, not at random.
      if (best && best.score <= 0 && bench.length) {
        plan.commands[slot] = `switch ${bench[0].slot}`;
      } else if (best) {
        plan.commands[slot] = `move ${best.index + 1}${best.target === null ? '' : ` ${best.target}`}${special ? ` ${special}` : ''}`;
        this.lastMoves.set(slot, Dex.moves.get(best.move).id);
      } else return this.choose('default');
    }
    this.choose(plan.commands.join(', '));
  }
}
