import test from 'node:test';
import assert from 'node:assert/strict';
import {createResultGate,resultLabel} from '../../../battle-host.mjs';
const origin='http://127.0.0.1:3111';
function fixture(outcome='victory',id='battle-1'){
 const source={},session={iframe:{contentWindow:source},origin,handled:false};
 return {session,event:{source,origin,data:{type:'BATTLE_RESULT',payload:{battleId:id,outcome,isVictory:false}}}};
}
test('plugin normalizes victory, defeat, draw labels without treating draw as defeat',()=>{
 for(const [outcome,label] of [['victory','胜利 (Victory)'],['defeat','失败 (Defeat)'],['draw','平局 (Draw)']]){
  const {event,session}=fixture(outcome);const report=createResultGate()(event,session);
  assert.equal(resultLabel(report),label);assert.equal(report.isVictory,outcome==='victory');
 }
});
test('plugin rejects wrong frame, wrong origin, malformed payload and messages after closing',()=>{
 const gate=createResultGate();const {event,session}=fixture();
 assert.equal(gate({...event,source:{}},session),null);
 assert.equal(gate({...event,origin:'https://other.invalid'},session),null);
 for(const payload of [null,{}, {battleId:'id',outcome:'unknown'}, {battleId:4,outcome:'draw'}]){
  assert.equal(gate({...event,data:{type:'BATTLE_RESULT',payload}},session),null);
 }
 assert.equal(session.handled,false);assert.equal(gate(event,null),null);assert.ok(gate(event,session));
});
test('plugin accepts one report per active session and deduplicates battleId across sessions',()=>{
 const gate=createResultGate();const first=fixture();assert.ok(gate(first.event,first.session));
 assert.equal(gate(first.event,first.session),null);
 const replay=fixture();assert.equal(gate(replay.event,replay.session),null);
 const next=fixture('draw','battle-2');assert.ok(gate(next.event,next.session));
});
