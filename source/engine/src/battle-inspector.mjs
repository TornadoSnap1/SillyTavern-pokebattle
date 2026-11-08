import { PublicBattleState } from './battle-public-state.mjs';
import { heldItemInfo,fieldInfo,statusInfo,boostInfo } from './battle-info.mjs';
import { createInfoPopover } from './battle-popover.mjs';
export function createBattleInspector(doc,window) {
  const popover=createInfoPopover(doc,window);
  let observed=new PublicBattleState();
  function renderItem(slot,record=observed.active.get(slot)) {
    const element=doc.getElementById(`${slot}-item`);if(!element)return;
    const info=heldItemInfo(record,slot.startsWith('p1'));element.textContent=info.label;popover.bind(element,info);
  }
  function renderItems(){for(const slot of ['p1a','p1b','p2a','p2b'])renderItem(slot);}
  function observe(line){observed.observe(line);renderItems();}
  function ownRequest(request){if(request?.side?.id!=='p1')return;observed.learnOwnItems(request);renderItems();}
  function chip(info,label=info.label) {const button=doc.createElement('button');button.type='button';button.className='field-chip';button.textContent=`${info.icon} ${label}`;popover.bind(button,info);return button;}
  function renderField(state) {
    popover.hide();
    const overview=doc.getElementById('field-overview');if(overview)overview.replaceChildren();
    for(const [kind,id,value] of [['weather','field-weather',state.weather],['terrain','field-terrain',state.terrain]]) {
      const rail=doc.getElementById(id);if(rail){rail.hidden=!value;rail.textContent=value?fieldInfo(kind,value).icon:'';if(value)popover.bind(rail,fieldInfo(kind,value));}
      if(value&&overview)overview.appendChild(chip(fieldInfo(kind,value)));
    }
    for(const value of state.pseudo||[])if(overview)overview.appendChild(chip(fieldInfo('field',value)));
    for(const [side,id,label] of [['p1side','p1-side-conditions','我方'],['p2side','p2-side-conditions','敌方']]) {
      const rail=doc.getElementById(id);rail?.replaceChildren();
      for(const value of state[side]||[]){const info=fieldInfo('side',value);rail?.appendChild(chip(info));overview?.appendChild(chip({...info,title:`${label} · ${info.title}`},`${label} · ${info.label}`));}
    }
    if(overview&&!overview.children.length){const text=doc.createElement('span');text.className='field-empty';text.textContent='当前无天气或场地效果';overview.appendChild(text);}
  }
  function reset(){popover.hide();observed=new PublicBattleState();renderItems();}
  return {observe,ownRequest,renderField,reset,clearSlot:slot=>renderItem(slot,null),
    status:(element,value)=>popover.bind(element,statusInfo(value)),boost:(element,stat,value)=>popover.bind(element,boostInfo(stat,value))};
}
