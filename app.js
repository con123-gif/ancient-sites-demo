// Ancient Sites AI — AGPL-3.0-or-later. Instant answers, not a guide.
const $=s=>document.querySelector(s);let SITES=[],cur=null,pos=null,status={ai:{mode:'offline'}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=t=>esc(t).replace(/https?:\/\/[^\s,]+/g,u=>`<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
const api=(u,o)=>fetch(u,o&&o.body?{...o,headers:{'content-type':'application/json'},body:JSON.stringify(o.body)}:o).then(r=>r.json());
const uid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));
const km=m=>m<1000?Math.round(m)+' m':(m/1000).toFixed(1)+' km';
const hdist=(a,b,c,d)=>{const R=6371000,r=x=>x*Math.PI/180;const h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>show(b.dataset.tab));
function show(t){document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.id==='tab-'+t));document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===t));if(t==='here')map.invalidateSize();if(t==='report')locate();if(t==='offline')renderOffline()}
// ---- map
const map=L.map('map',{worldCopyJump:true}).setView([51.3,-1.8],6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
const cluster=L.markerClusterGroup({chunkedLoading:true}).addTo(map);const finds=L.layerGroup().addTo(map);
const colour={pilot:'#b3261e',extra:'#1f6feb',whs:'#5b4636'};
async function init(){try{status=await api('/api/status')}catch{}
 $('#aimode').textContent=status.ai.mode==='live'?`AI: live (${status.ai.provider})`:'AI: offline mode';
 if(status.sites)$('#counts').textContent=`${status.sites.total} sites loaded (${status.sites.pilot} pilot, ${status.sites.extra} extra, ${status.sites.whs} World Heritage Sites).`;
 try{SITES=await api('/api/sites');cluster.addLayers(SITES.map(s=>L.circleMarker([s.lat,s.lon],{radius:7,color:colour[s.type],fillOpacity:.8}).on('click',()=>pick(s.id))))}catch{}
 try{(await api('/api/public/reports')).forEach(c=>L.circle([c.lat,c.lon],{radius:700,color:'#e08a00',dashArray:'4'}).bindTooltip(`${c.count} report(s) in this ~1 km area`).addTo(finds))}catch{}
 const id=location.hash.slice(1);if(id)pick(id);await renderAnswersFromOutbox();updateBadge();if(navigator.onLine)flush()}
async function pick(id,{quiet}={}){let s;try{s=await api('/api/sites/'+encodeURIComponent(id))}catch{s={error:'offline'}}
 if(s.error){if(!quiet){$('#sitecard').classList.remove('hidden');$('#sitecard').innerHTML=`<p class="warn">This site isn't downloaded, so it can't be shown offline.</p>`}return}
 cur=s;history.replaceState(null,'','#'+id);$('#sitecard').classList.remove('hidden');map.invalidateSize();map.setView([s.lat,s.lon],Math.max(map.getZoom(),14));
 $('#ctx').innerHTML=`📍 Asking about <b>${esc(s.name)}</b> (or wherever your GPS says you are).`;
 const p=await DBX.get('packs',s.id).catch(()=>null);
 $('#sitecard').innerHTML=`<div class="sc-head"><div><h3>${esc(s.name)}</h3><p class="small muted">${esc(s.country||'')} · ${s.type==='whs'?'UNESCO World Heritage Site'+(s.year_inscribed?' ('+s.year_inscribed+')':''):s.type==='pilot'?'Pilot site (hand-checked)':'Extra site'}</p></div>
 <button id="dlbtn" class="${p?'ghost2 done':'ghost2'}" data-id="${esc(s.id)}">${p?'✅ Offline · '+(p.bytes/1048576).toFixed(1)+' MB':'⬇️ Download for offline'}</button></div>
 <details><summary>Key facts (${s.facts.length})</summary><ul>${s.facts.map(f=>'<li>'+esc(f)+'</li>').join('')}</ul><p class="small">Sources: ${s.sources.map(link).join(' · ')}</p></details>`;
 $('#dlbtn').onclick=e=>p?show('offline'):downloadPack(s.id,e.target)}
$('#search').oninput=e=>{const q=e.target.value.trim().toLowerCase();$('#results').innerHTML=q.length<2?'':SITES.filter(s=>(s.name+' '+(s.country||'')).toLowerCase().includes(q)).slice(0,30).map(s=>`<li data-id="${esc(s.id)}">${esc(s.name)} <span class="muted small">${esc(s.country||'')}</span></li>`).join('')};
$('#results').onclick=e=>{const li=e.target.closest('li');if(li){pick(li.dataset.id);$('#results').innerHTML='';$('#search').value=''}};
// ---- location
function getPos(timeout=8000){return new Promise(res=>{if(!navigator.geolocation)return res(pos);navigator.geolocation.getCurrentPosition(p=>{pos=p.coords;res(pos)},()=>res(pos),{enableHighAccuracy:true,timeout,maximumAge:60000})})}
function locate(cb){$('#gps').textContent='locating…';getPos(15000).then(p=>{if(!p){$('#gps').textContent='Location needed (allow location access)';return}$('#gps').textContent=`captured (±${Math.round(p.accuracy)} m) — kept private`;$('#ts').textContent=new Date().toLocaleString('en-GB');cb&&cb()})}
$('#nearme').onclick=()=>locate(async()=>{map.setView([pos.latitude,pos.longitude],12);L.circleMarker([pos.latitude,pos.longitude],{radius:8,color:'#1a7f37'}).addTo(map).bindTooltip('You');
 let r;try{r=await api(`/api/near?lat=${pos.latitude}&lon=${pos.longitude}`);if(r.error)throw 0}catch{r=await localNear(pos.latitude,pos.longitude)}
 $('#atsite').classList.remove('hidden');$('#atsite').innerHTML=(r.at?`<b>You are at ${esc(r.at.name)}!</b> `:'')+'Nearby: '+r.nearby.slice(0,5).map(s=>`<a href="#${esc(s.id)}" data-pick="${esc(s.id)}">${esc(s.name)}</a> (${km(s.distance_m)})`).join(', ');if(r.at)pick(r.at.id)});
$('#atsite').onclick=e=>{const a=e.target.closest('[data-pick]');if(a){e.preventDefault();pick(a.dataset.pick)}};
async function localNear(lat,lon){const l=SITES.map(s=>({...s,distance_m:hdist(lat,lon,s.lat,s.lon),radius_m:1000})).sort((a,b)=>a.distance_m-b.distance_m).slice(0,10);return{at:null,nearby:l}}
// ---- photo
const toData=(f,max=1600)=>new Promise(r=>{const i=new Image();i.onload=()=>{const s=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*s;c.height=i.height*s;c.getContext('2d').drawImage(i,0,0,c.width,c.height);URL.revokeObjectURL(i.src);r(c.toDataURL('image/jpeg',.8))};i.onerror=()=>r(null);i.src=URL.createObjectURL(f)});
let pendingQ=null;
$('#lookbtn').onclick=()=>{pendingQ=$('#q').value.trim()||null;getPos();$('#lookfile').value='';$('#lookfile').click()};
$('#lookfile').onchange=async e=>{const f=e.target.files[0];if(!f)return;const img=await toData(f,1024);ask(pendingQ||'What am I looking at?',img);$('#q').value=''};
$('#qform').onsubmit=e=>{e.preventDefault();const q=$('#q').value.trim();if(!q)return;$('#q').value='';ask(q,null)};
document.querySelector('.chips').onclick=e=>{const c=e.target.closest('.chip');if(!c)return;if(c.dataset.photo){pendingQ=c.dataset.q;getPos();$('#lookfile').value='';$('#lookfile').click()}else ask(c.dataset.q,null)};
// ---- voice (Web Speech API where available)
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SR){$('#mic').classList.remove('hidden');$('#mic').onclick=()=>{const r=new SR();r.lang='en-GB';r.interimResults=false;$('#mic').classList.add('rec');r.onresult=ev=>{$('#q').value=ev.results[0][0].transcript;ask($('#q').value.trim(),null);$('#q').value=''};r.onend=()=>$('#mic').classList.remove('rec');r.start()}}
// ---- ask
function card(id,q,img){const d=document.createElement('div');d.className='ans';d.dataset.id=id;d.innerHTML=`<div class="aq">${img?`<img src="${img}" alt="your photo">`:''}<b>${esc(q)}</b></div><div class="ab"><span class="spin"></span> Looking…</div>`;$('#answers').prepend(d);while($('#answers').children.length>6)$('#answers').lastChild.remove();d.scrollIntoView({block:'nearest'});return d}
function renderResult(d,r,when){const tag=r.mode==='live'?'Live AI':'Offline mode';d.querySelector('.ab').innerHTML=`<span class="tag">${tag}${r.site?.name?' · nearest: '+esc(r.site.name)+(r.site.distance_m!=null?' ('+km(r.site.distance_m)+')':''):''}${when?' · '+esc(when):''}</span><div class="atext">${link(r.answer||r.error||'')}</div>${r.note?`<p class="note small">${esc(r.note)}</p>`:''}${r.nearby?.length?`<p class="small muted">Also nearby: ${r.nearby.map(n=>`<a href="#${esc(n.id)}" data-pick="${esc(n.id)}">${esc(n.name)}</a> (${km(n.distance_m)})`).join(', ')}</p>`:''}`}
$('#answers').onclick=e=>{const a=e.target.closest('[data-pick]');if(a){e.preventDefault();pick(a.dataset.pick)}};
async function ask(q,img){const id=uid();const d=card(id,q,img);const p=await getPos(img?3000:8000);
 const body={client_id:id,question:q,image:img||undefined,lat:p?.latitude,lon:p?.longitude,accuracy:p?.accuracy,site_id:p?undefined:cur?.id,asked_at:new Date().toISOString()};
 if(!p&&!cur){d.querySelector('.ab').innerHTML='<p class="warn">I need your location (or pick a site on the map) to know what you\'re looking at.</p>';return}
 if(navigator.onLine){try{const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),25000);const r=await fetch('/api/look',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:ctl.signal});clearTimeout(t);const j=await r.json();if(!j.offline){renderResult(d,j);if(j.site?.id&&(!cur||cur.id!==j.site.id))pick(j.site.id,{quiet:true});return}}catch{}}
 await queue('look',body,id);const local=await localAnswer(body);
 d.classList.add('queued');d.querySelector('.ab').innerHTML=`<span class="tag">⏳ Queued — no connection</span><p class="small">Saved on this phone. It will be sent automatically when you're back online and the answer will appear here.</p>${local?`<div class="atext">${link(local)}</div>`:'<p class="small muted">Download sites for offline use to get stored info here with no signal.</p>'}`}
async function localAnswer(b){const packs=await DBX.all('packs').catch(()=>[]);let best=null;
 const cands=packs.flatMap(p=>[p.pack.site,...p.pack.nearby]);if(cur)cands.push(cur);
 for(const s of cands){const dd=b.lat!=null?hdist(b.lat,b.lon,s.lat,s.lon):(s.id===cur?.id?0:1e9);if(!best||dd<best.d)best={s,d:dd}}
 if(!best)return null;const s=best.s,qt=(b.question||'').toLowerCase().match(/[a-z]{4,}/g)||[];
 const hits=s.facts.filter(f=>qt.some(w=>f.toLowerCase().includes(w.slice(0,5))));
 return `From your offline pack — ${s.name}${best.d<1e8?' ('+km(best.d)+' away)':''}:\n• ${(hits.length?hits:s.facts).slice(0,3).join('\n• ')}\n\nA full answer needs a connection.`}
// ---- outbox / sync
async function queue(kind,body,id){await DBX.put('outbox',{id,kind,body,status:'queued',created:new Date().toISOString(),q:body.question||body.notes||''});updateBadge();
 try{const reg=await navigator.serviceWorker.ready;if(reg.sync)await reg.sync.register('asai-outbox')}catch{}}
async function flush(){let sent=[];try{sent=await flushOutbox()}catch{}if(sent.length)onSent(sent.map(s=>s.id))}
async function onSent(ids){for(const id of ids){const it=await DBX.get('outbox',id);if(!it)continue;
 if(it.kind==='look'){let d=document.querySelector(`.ans[data-id="${id}"]`);if(!d)d=card(id,it.q,null);d.classList.remove('queued');d.classList.add('arrived');renderResult(d,it.result,'answer arrived after reconnecting');}
 if(it.kind==='report'&&$('#repout'))$('#repout').innerHTML=it.result?.ok?`<p class="notice">Your queued report was sent. ${esc(it.result.message)}<br>Your report code: <b>${esc(it.result.code)}</b></p>`:`<p class="danger">Queued report rejected: ${esc(it.result?.error)}</p>`}
 updateBadge();if($('#tab-offline').classList.contains('active'))renderOffline()}
async function renderAnswersFromOutbox(){for(const it of (await DBX.all('outbox').catch(()=>[])).filter(i=>i.kind==='look').sort((a,b)=>a.created<b.created?-1:1).slice(-4)){const d=card(it.id,it.q,null);if(it.status==='done')renderResult(d,it.result,'sent from queue');else{d.classList.add('queued');d.querySelector('.ab').innerHTML='<span class="tag">⏳ Queued — will send when online</span>'}}}
async function updateBadge(){const n=(await DBX.all('outbox').catch(()=>[])).filter(i=>i.status==='queued').length;$('#qbadge').textContent=n;$('#qbadge').classList.toggle('hidden',!n)}
navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='outbox-sent')onSent(e.data.ids)});
const net=()=>{$('#net').classList.toggle('hidden',navigator.onLine)};addEventListener('offline',net);addEventListener('online',()=>{net();flush()});net();
// ---- offline packs
const TILE='https://tile.openstreetmap.org/';
function tileList(lat,lon,radius,zooms,max){const out=[];const dLat=radius/111320,dLon=radius/(111320*Math.cos(lat*Math.PI/180));
 const tx=(lo,z)=>Math.floor((lo+180)/360*2**z),ty=(la,z)=>{const r=la*Math.PI/180;return Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*2**z)};
 for(const z of zooms){const lvl=[];for(let x=tx(lon-dLon,z);x<=tx(lon+dLon,z);x++)for(let y=ty(lat+dLat,z);y<=ty(lat-dLat,z);y++)lvl.push(`${TILE}${z}/${x}/${y}.png`);if(out.length+lvl.length>max)break;out.push(...lvl)}return out}
async function downloadPack(id,btn){btn.disabled=true;btn.textContent='Downloading…';const c=await caches.open('asai-pack-'+id);let bytes=0,tiles=0,images=0;
 const save=async(url,opts)=>{const r=await fetch(url,opts);if(!(r.ok||r.type==='opaque'))throw Error(r.status);const b=await r.clone().blob();bytes+=b.size;await c.put(url,r.clone());return r};
 try{const pr=await save('/api/sites/'+encodeURIComponent(id)+'/pack');const pack=await pr.clone().json();await save('/api/sites/'+encodeURIComponent(id));
  for(const n of pack.nearby)await save('/api/sites/'+encodeURIComponent(n.id)).catch(()=>{});
  const list=tileList(pack.site.lat,pack.site.lon,pack.tiles.radius_m,pack.tiles.zooms,pack.tiles.max);
  for(let i=0;i<list.length;i+=2){await Promise.all(list.slice(i,i+2).map(u=>save(u,{mode:'cors'}).then(()=>tiles++).catch(()=>{})));btn.textContent=`Map tiles ${Math.min(i+2,list.length)}/${list.length}…`}
  for(const u of pack.images)await save(u,{mode:'no-cors'}).then(()=>images++).catch(()=>{});
  await DBX.put('packs',{id,name:pack.site.name,lat:pack.site.lat,lon:pack.site.lon,bytes,tiles,tilesWanted:list.length,images,nearby:pack.nearby.length,date:new Date().toISOString(),pack});
  try{await navigator.storage?.persist?.()}catch{}
  btn.disabled=false;btn.classList.add('done');btn.textContent='✅ Offline · '+(bytes/1048576).toFixed(1)+' MB';btn.onclick=()=>show('offline')}
 catch(e){console.warn('pack download failed',e);btn.disabled=false;btn.textContent='⚠️ Download failed — retry';await caches.delete('asai-pack-'+id)}}
async function renderOffline(){const packs=await DBX.all('packs').catch(()=>[]);const tot=packs.reduce((a,p)=>a+p.bytes,0);let est='';
 try{const e=await navigator.storage.estimate();est=` · this app uses ${(e.usage/1048576).toFixed(1)} MB of ${(e.quota/1073741824).toFixed(1)} GB available`}catch{}
 $('#storage').innerHTML=`<b>${packs.length} site${packs.length==1?'':'s'} downloaded</b> · packs ${(tot/1048576).toFixed(2)} MB${est}`;
 $('#packs').innerHTML=packs.length?packs.map(p=>`<li><div><b>${esc(p.name)}</b><br><span class="small muted">${(p.bytes/1048576).toFixed(2)} MB · ${p.tiles}/${p.tilesWanted} map tiles · ${p.nearby} nearby sites · ${p.images} images · ${new Date(p.date).toLocaleDateString('en-GB')}</span></div><span><button class="ghost2" data-open="${esc(p.id)}">Open</button> <button class="del" data-del="${esc(p.id)}">Delete</button></span></li>`).join(''):'<li class="muted">No sites downloaded yet. Open a site and tap “Download for offline”.</li>';
 const ob=(await DBX.all('outbox').catch(()=>[])).sort((a,b)=>a.created<b.created?1:-1);
 $('#outbox').innerHTML=ob.length?ob.map(i=>`<li><div>${i.kind==='report'?'📝 Find report':'❓ '+esc(i.q)}<br><span class="small muted">${new Date(i.created).toLocaleString('en-GB')} · ${i.status==='queued'?'⏳ waiting for connection':i.status==='done'?(i.kind==='report'?'✅ sent, code <b>'+esc(i.result?.code||'')+'</b>':'✅ answered'):'⚠️ '+esc(i.result?.error||'failed')}</span>${i.status==='done'&&i.kind==='look'?`<div class="small">${link((i.result.answer||'').slice(0,200))}…</div>`:''}</div></li>`).join(''):'<li class="muted">Nothing queued.</li>'}
$('#packs').onclick=async e=>{const del=e.target.dataset.del,open=e.target.dataset.open;if(open){show('here');pick(open)}
 if(del&&confirm('Delete this offline pack?')){await caches.delete('asai-pack-'+del);await DBX.del('packs',del);renderOffline();if(cur?.id===del)pick(del,{quiet:true})}};
$('#clearsent').onclick=async()=>{for(const i of await DBX.all('outbox'))if(i.status!=='queued')await DBX.del('outbox',i.id);renderOffline()};
// ---- discovery logging (observe only) — queued when offline
$('#ackbox').onchange=e=>$('#ackbtn').disabled=!e.target.checked;$('#ackbtn').onclick=()=>{$('#ack').classList.add('hidden');$('#repform').classList.remove('hidden');locate()};
$('#utype').onchange=e=>$('#detfields').classList.toggle('hidden',e.target.value!=='detectorist');
$('#repform').onsubmit=async e=>{e.preventDefault();if(!pos)return $('#repout').textContent='Waiting for GPS location…';const fd=new FormData(e.target);
 const photos=(await Promise.all([...e.target.photos.files].slice(0,5).map(f=>toData(f)))).filter(Boolean);const id=uid();
 const body={client_id:id,observed_at:new Date().toISOString(),acknowledged:true,lat:pos.latitude,lon:pos.longitude,accuracy:pos.accuracy,user_type:fd.get('user_type'),depth_cm:fd.get('depth_cm'),permission:fd.get('permission'),notes:fd.get('notes'),photos};
 let r=null;if(navigator.onLine){try{r=await api('/api/reports',{method:'POST',body});if(r.offline)r=null}catch{}}
 if(!r){await queue('report',body,id);$('#repout').innerHTML='<p class="notice">⏳ No connection — your report is saved on this phone and will be sent automatically when you are back online. Your report code will appear here and in the Offline tab.</p>';e.target.reset();return}
 $('#repout').innerHTML=r.ok?`<p class="notice">${esc(r.message)}<br>Your report code: <b>${esc(r.code)}</b></p>`:`<p class="danger">${esc(r.error)}</p>`;if(r.ok)e.target.reset()};
$('#delform').onsubmit=async e=>{e.preventDefault();try{const r=await api('/api/reports/'+encodeURIComponent($('#delcode').value.trim()),{method:'DELETE'});$('#delout').textContent=r.ok?'Your report and photos have been deleted.':r.error}catch{$('#delout').textContent='Deleting needs a connection.'}};
init();
