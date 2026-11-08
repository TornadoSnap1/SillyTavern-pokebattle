export function createInfoPopover(doc,window) {
  const popup=doc.createElement('div');popup.id='battle-info-popover';popup.className='battle-info-popover';popup.hidden=true;popup.setAttribute('role','tooltip');
  const heading=doc.createElement('strong'),description=doc.createElement('p'),footer=doc.createElement('small');popup.appendChild(heading);popup.appendChild(description);popup.appendChild(footer);doc.body.appendChild(popup);
  let anchor=null,pinned=false,timer=null;
  function hide(){clearTimeout(timer);popup.hidden=true;anchor=null;pinned=false;}
  function show(element,info,pin=false){
    clearTimeout(timer);anchor=element;pinned=pin;heading.textContent=info.title;description.textContent=info.description;footer.textContent=info.footer||'';popup.hidden=false;
    const rect=element.getBoundingClientRect(),width=doc.documentElement.clientWidth,height=window.innerHeight;
    const box=popup.getBoundingClientRect();
    popup.style.left=`${Math.max(8,Math.min(rect.left,width-box.width-8))}px`;
    popup.style.top=`${Math.max(8,rect.bottom+8+box.height<=height?rect.bottom+8:rect.top-box.height-8)}px`;
  }
  function later(){if(!pinned)timer=setTimeout(hide,130);}
  function bind(element,info){
    element.classList.add('info-trigger');element.setAttribute('aria-describedby',popup.id);
    if(element.tagName!=='BUTTON')element.tabIndex=0;
    element.onpointerenter=()=>show(element,info);element.onpointerleave=later;
    element.onfocus=()=>show(element,info);element.onblur=later;
    element.onclick=()=>{if(anchor===element&&pinned)hide();else show(element,info,true);};
    element.onkeydown=event=>{if(element.tagName!=='BUTTON'&&['Enter',' '].includes(event.key)){event.preventDefault();element.onclick();}};
    if(anchor===element&&!popup.hidden)show(element,info,pinned);
  }
  popup.onpointerenter=()=>clearTimeout(timer);popup.onpointerleave=later;
  doc.addEventListener('pointerdown',event=>{if(anchor&&!anchor.contains(event.target)&&!popup.contains(event.target))hide();});
  window.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!popup.hidden){event.preventDefault();event.stopImmediatePropagation();hide();}},true);
  return {bind,hide};
}
