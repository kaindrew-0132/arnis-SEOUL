#!/usr/bin/env node
// Review proposals only. No map writes or automatic approvals.
const fs=require("node:fs"),path=require("node:path");
function normalize(s){return String(s??"").normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}\s]/gu,"")}
function plan(inv,fac,osm){
 if(!Array.isArray(osm.elements)||osm.remark)throw Error("Incomplete Overpass data");
 const ways=new Map(),nodes=[];
 for(const e of osm.elements){
  if(e.type==="way"){if(ways.has(e.id))throw Error("duplicate way");ways.set(e.id,e)}
  else if(e.type==="node")nodes.push(e);
 }
 const valid=p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
 const same=(a,b)=>a.lat===b.lat&&a.lon===b.lon;
 const projection=(p,c)=>[(p.lon-c.lon)*111320*Math.cos(c.lat*Math.PI/180),-(p.lat-c.lat)*111132];
 const geom=e=>Array.isArray(e.geometry)&&e.geometry.length>=4&&e.geometry.every(valid)&&same(e.geometry[0],e.geometry.at(-1));
 const building=e=>e.tags?.building&&e.tags.building!=="no"&&!e.tags["building:part"]&&geom(e);
 const names=e=>[e.tags?.name,e.tags?.["name:ko"],e.tags?.["name:en"],e.tags?.brand,e.tags?.operator].map(normalize).filter(Boolean);
 const addr=(site,e)=>String(e.tags?.["addr:housenumber"]??"").trim()===site.number&&[site.street,site.street_en].map(normalize).includes(normalize(e.tags?.["addr:street"]));
 function segments(e,c){const g=e.geometry.map(p=>projection(p,c));return g.slice(0,-1).map((a,i)=>[a,g[i+1]]);}
 const dist=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],d=dx*dx+dz*dz;if(d===0)return Math.hypot(p[0]-a[0],p[1]-a[1]);const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/d));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz)};
 const roads=[...ways.values()].filter(e=>e.tags?.highway&&Array.isArray(e.geometry)&&e.geometry.length>=2&&e.geometry.every(valid)&&!["footway","path","steps","cycleway","service","pedestrian"].includes(e.tags.highway));
 const records=[];
 for(const site of inv.sites){
  const brand=inv.research_brands.find(b=>b.name===site.brand);
  const aliases=(brand?.aliases??[]).map(normalize);
  const match=e=>names(e).some(n=>aliases.includes(n));
  const hinted=new Set((site.osm_candidates??[]).filter(c=>c.type==="way").map(c=>c.id));
  const model=fac.profiles.find(p=>p.id===site.id);
  const candidates=[];
  for(const e of ways.values()){
   if(!building(e))continue;
   const evidence=[...(hinted.has(e.id)?["third_party_id"]:[]),...(match(e)?["exact_brand"]:[]),...(addr(site,e)?["exact_address"]:[])];
   if(!evidence.length)continue;
   const ring=e.geometry.slice(0,-1),c={lat:ring.reduce((a,p)=>a+p.lat,0)/ring.length,lon:ring.reduce((a,p)=>a+p.lon,0)/ring.length};
   const poly=ring.map(p=>projection(p,c));
   let signedArea=0;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length];signedArea+=p[0]*q[1]-q[0]*p[1]}
   if(Math.abs(signedArea)<2)continue;
   const streetNames=[site.street,site.street_en].map(normalize);
   const streetRoads=roads.filter(r=>[r.tags.name,r.tags["name:ko"],r.tags["name:en"]].map(normalize).some(n=>streetNames.includes(n)));
   const roadSegments=streetRoads.flatMap(r=>segments(r,c).map(([a,b])=>({a,b,id:r.id})));
   const edges=[];
   for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<5)continue;
    const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    const near=roadSegments.map(r=>({id:r.id,d:dist(mid,r.a,r.b)})).sort((x,y)=>x.d-y.d)[0];
    if(!near||near.d>50)continue;
    const sign=signedArea>0?1:-1;
    const nx=sign*dz/length,nz=-sign*dx/length;
    edges.push({index:i,start:ring[i],end:ring[(i+1)%ring.length],length_m:+length.toFixed(2),outward_bearing_deg:+((Math.atan2(nx,-nz)*180/Math.PI+360)%360).toFixed(1),road_way:near.id,road_distance_m:+near.d.toFixed(2),preview_fits:model?length>=model.width+2:null});
   }
   edges.sort((a,b)=>a.road_distance_m-b.road_distance_m||b.length_m-a.length_m||a.index-b.index);
   // Coordinates remain proposals only. Nearest edge is not proof of an entrance.
   candidates.push({way:e.id,evidence,center:c,footprint_area_m2:+(Math.abs(signedArea)/2).toFixed(1),mapped_height:e.tags.height??null,mapped_levels:e.tags["building:levels"]??null,edge_candidates:edges.slice(0,5),approved:false});
  }
  records.push({site:site.id,model:model?.id??null,status:site.status,brand_poi_candidates:nodes.filter(n=>valid(n)&&match(n)).map(n=>({id:n.id,exact_address:addr(site,n)})),candidates,approved:false,placement:null});
 }
 return {license:"© OpenStreetMap contributors, ODbL 1.0",osm_timestamp:osm.osm3s?.timestamp_osm_base??null,review_only:true,records};
}
function test(plan){
 const inv={research_brands:[{name:"Test",aliases:["Test"]}],sites:[{id:"test",brand:"Test",street:"길",street_en:"Road",number:"1",status:"address_verified",osm_candidates:[{type:"way",id:11}]}]};
 const fac={profiles:[{id:"test",width:9}]};
 const p=(lat,lon)=>({lat,lon});
 const ring=[p(37,127),p(37,127.0002),p(37.0002,127.0002),p(37.0002,127),p(37,127)];
 const osm={elements:[{type:"way",id:11,tags:{building:"yes",name:"Test","addr:street":"길","addr:housenumber":"1"},geometry:ring},{type:"way",id:12,tags:{highway:"primary",name:"길"},geometry:[p(36.99995,126.9999),p(36.99995,127.0003)]},{type:"way",id:13,tags:{building:"yes","building:part":"yes",name:"Test"},geometry:ring},{type:"node",id:14,tags:{brand:"Test"},lat:37.0001,lon:127.0001}]};
 const r=plan(inv,fac,osm).records[0],c=r.candidates[0];
 if(r.approved||r.placement!==null||r.candidates.length!==1||c.way!==11||c.evidence.length!==3||!c.edge_candidates[0].preview_fits||Math.abs(c.edge_candidates[0].outward_bearing_deg-180)>1||r.brand_poi_candidates.length!==1)throw Error("fixture failure");
 let rejected=false;try{plan(inv,fac,{elements:[],remark:"timeout"})}catch{rejected=true}if(!rejected)throw Error("partial result accepted");
 return "PASS";
}
if(process.argv[2]==="--self-test"){console.log(test(plan));}
else if(process.argv.length===3){
 const root=path.resolve(__dirname,"..");
 const inv=JSON.parse(fs.readFileSync(path.join(root,"assets/seoul/boutique_inventory.json"),"utf8"));
 const fac=JSON.parse(fs.readFileSync(path.join(root,"assets/seoul/boutique_facades.json"),"utf8"));
 console.log(JSON.stringify(plan(inv,fac,JSON.parse(fs.readFileSync(process.argv[2],"utf8"))),null,2));
}else {console.error("Usage: node scripts/plan_seoul_boutique_placement.cjs <overpass.json> | --self-test");process.exitCode=2;}
