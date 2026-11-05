// Static demo shim: maps the app's /api calls to pre-generated JSON (no server). AGPL-3.0-or-later
(function(){const of=window.fetch.bind(window),J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json'}});
let SITES=null;const sites=async()=>SITES||(SITES=await (await of('api/sites.json')).json());
let ALL=null;const all=async()=>ALL||(ALL=await (await of('api/all.json')).json());const site=async id=>{const s=(await all())[id];return s?{...s}:null};
const d=(a,b,c,e)=>{const R=6371000,r=x=>x*Math.PI/180,dl=r(c-a),dn=r(e-b);const h=Math.sin(dl/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
const near=async(lat,lon,n=5)=>(await sites()).map(s=>({...s,distance_m:Math.round(d(lat,lon,s.lat,s.lon))})).sort((a,b)=>a.distance_m-b.distance_m).slice(0,n);
const NOTE='Static demo: answers come from stored site facts only (no AI, no server).';
window.fetch=async(u,o={})=>{const url=new URL(typeof u==='string'?u:u.url,location.href);const p=url.pathname,m=(o.method||'GET').toUpperCase();let x;
 if(!p.includes('/api/'))return of(u,o);const a=p.slice(p.indexOf('/api/'));
 if(a==='/api/status')return of('api/status.json');
 if(a==='/api/sites')return of('api/sites.json');
 if(a==='/api/public/reports')return J([]);
 if(x=a.match(/^\/api\/sites\/([^/]+)\/pack$/)){const s=await site(decodeURIComponent(x[1]));if(!s)return J({error:'not found'},404);const nb=(await near(s.lat,s.lon,10)).filter(n=>n.id!==s.id&&n.distance_m<25000).slice(0,8);const full=await Promise.all(nb.map(async n=>({...(await site(n.id)),distance_m:n.distance_m})));return J({version:1,site:s,nearby:full,images:[...(s.images||[]),...(s.image?[s.image]:[])],tiles:{zooms:[13,14,15,16],radius_m:Math.min(s.radius_m||600,800),max:120}})}
 if(x=a.match(/^\/api\/sites\/([^/]+)$/)){const s=await site(decodeURIComponent(x[1]));return s?J(s):J({error:'not found'},404)}
 if(a==='/api/near'){const l=await near(+url.searchParams.get('lat'),+url.searchParams.get('lon'),10);const full=await Promise.all(l.map(async s=>({...(await site(s.id)),distance_m:s.distance_m})));return J({at:full.find(s=>s.distance_m<=(s.radius_m||0))||null,nearby:full})}
 if(m==='POST'&&(a==='/api/look'||a==='/api/ask')){const b=JSON.parse(o.body||'{}');let s;
  if(b.site_id)s=await site(b.site_id);let nb=[];
  if(!s&&isFinite(b.lat)){nb=await near(+b.lat,+b.lon,5);s=await site(nb[0].id);s.distance_m=nb[0].distance_m}
  if(!s)return J({error:'Location needed in the static demo.'},400);
  const ans=`${s.name}:\n• ${(s.facts||[]).slice(0,3).join('\n• ')}\n\nSources: ${(s.sources||[]).join(' , ')}`;
  return J({site:{id:s.id,name:s.name,distance_m:s.distance_m??null},nearby:nb.slice(1).map(n=>({id:n.id,name:n.name,distance_m:n.distance_m})),question:b.question||b.q||'',mode:'offline',answer:ans,reply:ans,note:NOTE})}
 if(a==='/api/inscription')return J({error:'needs AI key',message:'Reading inscriptions is not available in the static demo.'},503);
 if(a.startsWith('/api/reports'))return J({error:'Logging and deleting find reports is disabled in this public demo (needs the private server).'},503);
 return J({error:'Not available in static demo'},404)};
})();
