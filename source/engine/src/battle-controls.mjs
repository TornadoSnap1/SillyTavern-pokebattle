import { Dex } from '@pkmn/sim';
import { isFainted, isReviving, makePlan, switchOptions, moveChoices, targetsFor, gimmicksFor, gimmickReason } from './battle-choices.mjs';
import { escapeHtml as esc, speciesName, tr, TYPES } from './i18n.mjs';

export function createBattleControls({ document: doc, write, log = () => {}, onSelect = () => {} }) {
  let request = null, plan = { slots: [], commands: [] }, cursor = 0, locked = true, ended = false;
  const opponents = [null, null];
  const rules = { gen:null,used:{} };
  const el = id => doc.getElementById(id);
  const text = (id, value) => { if (el(id)) el(id).textContent = value; };
  const slot = () => plan.slots[cursor] ?? 0;
  const active = () => request?.active?.[slot()];
  const hidden = (id, value) => el(id)?.classList.toggle('hidden', value);
  function markActor(index) {
    for (const [i,key] of ['p1a','p1b'].entries()) {
      for(const suffix of ['card','img']) el(`${key}-${suffix}`)?.classList.toggle('is-acting',index === i);
    }
  }
  function hideMenus() {
    ['main-menu', 'battle-moves', 'target-menu', 'switch-menu', 'gimmick-menu'].forEach(id => hidden(id, true));
    for (const image of doc.querySelectorAll('.targetable')) {
      image.classList.remove('targetable','target-hover');
      for(const handler of ['onclick','onpointerenter','onpointerleave','onfocus','onblur','onkeydown'])image[handler]=null;
      for(const attr of ['tabindex','role','aria-label'])image.removeAttribute?.(attr);
    }
  }
  function status(message) { text('action-status', message); }
  function summary() {
    const completed = plan.slots.slice(0, cursor).map(i => {
      const who = speciesName(request.side.pokemon[i].details.split(',')[0], Dex);
      const cmd = plan.commands[i] || '';
      const move = cmd.match(/^move (\d+)/);
      const name = move ? tr('move', activeFor(i, cmd)?.[Number(move[1]) - 1]?.move || '') : '换人';
      return `${who}：${name}`;
    });
    text('decision-summary', completed.join(' · '));
    hidden('undo-choice', cursor === 0 || locked);
  }
  function activeFor(i, cmd = '') { return moveChoices(request?.active?.[i], cmd.includes('dynamax')); }
  function updateGimmicks() {
    const options = gimmicksFor(request, slot(), plan.commands);
    for (const name of ['mega', 'tera', 'dynamax']) {
      const checkbox = el(`check-${name}`);
      if (!checkbox) continue;
      checkbox.disabled = !options[name];
      const reason = options[name] ? '本次行动可使用' : gimmickReason(name,request,slot(),plan.commands,rules);
      checkbox.title = reason;
      text(`gimmick-reason-${name}`,reason);
      if (!options[name]) checkbox.checked = false;
    }
    const tera = active()?.canTerastallize || request?.side?.pokemon?.[slot()]?.terastallized || request?.side?.pokemon?.[slot()]?.teraType;
    text('gimmick-name-tera',typeof tera === 'string' ? `💎 太晶化：${TYPES[tera] || tera}` : '💎 太晶化');
  }
  function selectedSpecial() {
    updateGimmicks();
    return ['tera', 'mega', 'dynamax'].find(name => el(`check-${name}`)?.checked) || '';
  }
  function clearSpecial() { ['mega', 'tera', 'dynamax'].forEach(name => { if (el(`check-${name}`)) el(`check-${name}`).checked = false; }); }
  function canAct() { return !locked && !ended && request && !request.wait && cursor < plan.slots.length; }
  function showMain() {
    hideMenus(); summary();
    if (!canAct()) return;
    updateGimmicks();
    const pokemon = request.side.pokemon[slot()];
    markActor(slot());
    status(`${request.forceSwitch ? isReviving(request,slot()) ? '请选择要复活的队友' : '必须换人' : '请选择行动'} · ${speciesName(pokemon.details.split(',')[0], Dex)}${plan.slots.length > 1 ? `（${cursor + 1}/${plan.slots.length}）` : ''}`);
    if (request.forceSwitch) return showSwitch();
    hidden('main-menu', false);
    text('slot-turn-indicator', `正在操作：${speciesName(pokemon.details.split(',')[0], Dex)}`);
    hidden('slot-turn-indicator', plan.slots.length < 2);
  }
  function showMoves() {
    if (!canAct() || request.forceSwitch) return;
    hideMenus(); hidden('battle-moves', false);
    text('moves-header-title', `${speciesName(request.side.pokemon[slot()].details.split(',')[0], Dex)} · 选择招式`);
    const moves = moveChoices(active(), selectedSpecial() === 'dynamax');
    for (let i = 0; i < 4; i++) {
      const button = el(`move-btn-${i + 1}`), entry = moves[i];
      if (!button) continue;
      button.classList.toggle('hidden', !entry);
      if (!entry) continue;
      const move = Dex.moves.get(entry.id || entry.move);
      const pp = active().moves?.[i];
      const baseMove = Dex.moves.get(pp?.id || pp?.move);
      const category = move.isMax && move.category !== 'Status' ? baseMove.category : move.category;
      const power = move.isMax && category !== 'Status' ? baseMove.maxMove?.basePower : move.basePower;
      button.disabled = !!entry.disabled;
      button.className = `move-slot type-${TYPES[move.type] ? move.type : 'Normal'}${entry.disabled ? ' unavailable' : ''}`;
      button.innerHTML = `<span class="move-heading"><span class="move-name">${esc(tr('move', entry.move || move.name))}</span><span class="move-type">${esc(TYPES[move.type] || move.type)}</span></span><span class="move-meta">${category === 'Status' ? '变化' : category === 'Physical' ? '物理' : '特殊'} · PP ${esc(pp?.pp ?? '—')}/${esc(pp?.maxpp ?? '—')}</span><span class="move-meta">基础威力 ${esc(power || '—')} · 基础命中 ${move.accuracy === true ? '必中' : esc(move.accuracy || '—')}</span>`;
      button.title = `${tr('move', move.name)}｜基础威力 ${power || '—'}｜基础命中 ${move.accuracy === true ? '必中' : move.accuracy || '—'}`;
      if (typeof move.onModifyType === 'function') button.innerHTML += '<span class="move-meta">基础属性；实战可能随状态变化</span>';
    }
  }
  function observe(line) {
    const p = line.split('|');
    if(p[1] === 'gen')rules.gen=`gen${p[2]}`;
    if(p[2]?.startsWith('p1')) {
      if(p[1] === '-mega')rules.used.mega=true;
      if(p[1] === '-terastallize')rules.used.tera=true;
      if(p[1] === '-start' && p[3] === 'Dynamax')rules.used.dynamax=true;
    }
    const match = p[2]?.match(/^p2([ab])/);
    if (!match) return;
    const i = match[1] === 'a' ? 0 : 1;
    if (['switch', 'drag', 'replace'].includes(p[1])) opponents[i] = { name: p[3].split(',')[0], condition: p[4] };
    else if (p[1] === 'faint' && opponents[i]) opponents[i].condition = '0 fnt';
    else if (['-damage', '-heal'].includes(p[1]) && opponents[i]) opponents[i].condition = p[3];
  }
  function allowedTargets(entry) {
    const own = request.active.map((_, i) => !isFainted(request.side.pokemon[i]));
    const foes = request.active.map((_, i) => !!opponents[i] && !isFainted(opponents[i]));
    return targetsFor(entry.target || Dex.moves.get(entry.move || entry.id).target, slot(), own, foes);
  }
  function sendMove(index) {
    if (!canAct() || request.forceSwitch) return;
    const entry = moveChoices(active(), selectedSpecial() === 'dynamax')[index - 1];
    if (!entry || entry.disabled) return;
    const type = entry.target || Dex.moves.get(entry.move || entry.id).target;
    if (request.active.length > 1 && ['normal', 'any', 'adjacentFoe', 'adjacentAlly', 'adjacentAllyOrSelf'].includes(type)) {
      const targets = allowedTargets(entry);
      if (!targets.length) { status('没有可选目标，请改选其他招式或换人'); return; }
      hideMenus(); hidden('target-menu', false);
      const list = el('target-buttons-list'); list.replaceChildren();
      for (const target of targets) {
        const pokemon = target > 0 ? opponents[target - 1] : request.side.pokemon[-target - 1];
        const name = pokemon.name || pokemon.details?.split(',')[0];
        const button = doc.createElement('button'); button.className = 'target-choice';
        button.textContent = `${target > 0 ? '敌方' : -target - 1 === slot() ? '自己' : '队友'} · ${speciesName(name, Dex)} · ${pokemon.condition}`;
        button.onclick = () => executeMove(index, target);
        list.appendChild(button);
        const image = el(`${target > 0 ? 'p2' : 'p1'}${String.fromCharCode(97 + Math.abs(target) - 1)}-img`);
        if (image) {
          image.classList.add('targetable'); image.onclick = button.onclick;
          const highlight = () => { for(const other of doc.querySelectorAll('.targetable')) other.classList.remove('target-hover'); image.classList.add('target-hover'); };
          const unhighlight = () => image.classList.remove('target-hover');
          image.onpointerenter=button.onpointerenter=highlight;
          image.onpointerleave=button.onpointerleave=unhighlight;
          image.onfocus=button.onfocus=highlight;image.onblur=button.onblur=unhighlight;
          image.setAttribute?.('tabindex','0'); image.setAttribute?.('role','button'); image.setAttribute?.('aria-label',`选择目标：${button.textContent}`);
          image.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();button.onclick();}};
        }
      }
    } else executeMove(index, null);
  }
  function executeMove(index, target) {
    if (!canAct()) return;
    const special = selectedSpecial();
    const entry = moveChoices(active(), special === 'dynamax')[index - 1];
    if (!entry || entry.disabled || (target !== null && !allowedTargets(entry).includes(target))) return;
    const suffix = { tera:'terastallize', mega:'mega', dynamax:'dynamax' }[special];
    commit(`move ${index}${target === null ? '' : ` ${target}`}${suffix ? ` ${suffix}` : ''}`);
  }
  function showSwitch() {
    if (!canAct()) return;
    hideMenus(); hidden('switch-menu', false);
    hidden('btn-cancel-switch', !!request.forceSwitch);
    const trapped = !request.forceSwitch && active()?.trapped;
    const reviving = isReviving(request,slot());
    text('switch-menu-title',reviving ? '选择倒下的队友复活' : '选择交换');
    const choices = trapped ? [] : switchOptions(request, plan.commands, slot());
    const list = el('pokemon-list'); list.replaceChildren();
    if (!choices.length) {
      const label = doc.createElement('div'); label.textContent = trapped ? '当前无法换人' : reviving ? '没有可复活的队友' : '没有可用的后备宝可梦'; list.appendChild(label);
    }
    for (const { pokemon, slot: target } of choices) {
      const button = doc.createElement('button'); button.className = 'target-choice';
      button.textContent = `${speciesName(pokemon.details.split(',')[0], Dex)} · ${reviving ? '倒下 · 可复活' : pokemon.condition}`;
      button.onclick = () => sendSwitch(target); list.appendChild(button);
    }
  }
  function sendSwitch(target) {
    if (!canAct() || (!request.forceSwitch && active()?.trapped)) return;
    if (!switchOptions(request, plan.commands, slot()).some(p => p.slot === target)) return;
    commit(`switch ${target}`);
  }
  function commit(command) {
    onSelect();
    plan.commands[slot()] = command; cursor++; clearSpecial();
    if (cursor < plan.slots.length) showMain();
    else {
      locked = true; hideMenus(); summary(); status('行动已提交 · 正在结算');
      log('> 已提交本回合行动');
      Promise.resolve().then(() => write(plan.commands.join(', '))).catch(error => recover(error.message));
    }
  }
  function recover(message) {
    if (ended || !request || request.wait) return;
    locked = false; plan = makePlan(request); cursor = 0; clearSpecial(); showMain();
    status(`请重新选择 · ${message}`);
  }
  function setRequest(value) {
    if (ended) return;
    request = value; plan = makePlan(value); cursor = 0; clearSpecial();
    locked = !!value.wait || !plan.slots.length;
    if (value.teamPreview) { locked = true; write('default'); return; }
    hideMenus(); summary();
    if (!locked) showMain(); else status('等待对方行动');
  }
  function lock(message = '正在播放战斗') { locked = true; hideMenus(); markActor(null); hidden('slot-turn-indicator', true); hidden('undo-choice', true); status(message); }
  function reset() { ended = false; request = null; plan = { slots: [], commands: [] }; cursor = 0; opponents.fill(null); rules.gen=null;rules.used={};clearSpecial(); lock('准备战斗'); summary(); }
  function finish(message) { ended = true; request = null; lock(message); hidden('undo-choice', true); }
  function undo() {
    if (!canAct() || cursor < 1) return;
    cursor--; for (const i of plan.slots.slice(cursor)) plan.commands[i] = null;
    clearSpecial(); showMain();
  }
  function bind(window) {
    Object.assign(window, { uiShowMoves:showMoves, uiShowSwitch:showSwitch,
      uiShowGimmicks() { if (canAct() && !request.forceSwitch) { hideMenus(); updateGimmicks(); hidden('gimmick-menu', false); } },
      uiBackToMenu:showMain, uiCancelTarget:showMoves, sendMove, sendSwitch, undoBattleChoice:undo });
    for (const name of ['mega', 'tera', 'dynamax']) if (el(`check-${name}`)) el(`check-${name}`).onchange = () => {
      if (el(`check-${name}`).checked) for (const other of ['mega', 'tera', 'dynamax']) if (other !== name) el(`check-${other}`).checked = false;
    };
    window.addEventListener?.('keydown', event => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName) || event.target?.isContentEditable) return;
      if (!canAct() || !el('setup-modal')?.classList.contains('hidden')) return;
      if (event.key === 'Escape') {
        event.preventDefault();event.stopPropagation();
        if (!el('target-menu').classList.contains('hidden')) showMoves(); else showMain();
      } else if (/^[1-4]$/.test(event.key)) {
        event.preventDefault();
        const index=Number(event.key)-1;
        if(!el('target-menu').classList.contains('hidden'))el('target-buttons-list').children[index]?.onclick?.();
        else if(!el('switch-menu').classList.contains('hidden'))el('pokemon-list').children[index]?.onclick?.();
        else { if(!el('main-menu').classList.contains('hidden'))showMoves();sendMove(index+1); }
      }
    });
  }
  return { bind, setRequest, observe, lock, reset, finish, recover, showMoves, debug:() => ({ request, plan, cursor, locked, ended }) };
}
