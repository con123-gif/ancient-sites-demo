// Ancient Sites AI — AGPL-3.0-or-later. Tiny IndexedDB helper + outbox shared by page and service worker.
const DB_NAME='asai',DB_VER=1;
function idb(){return new Promise((res,rej)=>{const o=indexedDB.open(DB_NAME,DB_VER);o.onupgradeneeded=()=>{const d=o.result;
 if(!d.objectStoreNames.contains('packs'))d.createObjectStore('packs',{keyPath:'id'});
 if(!d.objectStoreNames.contains('outbox'))d.createObjectStore('outbox',{keyPath:'id'});};o.onsuccess=()=>res(o.result);o.onerror=()=>rej(o.error)})}
async function tx(store,mode,fn){const d=await idb();return new Promise((res,rej)=>{const t=d.transaction(store,mode),s=t.objectStore(store);const r=fn(s);t.oncomplete=()=>res(r&&'result'in r?r.result:undefined);t.onerror=()=>rej(t.error)})}
const DBX={all:s=>tx(s,'readonly',x=>x.getAll()),get:(s,k)=>tx(s,'readonly',x=>x.get(k)),put:(s,v)=>tx(s,'readwrite',x=>x.put(v)),del:(s,k)=>tx(s,'readwrite',x=>x.delete(k))};
// Outbox items: {id, kind:'look'|'report', body, status:'queued'|'sending'|'done'|'failed', created, result, error}
const ENDPOINT={look:'/api/look',report:'/api/reports'};
let flushing=null;
function flushOutbox(){if(flushing)return flushing;flushing=(async()=>{const sent=[];
 for(const it of (await DBX.all('outbox')).filter(i=>i.status==='queued'||i.status==='sending')){
  try{const r=await fetch(ENDPOINT[it.kind],{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(it.body)});const j=await r.json();
   if(r.status>=500&&!j.answer)throw Error('server '+r.status);
   it.status=r.ok||j.answer?'done':'failed';it.result=j;it.done=new Date().toISOString();delete it.body.image;delete it.body.photos;await DBX.put('outbox',it);sent.push(it)}
  catch(e){break}} // still offline: stop and retry later
 return sent})().finally(()=>flushing=null);return flushing}
