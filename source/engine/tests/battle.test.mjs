import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Dex, Teams, Battle } from '@pkmn/sim';
import { BattleStream, getPlayerStreams } from '../node_modules/@pkmn/sim/build/esm/sim/battle-stream.mjs';
import { RandomPlayerAI } from '../node_modules/@pkmn/sim/build/esm/sim/tools/random-player-ai.mjs';
import { Sets } from '@pkmn/sets';
import vm from 'node:vm';
import { BasicPlayerAI } from '../src/basic-ai.mjs';
import { makePlan, switchOptions, targetsFor, moveChoices, gimmicksFor, gimmickReason } from '../src/battle-choices.mjs';
import { PublicBattleState, defensiveTypes, teraFromDetails } from '../src/battle-public-state.mjs';
import { heldItemInfo,fieldInfo,statusInfo } from '../src/battle-info.mjs';
import { createBattleControls } from '../src/battle-controls.mjs';
import { BattlePlayback } from '../src/battle-playback.mjs';
import { RoundNotes, createBattleFeedback } from '../src/battle-feedback.mjs';
import { speciesName, tr, escapeHtml } from '../src/i18n.mjs';
const tick = () => new Promise(resolve => setImmediate(resolve));
const pokemon = (name, active = true, condition = '100/100') => ({ details:name, active, condition });
const active = (move = 'Thunderbolt', target = 'normal') => ({ moves:[{ move, id:Dex.moves.get(move).id, target, pp:10, maxpp:10 }] });
function documentStub() {
  const elements = new Map();
  function element() {
    const classes = new Set();
    const attributes = new Map();
    return { textContent:'', innerHTML:'', children:[], checked:false, disabled:false,style:{},dataset:{},setAttribute(key,value){attributes.set(key,value)},getAttribute:key=>attributes.get(key),removeAttribute(key){attributes.delete(key)},remove(){},
      classList:{ add(...names) { names.forEach(n => classes.add(n)); }, remove(...names) { names.forEach(n => classes.delete(n)); }, contains:n => classes.has(n), toggle(n, force) { if (force ?? !classes.has(n)) classes.add(n); else classes.delete(n); } },
      replaceChildren() { this.children = []; }, appendChild(child) { this.children.push(child); } };
  }
  return { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, createElement:element,
    querySelectorAll() { return [...elements.values()].filter(e => e.classList.contains('targetable')); } };
}
function controls(request) {
  const document = documentStub(), window = {}, writes = [];
  const controller = createBattleControls({ document, write:command => writes.push(command) });
  controller.bind(window); controller.setRequest(request);
  return { document, window, writes, controller };
}
test('translations cover species, moves, abilities, items and safe fallback', () => {
  assert.equal(speciesName('Pikachu', Dex), '皮卡丘');
  assert.match(speciesName('Charizard-Mega-X', Dex), /喷火龙.*X/);
  assert.equal(tr('move','Thunderbolt'), '十万伏特');
  assert.equal(tr('ability','Levitate'), '飘浮');
  assert.equal(tr('item','Leftovers'), '吃剩的东西');
  assert.equal(tr('move','Future Unknown Move'), 'Future Unknown Move');
  assert.equal(escapeHtml('<img>'), '&lt;img&gt;');
});
test('forced replacement retains pass positions and handles scarce reserves', () => {
  const req = { forceSwitch:[false,true], side:{pokemon:[pokemon('Pikachu'),pokemon('Eevee',true,'0 fnt'),pokemon('Snorlax',false)]} };
  assert.deepEqual(makePlan(req), { slots:[1], commands:['pass',null] });
  assert.deepEqual(makePlan({...req,forceSwitch:[true,true]}), { slots:[0],commands:[null,'pass'] });
  assert.equal(switchOptions(req,['pass','switch 3']).length,0);
});
test('fainted doubles slot gets pass while living slot can act', () => {
  assert.deepEqual(makePlan({active:[active(),active()],side:{pokemon:[pokemon('Pikachu',true,'0 fnt'),pokemon('Eevee')]}}),{slots:[1],commands:['pass',null]});
});
test('target rules distinguish foe-only, ally-only, self and unavailable slots', () => {
  assert.deepEqual(targetsFor('adjacentFoe',0,[true,true],[true,false]),[1]);
  assert.deepEqual(targetsFor('normal',0,[true,true],[true,true]),[1,2,-2]);
  assert.deepEqual(targetsFor('adjacentAlly',1,[true,true],[true,true]),[-1]);
  assert.deepEqual(targetsFor('adjacentAllyOrSelf',0,[true,false],[true,true]),[-1]);
  assert.deepEqual(targetsFor('allAdjacentFoes',0,[true,true],[true,true]),[]);
});
test('max moves remain displayed throughout Dynamax and slots have separate capabilities', () => {
  const maxMoves = { maxMoves:[{move:'maxlightning',target:'adjacentFoe'}] };
  assert.equal(moveChoices({...active(),maxMoves,canDynamax:false})[0].move,'maxlightning');
  const req={active:[{canDynamax:true},{canTerastallize:'Normal'}]};
  assert.equal(gimmicksFor(req,1).dynamax,false);
  assert.equal(gimmicksFor(req,1,['move 1 terastallize']).tera,false);
});
test('forced replacement opens menu and emits pass + correct switch', async () => {
  const c=controls({forceSwitch:[false,true],side:{pokemon:[pokemon('Pikachu'),pokemon('Eevee',true,'0 fnt'),pokemon('Snorlax',false)]}});
  assert.equal(c.document.getElementById('switch-menu').classList.contains('hidden'),false);
  c.window.sendMove(1); c.window.uiBackToMenu();
  assert.equal(c.writes.length,0);
  c.window.sendSwitch(3); await tick();
  assert.deepEqual(c.writes,['pass, switch 3']);
});
test('max move display derives power and category from underlying move', () => {
  const c=controls({active:[{...active('Flamethrower'),maxMoves:{maxMoves:[{move:'maxflare',target:'adjacentFoe'}]}}],side:{pokemon:[pokemon('Charizard')]}});
  c.window.uiShowMoves();
  assert.match(c.document.getElementById('move-btn-1').title,/威力 130/);
  assert.match(c.document.getElementById('move-btn-1').innerHTML,/特殊/);
});
test('doubles duplicate switch is rejected, undo clears old reservation', async () => {
  const req={active:[active(),active()],side:{pokemon:[pokemon('Pikachu'),pokemon('Eevee'),pokemon('Snorlax',false),pokemon('Zapdos',false)]}};
  const c=controls(req);
  c.window.sendSwitch(3); c.window.sendSwitch(3); await tick(); assert.equal(c.writes.length,0);
  c.window.undoBattleChoice(); assert.equal(c.controller.debug().cursor,0);
  c.window.sendSwitch(4); c.window.sendSwitch(3); await tick(); assert.deepEqual(c.writes,['switch 4, switch 3']);
  c.window.sendSwitch(3); await tick(); assert.equal(c.writes.length,1);
});
test('illegal choice recovery reopens menu and allows resubmission', async () => {
  const c=controls({active:[active()],side:{pokemon:[pokemon('Pikachu')]}});
  c.window.sendMove(1); await tick(); assert.equal(c.controller.debug().locked,true);
  c.controller.recover('invalid target'); assert.equal(c.controller.debug().locked,false);
  c.window.sendMove(1); await tick(); assert.equal(c.writes.length,2);
});
test('trapped Pokemon cannot switch and unavailable gimmicks cannot be submitted', async () => {
  const c=controls({active:[{...active(),trapped:true}],side:{pokemon:[pokemon('Pikachu'),pokemon('Snorlax',false)]}});
  c.window.sendSwitch(2); c.document.getElementById('check-dynamax').checked=true;
  c.window.sendMove(1); await tick(); assert.deepEqual(c.writes,['move 1']);
});
test('ally moves target partner and fainted foes are excluded', async () => {
  const c=controls({active:[active('Helping Hand','adjacentAlly'),active()],side:{pokemon:[pokemon('Pikachu'),pokemon('Eevee')]}});
  c.controller.observe('|switch|p2a: Gengar|Gengar|100/100');
  c.controller.observe('|switch|p2b: Snorlax|Snorlax|0 fnt');
  c.window.sendMove(1);
  const buttons=c.document.getElementById('target-buttons-list').children;
  assert.equal(buttons.length,1); buttons[0].onclick();
  c.window.sendMove(1);
  const next=c.document.getElementById('target-buttons-list').children;
  assert.equal(next.length,2); assert.ok(next.every(b=>!b.textContent.includes('卡比兽')));
  next[0].onclick(); await tick(); assert.deepEqual(c.writes,['move 1 -2, move 1 1']);
});
test('finished battle ignores actions and new request; reset clears opponent state', async () => {
  const c=controls({active:[active()],side:{pokemon:[pokemon('Pikachu')]}});
  c.controller.finish('平局'); c.window.sendMove(1); c.controller.setRequest({active:[active()]}); await tick();
  assert.equal(c.writes.length,0); assert.equal(c.controller.debug().ended,true);
  c.controller.reset(); assert.equal(c.controller.debug().ended,false);
});
test('playback preserves order, skip drains, cancellation suppresses old actions', async () => {
  const output=[],p=new BattlePlayback();p.enqueue(()=>output.push(1),1000);p.enqueue(()=>output.push(2),1000);p.skip();await p.whenIdle();assert.deepEqual(output,[1,2]);
  const old=new BattlePlayback();old.enqueue(()=>output.push(3),1000);old.enqueue(()=>output.push(4));old.cancel();await old.whenIdle();assert.deepEqual(output,[1,2,3]);
});
test('playback errors are surfaced and remaining actions cancelled', async () => {
  const errors=[],p=new BattlePlayback(e=>errors.push(e.message));p.enqueue(()=>{throw Error('test')});await tick();assert.deepEqual(errors,['test']);assert.equal(p.cancelled,true);
});
test('round summaries preserve completed round and reset between games', () => {
  const notes=new RoundNotes();notes.next(1);notes.add('a');notes.add('a');notes.add('b');notes.next(2);
  assert.deepEqual(notes.previous,{turn:1,entries:['a','b'],omitted:0});
  assert.deepEqual(notes.entries,[]);notes.add('c');notes.finish();assert.equal(notes.previous.turn,2);
  notes.reset();assert.equal(notes.previous,null);
});
test('event feedback uses received events and audio is opt-in', () => {
  const document=documentStub(),feedback=createBattleFeedback(document,{});
  feedback.observe('|turn|1');feedback.observe('|move|p1a: Pikachu|Thunderbolt|p2a: Eevee');feedback.observe('|-crit|p2a: Eevee');feedback.observe('|-status|p2a: Eevee|par');feedback.observe('|turn|2');
  assert.equal(feedback.notes.previous.entries.length,3);
  assert.match(document.getElementById('round-summary-title').textContent,/第 1 回合/);
  assert.equal(document.getElementById('battle-feedback').children.length,2);
  feedback.reset();assert.equal(feedback.notes.previous,null);
});
test('keyboard shortcuts select moves, ignore typing and cannot submit twice', async () => {
  const document=documentStub(),writes=[];let keydown;
  document.getElementById('setup-modal').classList.add('hidden');
  const window={addEventListener(type,callback){if(type==='keydown')keydown=callback}};
  const c=createBattleControls({document,write:command=>writes.push(command)});c.bind(window);
  c.setRequest({active:[active()],side:{pokemon:[pokemon('Pikachu')]}});
  keydown({key:'1',target:{tagName:'TEXTAREA'},preventDefault(){}});await tick();assert.equal(writes.length,0);
  keydown({key:'1',target:{tagName:'BODY'},preventDefault(){}});keydown({key:'1',target:{tagName:'BODY'},preventDefault(){}});await tick();assert.deepEqual(writes,['move 1']);
});
test('basic AI avoids type immunity and fixes gen9 terastallization', () => {
  let command='';const ai=new BasicPlayerAI({write:c=>{command=c}},{seed:[1,2,3,4]});
  ai.receiveLine('|switch|p1a: Gengar|Gengar|100/100');
  ai.receiveRequest({side:{id:'p2',pokemon:[{...pokemon('Pikachu'),stats:{atk:50,spa:100}}]},active:[{canTerastallize:'Electric',moves:[{move:'Quick Attack',target:'normal'},{move:'Thunderbolt',target:'normal'}]}]});
  assert.equal(command,'move 2 terastallize');
  assert.equal(ai.seen.has('p1b'),false);
});
test('target hover, list focus and keyboard activation are linked and cleaned', async () => {
  const c=controls({active:[active(),active()],side:{pokemon:[pokemon('Pikachu'),pokemon('Eevee')]}});
  c.controller.observe('|switch|p2a: Gengar|Gengar|100/100');c.window.sendMove(1);
  const button=c.document.getElementById('target-buttons-list').children[0],image=c.document.getElementById('p2a-img');
  button.onpointerenter();assert.equal(image.classList.contains('target-hover'),true);
  button.onpointerleave();assert.equal(image.classList.contains('target-hover'),false);
  image.onfocus();assert.equal(image.classList.contains('target-hover'),true);
  assert.equal(image.getAttribute('role'),'button');
  image.onkeydown({key:'Enter',preventDefault(){},stopPropagation(){}});
  assert.equal(c.controller.debug().cursor,1);assert.equal(image.classList.contains('targetable'),false);
  assert.equal(image.classList.contains('target-hover'),false);assert.equal(image.getAttribute('tabindex'),undefined);
});
test('revival menu permits only fainted targets and uses engine switch command', async () => {
  const req={forceSwitch:[true],side:{pokemon:[{...pokemon('Pawmot'),reviving:true},pokemon('Eevee',false,'0 fnt'),pokemon('Snorlax',false)]}};
  const c=controls(req);assert.deepEqual(c.controller.debug().plan.slots,[0]);
  assert.match(c.document.getElementById('switch-menu-title').textContent,/复活/);
  c.window.sendSwitch(3);assert.equal(c.writes.length,0);
  c.window.sendSwitch(2);await tick();assert.deepEqual(c.writes,['switch 2']);
  // Revival can also target a fainted active position in doubles.
  const double={...req,forceSwitch:[true,false],side:{pokemon:[req.side.pokemon[0],pokemon('Eevee',true,'0 fnt')]}};
  assert.deepEqual(switchOptions(double,[],0).map(p=>p.slot),[2]);
});
test('real engine Revival Blessing request is usable by both UI plan and AI', () => {
  const b=new Battle({formatid:'gen9customgame',seed:[1,2,3,4]});
  b.setPlayer('p1',{team:Teams.pack([{species:'Geodude',moves:['Explosion']},{species:'Pawmot',moves:['Revival Blessing','Tackle']}])});
  b.setPlayer('p2',{team:Teams.pack([{species:'Gengar',moves:['Splash']}])});
  b.choose('p1','default');b.choose('p2','default');b.choose('p1','move 1');b.choose('p2','move 1');b.choose('p1','switch 2');b.choose('p1','move 1');b.choose('p2','move 1');
  const req=b.p1.activeRequest;assert.equal(req.side.pokemon[0].reviving,true);assert.deepEqual(makePlan(req).slots,[0]);
  let choice='';new BasicPlayerAI({write:c=>choice=c}).receiveRequest(req);assert.equal(choice,'switch 2');
  assert.equal(b.choose('p1',choice),true);assert.ok(b.p1.pokemon.find(p=>p.species.name==='Geodude').hp>0);
});
test('public observer follows tera, forms, ability sources and switch-back', () => {
  const state=new PublicBattleState();state.observe('|switch|p1a: Gengar|Gengar|100/100');
  state.observe('|-terastallize|p1a: Gengar|Dark');assert.deepEqual(defensiveTypes(state.active.get('p1a')),['Dark']);
  state.observe('|switch|p1a: Eevee|Eevee|100/100');state.observe('|switch|p1a: Gengar|Gengar, tera:Dark|100/100');
  assert.deepEqual(defensiveTypes(state.active.get('p1a')),['Dark']);assert.equal(teraFromDetails('Gengar, L50, M, tera:Dark'),'Dark');
  state.observe('|switch|p2a: Arcanine|Arcanine|100/100');state.observe('|-start|p2a: Arcanine|ability: Flash Fire');
  assert.equal(state.active.get('p2a').ability,'Flash Fire');
  state.observe('|-ability|p1a: Gengar|Flash Fire|[from] ability: Trace|[of] p2a: Arcanine');
  assert.equal(state.active.get('p1a').ability,'Flash Fire');assert.equal(state.active.get('p2a').ability,'Flash Fire');
  state.observe('|switch|p1a: Eevee|Eevee|100/100');state.observe('|switch|p1a: Gengar|Gengar, tera:Dark|100/100');assert.equal(state.active.get('p1a').ability,null);
  state.observe('|switch|p1b: Gyarados|Gyarados|100/100');state.observe('|detailschange|p1b: Gyarados|Gyarados-Mega|100/100');assert.deepEqual(defensiveTypes(state.active.get('p1b')),['Water','Dark']);
});
test('AI avoids already revealed Dark tera immunity and Flash Fire', () => {
  let choice='';const ai=new BasicPlayerAI({write:c=>choice=c},{seed:[1,2,3,4]});
  ai.receiveLine('|switch|p1a: Gengar|Gengar|100/100');ai.receiveLine('|-terastallize|p1a: Gengar|Dark');
  ai.receiveRequest({side:{id:'p2',pokemon:[{...pokemon('Alakazam'),stats:{spa:100,atk:50}}]},active:[{moves:[{move:'Psychic',target:'normal'},{move:'Dazzling Gleam',target:'normal'}]}]});assert.equal(choice,'move 2');
  ai.receiveLine('|switch|p1a: Arcanine|Arcanine|100/100');ai.receiveLine('|-start|p1a: Arcanine|ability: Flash Fire');
  ai.receiveRequest({side:{id:'p2',pokemon:[{...pokemon('Charizard'),stats:{spa:100,atk:50}}]},active:[{moves:[{move:'Flamethrower',target:'normal'},{move:'Slash',target:'normal'}]}]});assert.equal(choice,'move 2');
});
test('gimmick menu previews tera and displays confirmed unavailability reasons', () => {
  const req={active:[{...active(),canTerastallize:'Dark'}],side:{pokemon:[{...pokemon('Eevee'),teraType:'Dark'}]}};
  const c=controls(req);assert.match(c.document.getElementById('gimmick-name-tera').textContent,/恶/);
  c.controller.observe('|gen|9');c.window.uiShowGimmicks();assert.match(c.document.getElementById('gimmick-reason-dynamax').textContent,/规则不支持/);
  assert.match(gimmickReason('mega',req,0,[],{used:{mega:true}}),/本场/);
  assert.match(gimmickReason('tera',req,0,['move 1 terastallize']),/另一只/);
});
test('own item request does not reveal opponent item, public activation does', () => {
  const state=new PublicBattleState();state.observe('|switch|p1a: Pikachu|Pikachu|100/100');state.observe('|switch|p2a: Snorlax|Snorlax|100/100');
  state.learnOwnItems({side:{id:'p1',pokemon:[{ident:'p1: Pikachu',item:'lightball'}]}});
  assert.match(heldItemInfo(state.active.get('p1a'),true).label,/电气球/);
  assert.match(heldItemInfo(state.active.get('p2a')).label,/未公开/);
  state.observe('|-heal|p2a: Snorlax|90/100|[from] item: Leftovers');
  assert.match(heldItemInfo(state.active.get('p2a')).label,/吃剩的东西/);
  state.observe('|switch|p2a: Eevee|Eevee|100/100');state.observe('|switch|p2a: Snorlax|Snorlax|90/100');
  assert.equal(state.active.get('p2a').item,'Leftovers');
});
test('consumed item stays absent through follow-up effects; new item replaces it', () => {
  const state=new PublicBattleState();state.observe('|switch|p2a: Snorlax|Snorlax|100/100');
  state.observe('|-enditem|p2a: Snorlax|Sitrus Berry|[eat]');
  state.observe('|-heal|p2a: Snorlax|75/100|[from] item: Sitrus Berry');
  assert.equal(state.active.get('p2a').item,'');assert.match(heldItemInfo(state.active.get('p2a')).description,/已经消耗/);
  state.observe('|-item|p2a: Snorlax|Choice Scarf|[from] move: Trick');assert.equal(state.active.get('p2a').item,'Choice Scarf');
  state.observe('|-enditem|p2a: Snorlax|Choice Scarf|[from] move: Knock Off');assert.equal(heldItemInfo(state.active.get('p2a')).label,'携带：无');
});
test('item source belongs to [of] owner and Mega stone becomes public', () => {
  const state=new PublicBattleState();state.observe('|switch|p1a: Pikachu|Pikachu|100/100');state.observe('|switch|p2a: Blastoise|Blastoise|100/100');
  state.observe('|-damage|p1a: Pikachu|80/100|[from] item: Rocky Helmet|[of] p2a: Blastoise');
  assert.equal(state.active.get('p2a').item,'Rocky Helmet');assert.equal(state.active.get('p1a').itemKnown,false);
  state.observe('|-mega|p2a: Blastoise|Blastoise|Blastoisinite');assert.equal(state.active.get('p2a').item,'Blastoisinite');
});
test('field descriptions distinguish hail/snow and grounded terrains', () => {
  assert.match(fieldInfo('weather','Hail').description,/天气伤害/);
  assert.match(fieldInfo('weather','Snowscape').description,/防御.*1.5/);
  assert.match(fieldInfo('terrain','Psychic Terrain').description,/接地/);
  assert.match(fieldInfo('side','Tailwind').description,/速度.*2 倍/);
  assert.match(statusInfo('par').description,/减半/);
});
test('real engine berry event sequence does not resurrect consumed held item', () => {
  const b=new Battle({formatid:'gen9customgame',seed:[1,2,3,4]});
  // 4 HP EVs makes max HP even, so Belly Drum reaches the berry threshold.
  b.setPlayer('p1',{team:Teams.pack([{species:'Snorlax',item:'Sitrus Berry',evs:{hp:4},moves:['Belly Drum']}])});b.setPlayer('p2',{team:Teams.pack([{species:'Eevee',moves:['Splash']}])});
  b.choose('p1','default');b.choose('p2','default');b.choose('p1','move 1');b.choose('p2','move 1');
  const state=new PublicBattleState();for(const line of b.log)state.observe(line);
  assert.ok(b.log.some(line=>line.startsWith('|-enditem|')));assert.equal(state.active.get('p1a').item,'');
  assert.match(heldItemInfo(state.active.get('p1a'),true).description,/文柚果/);
});
test('forced switch plan accepted by real engine with only one reserve', () => {
  const team=Teams.pack([{species:'Geodude',moves:['Explosion']},{species:'Geodude',moves:['Explosion']},{species:'Snorlax',moves:['Tackle']}]);
  const enemy=Teams.pack([{species:'Gengar',moves:['Splash']},{species:'Haunter',moves:['Splash']}]);
  const b=new Battle({formatid:'gen9doublescustomgame',seed:[1,2,3,4]});b.setPlayer('p1',{team});b.setPlayer('p2',{team:enemy});b.choose('p1','default');b.choose('p2','default');
  b.choose('p1','move 1, move 1');b.choose('p2','move 1, move 1');
  const req=b.p1.activeRequest;const plan=makePlan(req);
  assert.equal(plan.slots.length,1);plan.commands[plan.slots[0]]='switch 3';
  assert.equal(b.choose('p1',plan.commands.join(', ')),true);
});
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
test('room start/end does not overwrite an independently active terrain', () => {
  const context={controls:{observe(){}},feedback:{observe(){}},log(){},escapeHtml:s=>s,updateSideConditions(){},fieldState:{terrain:'',pseudo:[]}};
  vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function handleBattleLine('),source.indexOf('function finishBattle(')),context);
  context.handleBattleLine('|-fieldstart|move: Grassy Terrain',{});context.handleBattleLine('|-fieldstart|move: Trick Room',{});
  assert.equal(context.fieldState.terrain,'Grassy Terrain');assert.equal(context.fieldState.pseudo[0],'Trick Room');
  context.handleBattleLine('|-fieldend|move: Trick Room',{});assert.equal(context.fieldState.terrain,'Grassy Terrain');assert.equal(context.fieldState.pseudo.length,0);
});
test('bench revival never updates active HP; faint-only events empty the active bar', () => {
  const hp=[],balls=[];
  const context={controls:{observe(){}},feedback:{observe(){}},log(){},normalizeTargetId:raw=>raw.match(/^p[12][ab]/)?.[0],
    htmlName:name=>name,updateHPUI:(...args)=>hp.push(args),updatePokeballs:(...args)=>balls.push(args),
    document:documentStub(),p2FaintedCount:1,p2TotalPokemon:3};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function handleBattleLine('),source.indexOf('function finishBattle(')),context);
  context.handleBattleLine('|-heal|p1: Geodude|110/221|[from] move: Revival Blessing',{});
  assert.equal(hp.length,0);
  context.handleBattleLine('|-heal|p2: Geodude|110/221|[from] move: Revival Blessing',{});
  assert.equal(context.p2FaintedCount,0);assert.deepEqual(balls[0],['p2',3,3]);
  context.handleBattleLine('|faint|p1a: Geodude',{});
  assert.deepEqual(hp,[['p1a','0 fnt']]);
});
const presetBlock=source.slice(source.indexOf('const PRESET_TEAMS'),source.indexOf('window.applyPreset'));
const context={};vm.createContext(context);vm.runInContext(presetBlock+';this.presets=PRESET_TEAMS',context);
const pack=text=>text.split(/\n\s*\n/).filter(Boolean).map(x=>Sets.pack(Sets.importSet(x))).join(']');
for(const [key,preset] of Object.entries(context.presets)) {
  test(`real engine: ${key}, basic AI vs random AI completes`,{timeout:15000},async()=>{
    const stream=new BattleStream(),streams=getPlayerStreams(stream),errors=[],lines=[];
    const a=new BasicPlayerAI(streams.p2,{seed:[5,6,7,8]});
    const b=new RandomPlayerAI(streams.p1,{move:.9,mega:.5,seed:[1,2,3,4]});
    const agents=[a.start(),b.start()].map(p=>p.catch(e=>errors.push(e.message)));
    const reader=(async()=>{for await(const chunk of streams.omniscient)lines.push(...chunk.split('\n'))})();
    await streams.omniscient.write(`>start ${JSON.stringify({formatid:preset.gen+(preset.mode==='doubles'?'doubles':'')+'customgame',seed:[10,20,30,40]})}`);
    await streams.omniscient.write(`>player p1 ${JSON.stringify({name:'Player',team:pack(preset.p1)})}`);
    await streams.omniscient.write(`>player p2 ${JSON.stringify({name:'Rival',team:pack(preset.p2)})}`);
    await reader;await Promise.all(agents);assert.deepEqual(errors,[]);assert.ok(lines.some(x=>x.startsWith('|win|')||x==='|tie'));
  });
}
