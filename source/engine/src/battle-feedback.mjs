import { Dex } from '@pkmn/sim';
import { speciesName, tr, STATUS } from './i18n.mjs';

export class RoundNotes {
  constructor() { this.reset(); }
  reset() { this.turn = 0; this.entries = []; this.previous = null; }
  add(text) { if (text && !this.entries.includes(text)) this.entries.push(text); }
  finish() { if (this.turn && this.entries.length) this.previous = { turn:this.turn, entries:this.entries.slice(0,8), omitted:Math.max(0,this.entries.length-8) }; }
  next(turn) { this.finish(); this.turn = turn; this.entries = []; }
}
const keyOf = value => value?.match(/^p[12][ab]/)?.[0];
const who = value => `${value?.startsWith('p1') ? '我方' : '敌方'}${speciesName(value?.split(': ')[1] || value || '',Dex)}`;
export function createBattleFeedback(doc, window) {
  const notes = new RoundNotes(), timers = new Set();
  let enabled = false, context = null;
  function sound(kind = 'select') {
    if (!enabled || !context || context.state !== 'running') return;
    try {
      const oscillator = context.createOscillator(), gain = context.createGain(), now = context.currentTime;
      const frequency = { select:620, move:430, critical:920, damage:160, win:740 }[kind] || 520;
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency,now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * (kind === 'damage' ? .6 : 1.15),now+.09);
      gain.gain.setValueAtTime(.0001,now); gain.gain.exponentialRampToValueAtTime(.035,now+.012); gain.gain.exponentialRampToValueAtTime(.0001,now+.13);
      oscillator.connect(gain);gain.connect(context.destination);oscillator.start(now);oscillator.stop(now+.14);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    } catch (_) { /* Audio failure must never interrupt the battle. */ }
  }
  async function toggleSound() {
    const button = doc.getElementById('battle-sound');
    try {
      if (!enabled) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) { if(button)button.textContent='当前浏览器不支持音效'; return; }
        context ||= new AudioContext(); await context.resume();
      }
      enabled = !enabled;
      button?.setAttribute('aria-pressed',String(enabled));
      if(button)button.textContent=enabled?'音效：开':'音效：关';
      sound();
    } catch (_) { enabled=false; if(button)button.textContent='音效暂不可用'; }
  }
  function float(text, key, kind = 'normal') {
    const layer = doc.getElementById('battle-feedback');if (!layer)return;
    const node=doc.createElement('span');node.className=`battle-float ${kind}`;node.textContent=text;
    const position = { p1a:[23,68],p1b:[44,77],p2a:[72,28],p2b:[87,20] }[key] || [50,45];
    const stacked=[...layer.children].filter(child=>child.dataset.slot === (key || '')).length;
    node.dataset.slot=key || '';node.style.left=`${position[0]}%`;node.style.top=`calc(${position[1]}% - ${stacked * 23}px)`;
    layer.appendChild(node);
    const timer=setTimeout(()=>{node.remove();timers.delete(timer);},1100);timers.add(timer);
  }
  function renderSummary() {
    const summary=notes.previous,list=doc.getElementById('round-notes'),title=doc.getElementById('round-summary-title');
    if(!list||!title)return;
    list.replaceChildren();
    title.textContent=summary?`第 ${summary.turn} 回合摘要`:'回合摘要（本回合结束后可查看）';
    if(summary)for(const line of [...summary.entries,...(summary.omitted?[`另有 ${summary.omitted} 条事件，见战斗日志`]:[])]){const item=doc.createElement('li');item.textContent=line;list.appendChild(item);}
  }
  function observe(line) {
    const p=line.split('|'),event=p[1],key=keyOf(p[2]);
    if(event==='turn'){notes.next(Number(p[2]));renderSummary();}
    if(event==='move'){notes.add(`${who(p[2])}使用了${tr('move',p[3])}`);sound('move');}
    const labels={ '-supereffective':'效果绝佳','-resisted':'效果不佳','-crit':'击中要害','-immune':'没有效果','-miss':'未命中','-fail':'未能生效',cant:'无法行动' };
    if(labels[event]){
      const target=event==='-miss'?(p[3]||p[2]):p[2];
      float(labels[event],keyOf(target),event==='-crit'?'critical':'normal');notes.add(`${who(target)}：${labels[event]}`);
      if(event==='-crit')sound('critical');
    }
    if(event==='-damage')sound('damage');
    if(event==='-status'){float(STATUS[p[3]]||p[3],key,'status');notes.add(`${who(p[2])}陷入${STATUS[p[3]]||p[3]}`);}
    if(event==='faint'){float('倒下',key,'fainted');notes.add(`${who(p[2])}倒下`);}
    if(event==='win'||event==='tie'){notes.finish();renderSummary();sound('win');}
  }
  function reset() {
    for(const timer of timers)clearTimeout(timer);timers.clear();
    doc.getElementById('battle-feedback')?.replaceChildren();notes.reset();renderSummary();
  }
  return { observe,reset,toggleSound,sound,notes };
}
