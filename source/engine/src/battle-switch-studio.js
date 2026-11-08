(() => {
  const hosted=new URLSearchParams(window.location.search).get('host')==='1' && window.parent!==window;
  document.documentElement.dataset.hosted=String(hosted);
  let preset='singles_mega',firstFrame=true;
  const $=id=>document.getElementById(id);
  function mode(){document.documentElement.dataset.mode=$('mode-doubles').checked?'doubles':'singles';$('studio-mode').textContent=`${$('mode-doubles').checked?'双打':'单打'} · GEN ${$('gen-gen8').checked?'8':'9'}`;}
  window.studioOpenConfig=()=>{if(!hosted)$('setup-modal').classList.remove('hidden');};
  window.studioCloseConfig=()=>{$('setup-modal').classList.add('hidden');};
  function start(){firstFrame=true;mode();window.initBattle();}
  window.studioCustomStart=()=>{if(hosted)return;preset=null;document.querySelectorAll('[data-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));start();};
  window.studioPreset=key=>{if(hosted)return;preset=key;window.applyPreset(key);document.querySelectorAll('[data-preset]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.preset===key)));start();};
  window.studioRestart=()=>{if(!hosted)preset?window.studioPreset(preset):start();};
  window.studioToggleLog=()=>{const panel=$('studio-log-panel');panel.hidden=!panel.hidden;$('studio-log-toggle').textContent=panel.hidden?'展开记录 +':'收起记录 −';$('studio-log-toggle').setAttribute('aria-expanded',String(!panel.hidden));document.querySelector('.receipt-paper').classList.toggle('is-folded',panel.hidden);};
  window.studioReplacement=()=>{document.querySelectorAll('[data-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));$('mode-singles').checked=true;$('gen-gen9').checked=true;$('p1-team-input').value='Magikarp\nLevel: 1\n- Splash\n\nPikachu\nLevel: 50\n- Thunderbolt';$('p2-team-input').value='Mewtwo\nLevel: 100\n- Psychic';window.studioCustomStart();};
  new MutationObserver(()=>{if(firstFrame&&$('action-status').textContent.startsWith('请选择行动')){firstFrame=false;window.uiShowMoves();}}).observe($('action-status'),{childList:true,subtree:true});
  new MutationObserver(()=>{const turns=[...$('log-container').querySelectorAll('div')].map(node=>node.textContent.match(/^=== 回合 (\d+) ===$/)?.[1]).filter(Boolean);$('studio-turn').textContent=`TURN ${String(turns.at(-1)||1).padStart(2,'0')}`;}).observe($('log-container'),{childList:true});
  $('setup-modal').addEventListener('click',event=>{if(event.target===$('setup-modal'))window.studioCloseConfig();});
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('setup-modal').classList.contains('hidden')){window.studioCloseConfig();event.stopPropagation();}});
  document.querySelectorAll('.joycon button[aria-label]').forEach(button=>button.title=button.getAttribute('aria-label'));
  if(hosted){
    preset=null;$('action-status').textContent='等待宿主传入对战队伍…';
    document.querySelectorAll('.hardware-top,.home-button').forEach(button=>{button.disabled=true;button.title='由宿主控制本场对战';});
    window.addEventListener('message',event=>{
      const data=event.data?.payload;
      if(event.source!==window.parent||event.data?.type!=='START_BATTLE'||typeof data?.p1?.team!=='string'||typeof data?.p2?.team!=='string')return;
      const doubles=String(data.mode||data.gameType||'').toLowerCase().includes('double');
      $('mode-doubles').checked=doubles;$('mode-singles').checked=!doubles;
      const gen8=String(data.gen||'gen9').toLowerCase().replace('gen','')==='8';
      $('gen-gen8').checked=gen8;$('gen-gen9').checked=!gen8;
      $('p1-team-input').value=data.p1.team;$('p2-team-input').value=data.p2.team;
      firstFrame=true;mode();
    });
  }else window.studioPreset(preset);
})();
