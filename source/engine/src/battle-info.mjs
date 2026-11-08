import { Dex } from '@pkmn/sim';
import { toId, tr, STATUS, STATS } from './i18n.mjs';
const WEATHER = {
  raindance:['下雨','🌧️','通常使水属性招式伤害变为 1.5 倍，火属性招式伤害减半。也会改变部分招式与特性的效果。'],
  sunnyday:['晴天','☀️','通常使火属性招式伤害变为 1.5 倍，水属性招式伤害减半；部分招式有例外。'],
  sandstorm:['沙暴','🌪️','通常在回合末造成天气伤害；岩石、地面、钢属性通常免疫该伤害。岩石属性宝可梦的特防变为 1.5 倍。'],
  hail:['冰雹','🌨️','通常在回合末对非冰属性宝可梦造成天气伤害；特性和道具可能使其免疫。冰雹与下雪是不同天气。'],
  snowscape:['下雪','❄️','冰属性宝可梦的防御变为 1.5 倍。与冰雹不同，下雪本身不造成回合末天气伤害。'],
  desolateland:['大日照','🌞','强化火属性攻击，并使水属性攻击招式通常无法使出。由特殊特性维持。'],
  primordialsea:['大雨','🌊','强化水属性攻击，并使火属性攻击招式通常无法使出。由特殊特性维持。'],
  deltastream:['乱流','🌬️','削弱飞行属性带来的弱点；双属性的另一属性仍可能让目标受到克制伤害。'],
};
const EFFECTS = {
  electricterrain:['电气场地','⚡','接地宝可梦使用的电属性招式得到强化，并受到防止陷入睡眠的保护。'],
  grassyterrain:['青草场地','🌿','接地宝可梦使用的草属性招式得到强化，回合末通常回复最大 HP 的 1/16；也会削弱地震等部分招式。'],
  psychicterrain:['精神场地','🔮','接地宝可梦使用的超能力招式得到强化；接地目标受到对手先制招式的保护。'],
  mistyterrain:['薄雾场地','🌫️','接地目标受到防止异常状态和混乱的保护，受到的龙属性招式伤害通常减半。'],
  reflect:['反射壁','🛡️','减轻我方受到的物理招式伤害。单打通常减半；双打减伤比例不同。要害等情况有例外。'],
  lightscreen:['光墙','🔰','减轻我方受到的特殊招式伤害。单打通常减半；双打减伤比例不同。要害等情况有例外。'],
  auroraveil:['极光幕','🌈','同时减轻我方受到的物理和特殊招式伤害，不能简单地与反射壁、光墙叠加减伤。'],
  tailwind:['顺风','💨','我方宝可梦的速度通常变为 2 倍。它改变速度，不改变招式本身的优先度。'],
  stealthrock:['隐形岩','🪨','对进入场上的目标造成伤害，伤害会受目标对岩石属性的相性影响。'],
  spikes:['撒菱','🔺','伤害换入场地的接地目标；最多叠加 3 层，层数越多伤害越高。'],
  toxicspikes:['毒菱','☠️','使换入的接地目标中毒；叠加到 2 层时通常为剧毒。接地的毒属性宝可梦可清除毒菱。'],
  stickyweb:['黏黏网','🕸️','通常令换入场地的接地目标速度降低 1 个能力阶级。'],
  trickroom:['戏法空间','⏳','同一优先度内通常由速度较慢者先行动；不颠倒招式的优先度。'],
  magicroom:['魔法空间','◇','暂时使携带物的效果失效；道具并未因此被移除，部分道具有例外。'],
  wonderroom:['奇妙空间','↔','暂时交换宝可梦的防御与特防；实际伤害仍由引擎按招式与其他修正计算。'],
  gravity:['重力','⬇️','提高招式命中率，并改变部分腾空、接地判定；部分腾空招式无法使用。'],
};
const ITEM_EFFECTS = {
  leftovers:'每回合结束时通常回复最大 HP 的 1/16。',
  lifeorb:'攻击伤害通常变为 1.3 倍，攻击后会损失最大 HP 的 1/10；部分特性会影响这些效果。',
  choicespecs:'特攻变为 1.5 倍，但通常只能使用锁定的第一种招式，换下后解除锁定。',
  choiceband:'攻击变为 1.5 倍，但通常只能使用锁定的第一种招式，换下后解除锁定。',
  choicescarf:'速度变为 1.5 倍，但通常只能使用锁定的第一种招式，换下后解除锁定。',
  focussash:'满 HP 时，通常能以 1 HP 承受一次原本会被击倒的攻击。发动后消耗。',
  sitrusberry:'HP 不高于一半时，通常回复最大 HP 的 1/4。发动后消耗。',
  lightball:'皮卡丘携带时，攻击和特攻变为 2 倍。',
  assaultvest:'特防变为 1.5 倍，但通常不能选择变化招式。',
  weaknesspolicy:'受到效果绝佳的攻击时，通常令攻击、特攻各提高 2 阶。发动后消耗。',
  clearamulet:'防止对手降低携带者的能力阶级。',
};
const STATUS_EFFECTS={par:'速度通常减半，每次行动有一定概率无法行动。',slp:'睡眠时通常不能使用多数招式，醒来后恢复；部分招式可在睡眠中使用。',brn:'回合末通常损失 HP，物理招式伤害通常减半。',psn:'每回合通常损失最大 HP 的 1/8。',tox:'回合末中毒伤害会逐次增加。',frz:'通常无法行动，解冻后恢复；部分招式可以解冻。',fnt:'已经倒下，无法继续行动；需要换人或适用的复活效果。'};
export function fieldInfo(kind,value) {
  let id=toId(String(value||'').replace(/^move:\s*/i,''));
  id=({snow:'snowscape',harshsunshine:'desolateland',heavyrain:'primordialsea'})[id]||id;
  const entry=(kind==='weather'?WEATHER:EFFECTS)[id];
  const raw=String(value||'').replace(/^move:\s*/i,'');
  const label=entry?.[0]||tr('move',raw)||'无';
  return {id,label,icon:entry?.[1]||'◇',title:label,
    description:entry?.[2]||Dex.moves.get(raw).shortDesc||'该效果正在生效；目前没有对应的中文效果说明。',
    footer:'主要效果说明。道具、特性、接地状态和世代可能影响结果；以本场引擎结算为准，不推测剩余回合。'};
}
export function heldItemInfo(record,own=false) {
  if(!record?.itemKnown)return {label:own?'携带：载入中':'携带：未公开',title:own?'携带物载入中':'敌方携带物尚未公开',description:own?'等待本场己方队伍信息。':'只有对战中公开的道具才会显示，不读取敌方隐藏队伍配置。'};
  if(!record.item){const old=record.lastItem?tr('item',record.lastItem):'';return {label:'携带：无',title:'当前没有携带物',description:old?`原携带物：${old}。${record.itemState==='consumed'?'已经消耗。':'已经离身。'}`:'当前队伍信息或公开事件表明没有携带物。'};}
  const item=Dex.items.get(record.item),name=tr('item',item.name||record.item);
  return {label:`携带：${name}`,title:name,description:ITEM_EFFECTS[item.id]||((item.shortDesc||item.desc)?`效果资料（英文）：${item.shortDesc||item.desc}`:'目前没有该携带物的效果说明。'),footer:'显示本场当前携带物。效果可能被招式、特性或场地暂时抑制。'};
}
export function statusInfo(status) {return {title:STATUS[status]||status,description:STATUS_EFFECTS[status]||'当前异常状态。',footer:'特性、道具与招式可能改变实际效果。'};}
export function boostInfo(stat,value) {return {title:`${STATS[stat]||stat} ${value>0?'+':''}${value} 阶`,description:'这是能力阶级变化，不是直接加减基础数值。换下通常会重置；部分招式和特性有例外。'};}
