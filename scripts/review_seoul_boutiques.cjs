#!/usr/bin/env node
// Offline review tool. It never registers a building or changes world geometry.
// Supply OSM JSON already cropped to the approved district; no network access.
const fs=require("node:fs");
const path=require("node:path");
function normalize(s){return String(s??"").normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu,"");}
function scan(inventory,osm){
  if(!Array.isArray(osm.elements))throw Error("Expected Overpass JSON elements array");
  const results=[];
  for(const e of osm.elements){
    if(!["node","way","relation"].includes(e.type)||!Number.isSafeInteger(e.id)||e.id<=0)continue;
    const t=e.tags??{};
    const names=[t.brand,t.name,t["name:en"],t["name:ko"],t.operator].map(normalize).filter(Boolean);
    const brands=inventory.research_brands.filter(b=>b.aliases.some(a=>names.includes(normalize(a)))).map(b=>b.name);
    const sites=inventory.sites.filter(s=>String(t["addr:housenumber"]??"").trim()===s.number&&[s.street,s.street_en].map(normalize).includes(normalize(t["addr:street"])));
    if(!brands.length&&!sites.length)continue;
    const building=["way","relation"].includes(e.type)&&!!t.building&&t.building!=="no"&&!t["building:part"];
    const geometry=Array.isArray(e.geometry)&&e.geometry.length>=4&&e.geometry.every(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
    results.push({type:e.type,id:e.id,brands,site_candidates:sites.map(s=>s.id),classification:building?"building_review":e.type==="node"?"poi_review":"other_review",geometry_supplied:geometry,review_only:true,approved:false,tags:t});
  }
  return results.sort((a,b)=>a.type.localeCompare(b.type)||a.id-b.id);
}
function test(inv,fixture){const r=scan(inv,fixture);const by=id=>r.find(x=>x.id===id);if(r.length!==4||by(1).classification!=="building_review"||by(1).site_candidates[0]!=="lv-maison-454"||by(2).classification!=="poi_review"||by(3)||by(4).classification!=="other_review"||by(4).site_candidates[0]!=="dior-467"||by(5)||by(6).site_candidates[0]!=="dior-464"||r.some(x=>x.approved||!x.review_only))throw Error("fixture assertion failed");let rejected=false;try{scan(inv,{})}catch{rejected=true}if(!rejected)throw Error("invalid input accepted");return "PASS";}
const inventory=JSON.parse(fs.readFileSync(path.join(__dirname,"../assets/seoul/boutique_inventory.json"),"utf8"));
if(process.argv[2]==="--self-test"){
 console.log(test(inventory,{"elements":[{"type":"way","id":1,"tags":{"building":"retail","name":"루이비통","addr:street":"압구정로","addr:housenumber":"454"}},{"type":"node","id":2,"tags":{"brand":"CHANEL","addr:street":"Apgujeong-ro","addr:housenumber":"431"}},{"type":"way","id":3,"tags":{"name":"Chanel parking","building":"yes"}},{"type":"way","id":4,"tags":{"brand":"Dior","building":"yes","building:part":"yes","addr:street":"Apgujeong-ro","addr:housenumber":"467"}},{"type":"way","id":5,"tags":{"building":"yes","addr:street":"Other street","addr:housenumber":"454"}},{"type":"relation","id":6,"tags":{"building":"retail","addr:street":"Apgujeong-ro","addr:housenumber":"464"}}]}));
}else if(process.argv.length===3){
 const osm=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
 console.log(JSON.stringify({review_only:true,candidates:scan(inventory,osm)},null,2));
}else{
 console.error("Usage: node scripts/review_seoul_boutiques.cjs <district-overpass.json> | --self-test");process.exitCode=2;
}
