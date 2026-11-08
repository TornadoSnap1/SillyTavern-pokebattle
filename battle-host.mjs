// Only the currently open battle frame can settle its result, once per battle.
export function createResultGate() {
  const seen=new Set();
  return (event,session)=>{
    if(!session||session.handled||event.source!==session.iframe.contentWindow||event.origin!==session.origin)return null;
    if(event.data?.type!=='BATTLE_RESULT')return null;
    const report=event.data.payload;
    if(!report||typeof report!=='object'||typeof report.battleId!=='string'||!report.battleId||seen.has(report.battleId))return null;
    const outcome=['victory','defeat','draw'].includes(report.outcome)?report.outcome:null;
    if(!outcome)return null;
    session.handled=true;seen.add(report.battleId);
    if(seen.size>200)seen.delete(seen.values().next().value);
    return {...report,outcome,isVictory:outcome==='victory'};
  };
}
export function resultLabel(report){return {victory:'胜利 (Victory)',defeat:'失败 (Defeat)',draw:'平局 (Draw)'}[report.outcome];}
