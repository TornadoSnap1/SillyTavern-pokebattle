import { Dex } from '@pkmn/sim';

export const teraFromDetails = details => /(?:^|,\s*)tera:([^,]+)/i.exec(details || '')?.[1]?.trim() || null;
const slotOf = ident => ident?.match(/^p[12][ab]/)?.[0];
const identityOf = ident => ident?.replace(/^(p[12])[ab]:/, '$1:');
export function defensiveTypes(pokemon) {
  if (!pokemon) return null;
  if (pokemon.teraType && pokemon.teraType !== 'Stellar') return [pokemon.teraType];
  return pokemon.types || Dex.species.get(pokemon.species).types;
}

// Observe only protocol messages visible to this player. This never reads Battle
// internals, unrevealed teams, or the other player's pending choices.
export class PublicBattleState {
  constructor() { this.active = new Map(); this.known = new Map(); }
  learnOwnItems(request) {
    for(const p of request?.side?.pokemon || []) {
      if(typeof p.item !== 'string')continue;
      const identity=identityOf(p.ident),record=this.known.get(identity) || {};
      record.itemKnown=true;record.item=p.item ? Dex.items.get(p.item).name : '';
      if(record.item)record.itemState='held';
      this.known.set(identity,record);
    }
  }
  observe(line) {
    const p = line.split('|'), event = p[1], slot = slotOf(p[2]);
    if (!slot) return;
    if (['switch', 'drag', 'replace'].includes(event)) {
      const identity = identityOf(p[2]), prior = this.known.get(identity);
      const species = p[3]?.split(',')[0];
      const pokemon = { species, condition:p[4] || prior?.condition || '100/100',
        teraType:teraFromDetails(p[3]) || prior?.teraType || null,
        ability:prior?.species === species && !prior.temporaryAbility ? prior.ability : null,
        itemKnown:prior?.itemKnown || false,item:prior?.item || '',lastItem:prior?.lastItem || '',itemState:prior?.itemState };
      this.active.set(slot,pokemon); this.known.set(identity,pokemon);
    }
    const pokemon = this.active.get(slot);
    if (!pokemon) return;
    if(event === '-item' || event === '-enditem') {
      pokemon.itemKnown=true;
      if(event === '-item'){pokemon.item=p[3];pokemon.itemState='held';}
      else {pokemon.lastItem=p[3];pokemon.item='';pokemon.itemState=p.includes('[eat]')?'consumed':'removed';}
    }
    if(['-mega','-primal'].includes(event) && p[4] && Dex.items.get(p[4]).exists) {
      pokemon.itemKnown=true;pokemon.item=p[4];pokemon.itemState='held';
    }
    const revealedItem=p.slice(3).map(value=>/^(?:\[from\] )?item: (.+)$/.exec(value)?.[1]).find(Boolean);
    if(revealedItem) {
      const owner=p.find(value=>value.startsWith('[of] '));
      const record=owner?this.active.get(slotOf(owner.slice(5))):pokemon;
      // A consumed berry/policy can produce follow-up effects. Those effects do
      // not mean that the item was equipped again; only -item can do that.
      if(record && !(record.itemKnown && !record.item)) {record.itemKnown=true;record.item=revealedItem;record.itemState='held';}
    }
    if (['-formechange', 'detailschange'].includes(event)) {
      const species = p[3]?.split(',')[0];
      if (species && species !== pokemon.species) { pokemon.species=species; pokemon.ability=null; }
      pokemon.types=null;
      pokemon.teraType=teraFromDetails(p[3]) || pokemon.teraType;
    }
    if (event === '-terastallize') pokemon.teraType=p[3];
    if (event === 'faint') pokemon.condition='0 fnt';
    if (['-damage','-heal'].includes(event)) pokemon.condition=p[3];
    if (event === '-status' || event === '-curestatus') pokemon.condition=pokemon.condition.split(' ')[0]+(event === '-status' ? ` ${p[3]}` : '');
    if (event === '-start' && p[3] === 'typechange') pokemon.types=p[4]?.split('/');
    if (event === '-start' && p[3] === 'typeadd') pokemon.types=[...new Set([...(pokemon.types || Dex.species.get(pokemon.species).types),p[4]])];
    if (event === '-end' && ['typechange','typeadd'].includes(p[3])) pokemon.types=null;
    if (event === '-endability') pokemon.ability=null;
    if (event === '-ability') {
      pokemon.ability=p[3];
      pokemon.temporaryAbility=/move:|ability: (Trace|Receiver|Power of Alchemy)/.test(p.slice(4).join('|'));
      // [of] in a Trace message is the copied target, not the owner of Trace.
      return;
    }
    // Absorption and immunity abilities are also revealed through -start,
    // -activate, -immune, or -heal. [of] identifies a different ability owner.
    const ability = p.slice(3).map(value => /^(?:\[from\] )?ability: (.+)$/.exec(value)?.[1]).find(Boolean);
    if (ability) {
      const owner = p.find(value => value.startsWith('[of] '));
      const ownerSlot = owner ? slotOf(owner.slice(5)) : slot;
      const observed = this.active.get(ownerSlot); if (observed) observed.ability=ability;
    }
  }
}
