#!/usr/bin/env node
// Offline candidate association only; no automatic building replacements.
const fs=require("node:fs"),path=require("node:path");
function norm(s){return String(s??"").normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu,"")}
function valid(p){return !!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180}
function same(a,b){return a.lat===b.lat&&a.lon===b.lon}
function outline(e){
 if(e.type!=="way"||!e.tags?.building||e.tags.building==="no"||e.tags["building:part"])return null;
 const g=e.geometry;if(!Array.isArray(g)||g.length<4||!g.every(valid)||!same(g[0],g[g.length-1]))return null;
 const p=g.slice(0,-1);if(new Set(p.map(x=>`${x.lat},${x.lon}`)).size!==p.length)return null;
 const x0=p[0].lon,y0=p[0].lat;let area=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];area+=(a.lon-x0)*(b.lat-y0)-(b.lon-x0)*(a.lat-y0)}
 if(Math.abs(area)<1e-15)return null;
 return {p,minx:Math.min(...p.map(x=>x.lon)),maxx:Math.max(...p.map(x=>x.lon)),miny:Math.min(...p.map(x=>x.lat)),maxy:Math.max(...p.map(x=>x.lat))};
}
function contains(o,q){
 if(q.lon<o.minx||q.lon>o.maxx||q.lat<o.miny||q.lat>o.maxy)return "outside";
 let inside=false;
 for(let i=0,j=o.p.length-1;i<o.p.length;j=i++){
 const a=o.p[j],b=o.p[i]; const dx=b.lon-a.lon,dy=b.lat-a.lat;
 const cross=(q.lon-a.lon)*dy-(q.lat-a.lat)*dx;
 if(Math.abs(cross)<=1e-10*Math.hypot(dx,dy)&&q.lon>=Math.min(a.lon,b.lon)-1e-10&&q.lon<=Math.max(a.lon,b.lon)+1e-10&&q.lat>=Math.min(a.lat,b.lat)-1e-10&&q.lat<=Math.max(a.lat,b.lat)+1e-10)return "boundary";
 if((a.lat>q.lat)!==(b.lat>q.lat)&&q.lon<(b.lon-a.lon)*(q.lat-a.lat)/(b.lat-a.lat)+a.lon)inside=!inside;
 }
 return inside?"inside":"outside";
}
function addressSites(inv,t){return inv.sites.filter(s=>String(t["addr:housenumber"]??"").trim()===s.number&&[s.street,s.street_en].map(norm).includes(norm(t["addr:street"]))).map(s=>s.id)}
function review(inv,osm){
 if(!Array.isArray(osm.elements))throw Error("Expected Overpass JSON");
 const unique=new Map();
 for(const e of osm.elements)if(["node","way","relation"].includes(e.type)&&Number.isSafeInteger(e.id)&&e.id>0){const key=`${e.type}/${e.id}`;if(unique.has(key))throw Error(`Duplicate OSM element ${key}`);unique.set(key,e)}
 const els=[...unique.values()], buildings=els.map(e=>({e,o:outline(e)})).filter(x=>x.o);
 const unresolved=els.filter(e=>["way","relation"].includes(e.type)&&e.tags?.building&&e.tags.building!=="no"&&!e.tags["building:part"]&&!outline(e)).map(e=>`${e.type}/${e.id}`);
 const records=[];
 for(const e of els){
 if(e.type!=="node"||!valid(e))continue;const t=e.tags??{};const names=[t.brand,t.name,t["name:en"],t["name:ko"],t.operator].map(norm).filter(Boolean);
 const brands=inv.research_brands.filter(b=>b.aliases.some(a=>names.includes(norm(a)))).map(b=>b.name);
 if(!brands.length)continue;
 const siteIds=addressSites(inv,t).filter(id=>brands.includes(inv.sites.find(s=>s.id===id).brand));
 const hits=buildings.map(({e:b,o})=>({building:`way/${b.id}`,position:contains(o,e),address_sites:addressSites(inv,b.tags??{}),building_type:b.tags.building})).filter(h=>h.position!=="outside");
 const candidate=hits.length===1&&hits[0].position==="inside"?"single_containing_way":hits.length?"ambiguous_or_boundary":"no_supported_containing_way";
 records.push({poi:`node/${e.id}`,brands,site_ids:siteIds,candidates:hits.sort((a,b)=>a.building.localeCompare(b.building)),classification:candidate,review_only:true,approved:false,whole_building_replacement:false});
 }
 return {review_only:true,unsupported_building_geometries:unresolved.sort(),records:records.sort((a,b)=>a.poi.localeCompare(b.poi))};
}
function selftest(inv){
 const ring=(a,b,c,d)=>[{lat:a,lon:b},{lat:a,lon:d},{lat:c,lon:d},{lat:c,lon:b},{lat:a,lon:b}];
 const way=(id,geometry,tags={building:"retail"})=>({type:"way",id,geometry,tags});
 const poi=(id,lat,lon,brand)=>({type:"node",id,lat,lon,tags:{brand}});
 const osm={elements:[way(1,ring(37,127,37.001,127.001)),way(2,ring(37.0005,127.0005,37.002,127.002)),way(3,ring(37,127,37.001,127.001),{building:"yes","building:part":"yes"}),{type:"relation",id:4,tags:{building:"retail"}},way(5,ring(37.003,127,37.004,127.001).slice(0,-1)),poi(10,37.0001,127.0001,"Cartier"),poi(11,37.0007,127.0007,"Hermes"),poi(12,37,127.0003,"Dior"),poi(13,37.004,127,"Chanel"),poi(14,37.0001,127.0001,"Chanel parking")]};
 const r=review(inv,osm), by=id=>r.records.find(x=>x.poi===`node/${id}`);
 if(r.records.length!==4||by(10).classification!=="single_containing_way"||by(11).classification!=="ambiguous_or_boundary"||by(12).classification!=="ambiguous_or_boundary"||by(13).classification!=="no_supported_containing_way"||r.records.some(x=>x.approved||x.whole_building_replacement)||r.unsupported_building_geometries.join(",")!=="relation/4,way/5")throw Error("spatial fixture failure");
 let rejected=false;try{review(inv,{elements:[osm.elements[0],osm.elements[0]]})}catch{rejected=true}if(!rejected)throw Error("duplicate ID accepted");
 if(inventory.sites.length!==new Set(inventory.sites.map(x=>x.id)).size)throw Error("duplicate site ID");
 return "PASS (containment, overlap, boundary, building parts, unsupported geometry, exact brand, duplicate IDs)";
}
const inventory=JSON.parse(fs.readFileSync(path.join(__dirname,"../assets/seoul/boutique_inventory.json"),"utf8"));
if(process.argv[2]==="--self-test")console.log(selftest(inventory));
else if(process.argv.length===3)console.log(JSON.stringify(review(inventory,JSON.parse(fs.readFileSync(process.argv[2],"utf8"))),null,2));
else {console.error("Usage: node scripts/associate_seoul_boutiques.cjs <district-overpass.json> | --self-test");process.exitCode=2;}
