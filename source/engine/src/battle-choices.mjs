// Pure request/choice rules shared by the browser controller and regression tests.
export const isFainted = pokemon => !pokemon || /(?:^0(?:\s|$)|\bfnt\b)/.test(pokemon.condition || '');
export const isReviving = (request, slot = request?.forceSwitch?.findIndex(Boolean) ?? 0) => !!request?.side?.pokemon?.[slot]?.reviving;
export function switchOptions(request, commands = [], activeSlot) {
  const reviving = isReviving(request, activeSlot);
  const used = new Set(commands.filter(Boolean).filter(c => c.startsWith('switch ')).map(c => Number(c.split(' ')[1])));
  return (request?.side?.pokemon || []).map((pokemon, i) => ({ pokemon, slot: i + 1 }))
    .filter(({ pokemon, slot }) => !used.has(slot) && (reviving ? isFainted(pokemon) : !pokemon.active && !isFainted(pokemon)));
}
export function makePlan(request) {
  if (!request || request.wait || request.teamPreview) return { slots: [], commands: [] };
  if (request.forceSwitch) {
    let available = (request.side?.pokemon || []).filter(p => !p.active && !isFainted(p)).length;
    const slots = [], commands = request.forceSwitch.map((required, i) => {
      if (required && isReviving(request,i) && switchOptions(request,[],i).length) { slots.push(i);return null; }
      if (required && available > 0) { available--; slots.push(i); return null; }
      return 'pass';
    });
    return { slots, commands };
  }
  const slots = [], commands = (request.active || []).map((active, i) => {
    if (active && !isFainted(request.side?.pokemon?.[i]) && !request.side?.pokemon?.[i]?.commanding) {
      slots.push(i); return null;
    }
    return 'pass';
  });
  return { slots, commands };
}
export function gimmickReason(name,request,slot,commands = [],context = {}) {
  const command = { mega:'mega',tera:'terastallize',dynamax:'dynamax' }[name];
  if (commands.some(value => new RegExp(`\\b${command}\\b`).test(value || ''))) return '本回合已为另一只选择';
  const pokemon=request?.side?.pokemon?.[slot];
  if (name === 'tera' && pokemon?.terastallized) return '当前已经太晶化';
  if (context.used?.[name]) return '本场对战已使用';
  if (name === 'dynamax' && context.gen && context.gen !== 'gen8') return '当前规则不支持极巨化';
  if (name === 'tera' && context.gen === 'gen8') return '当前规则不支持太晶化';
  if (name === 'dynamax' && request?.active?.[slot]?.maxMoves && !request.active[slot].canDynamax) return '当前正在极巨化';
  return '当前宝可梦不满足条件，或暂时无法使用';
}
export function moveChoices(active, dynamax = false) {
  if (!active) return [];
  const max = active.maxMoves?.maxMoves;
  return (max && (dynamax || !active.canDynamax)) ? max : (active.moves || []);
}
export function targetsFor(type, ownSlot, ownAlive, foeAlive) {
  const foes = foeAlive.flatMap((alive, i) => alive ? [i + 1] : []);
  const allies = ownAlive.flatMap((alive, i) => alive && i !== ownSlot ? [-(i + 1)] : []);
  if (type === 'adjacentFoe') return foes;
  if (type === 'normal' || type === 'any') return [...foes, ...allies];
  if (type === 'adjacentAlly') return allies;
  if (type === 'adjacentAllyOrSelf') return [...allies, -(ownSlot + 1)];
  return [];
}
export function gimmicksFor(request, slot, commands = []) {
  const active = request?.active?.[slot];
  return {
    mega: !!active?.canMegaEvo && !commands.some(c => /\bmega\b/.test(c || '')),
    tera: !!active?.canTerastallize && !commands.some(c => /\bterastallize\b/.test(c || '')),
    dynamax: !!active?.canDynamax && !commands.some(c => /\bdynamax\b/.test(c || '')),
  };
}
