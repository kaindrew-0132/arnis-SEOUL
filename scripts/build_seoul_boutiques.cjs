#!/usr/bin/env node
// Generates standalone *unplaced* WorldEdit Sponge v2 facade previews.
// North-facing at local z=0. Never edits a world or guesses a map position.
const fs=require("node:fs"), path=require("node:path"), zlib=require("node:zlib"), crypto=require("node:crypto");
function build(p){
 const {width:w,height:h,style,base,glass,frame}=p;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<9||w>60||h<8||h>50)throw Error("bad preview dimensions");
 const depth=4,c=Math.floor(w/2),m=new Map(),set=(x,y,z,b)=>{if(x<0||x>=w||y<0||y>=h||z<0||z>=depth)throw Error("out of preview");m.set(`${x},${y},${z}`,b)};
 const styles=["sails","stone","openwork","garden","two_glass","ceramic","plaid","brass","illuminated_arch","double_skin","lattice_eaves"];
 if(!styles.includes(style))throw Error("unknown style");
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const border=x===0||x===w-1||y===0||y===h-1;
  const door=y>=1&&y<=3&&Math.abs(x-c)<=1;
  const show=y>=1&&y<=4&&x>=2&&x<=w-3&&!door;
  if(door)continue;
  let b=base;
  if(show)b=glass;
  else if(border)b=base;
  else if(y>=6){
   if(style==="sails") b=glass;
   if(style==="stone") b=(Math.abs(x-c)<=2&&y%5!==0)?glass:base;
   if(style==="openwork") b=(x%4===0||y%4===0)?frame:glass;
   if(style==="garden") b=(x%5===0||y%5===0)?frame:glass;
   if(style==="two_glass") b=x<c?"light_gray_stained_glass":"gray_stained_glass";
   if(style==="plaid") b=(x%5===0||y%5===0)?frame:glass;
   if(style==="brass") b=((x+y)%6===0||(x-y+60)%6===0)?frame:glass;
   if(style==="illuminated_arch") b=(x%7===0||y===6)?base:glass;
   if(style==="double_skin") b=(x%5===0||((x*3+y*2)%17===0))?"white_concrete":glass;
   if(style==="lattice_eaves") b=(x%4===0||y%5===0)?frame:glass;
  }
  set(x,y,2,b);
  if(y>=6&&!border){
   if(style==="sails"){
    // Deliberately approximate stepped curved glass fins, in front of glazing.
    const phase=(x-1)%6; if(phase===0||phase===1){const z=y%6<3?0:1;set(x,y,z,"glass");if(phase===0)set(x,y,1,frame);}
   }
   if(style==="garden"&&x%5===1&&y%3!==0)set(x,y,1,"azalea_leaves[persistent=true]");
   if(style==="openwork"&&(x%4===0||y%4===0))set(x,y,1,frame);
   if(style==="illuminated_arch"){
    // Approximate 16m rise (11 vertical rows plus 5 stepped arch rows).
    const u=(x-1)%7, r=y-6;
    const arch=(r>=0&&r<=11&&(u===0||u===6))||
      (r>=12&&r<=16&&((u===1||u===5)&&r<=13||(u===2||u===4)&&r>=14&&r<=15||u===3&&r===16));
    if(arch)set(x,y,1,"sea_lantern");
   }
   if(style==="double_skin")set(x,y,0,(x%7===1||y%7===0)?frame:"glass");
   if(style==="lattice_eaves"&&(y===h-2||y===h-3&&x%3===0))set(x,y,0,frame);
  }
  // lamps behind actual transparent cells; never in the entrance path.
  if((show||b.includes("glass"))&&x%4===2&&y%4===2)set(x,y,3,"light[level=15]");
 }
 const cells=[...m].map(([k,block])=>({xyz:k.split(",").map(Number),block:"minecraft:"+block})).sort((a,b)=>a.xyz[1]-b.xyz[1]||a.xyz[2]-b.xyz[2]||a.xyz[0]-b.xyz[0]);
 return {width:w,height:h,length:depth,cells};
}
function test(profiles,inv){
 const known=new Set(inv.sites.map(s=>s.id));let n=0;
 if(new Set(profiles.map(p=>p.id)).size!==profiles.length)throw Error("duplicate profile");
 for(const p of profiles){
  if(!known.has(p.id))throw Error("unregistered site");
  const a=build(p),b=build(p),c=Math.floor(a.width/2);
  if(JSON.stringify(a)!==JSON.stringify(b))throw Error("nondeterministic");
  if(!a.cells.some(q=>q.block.includes("glass"))||!a.cells.some(q=>q.block.includes("light[")))throw Error("missing window or light "+p.id);
  if(a.cells.some(q=>q.xyz[0]>=c-1&&q.xyz[0]<=c+1&&q.xyz[1]>=1&&q.xyz[1]<=3))throw Error("entrance obstructed "+p.id);
  if(p.style==="illuminated_arch"&&!a.cells.some(q=>q.block==="minecraft:sea_lantern"))throw Error("arch is not emissive");
  if(p.style==="double_skin"&&!a.cells.some(q=>q.xyz[2]===0&&q.block==="minecraft:gold_block"))throw Error("missing outer skin");
  if(a.cells.length>a.width*a.height*a.length||new Set(a.cells.map(q=>q.xyz.join(","))).size!==a.cells.length)throw Error("duplicates");
  n+=a.cells.length;
 }
 return {profiles:profiles.length,blocks:n};
}
const root=path.resolve(__dirname,"..");
const profiles=JSON.parse(fs.readFileSync(path.join(root,"assets/seoul/boutique_facades.json"),"utf8")).profiles;
const inv=JSON.parse(fs.readFileSync(path.join(root,"assets/seoul/boutique_inventory.json"),"utf8"));
function short(n){const b=Buffer.alloc(2);b.writeInt16BE(n);return b}
function int(n){const b=Buffer.alloc(4);b.writeInt32BE(n);return b}
function str(s){const b=Buffer.from(s,"utf8");return Buffer.concat([short(b.length),b])}
function tag(t,k,v){return Buffer.concat([Buffer.from([t]),str(k),v])}
function comp(tags){return Buffer.concat([...tags,Buffer.from([0])])}
function schem(model){
 const pal=["minecraft:air",...new Set(model.cells.map(q=>q.block))];
 if(pal.length>127)throw Error("palette too large");
 const data=Buffer.alloc(model.width*model.height*model.length);
 const index=new Map(pal.map((b,i)=>[b,i]));
 for(const {xyz:[x,y,z],block} of model.cells)data[x+model.width*(z+model.length*y)]=index.get(block);
 const tags=[tag(3,"Version",int(2)),tag(3,"DataVersion",int(3955)),
  tag(2,"Width",short(model.width)),tag(2,"Height",short(model.height)),tag(2,"Length",short(model.length)),
  tag(11,"Offset",Buffer.concat([int(3),int(0),int(0),int(0)])),
  tag(3,"PaletteMax",int(pal.length)),tag(10,"Palette",comp(pal.map((b,i)=>tag(3,b,int(i))))),
  tag(7,"BlockData",Buffer.concat([int(data.length),data])),
  tag(9,"BlockEntities",Buffer.concat([Buffer.from([10]),int(0)]))];
 const raw=tag(10,"Schematic",comp(tags));return zlib.gzipSync(raw,{level:9});
}
// Decode emitted NBT independently, verify every palette cell and dimension.
function verify(bytes,m){
 const b=zlib.gunzipSync(bytes);let off=0;const byte=()=>b[off++],i16=()=>{let n=b.readInt16BE(off);off+=2;return n},i32=()=>{let n=b.readInt32BE(off);off+=4;return n},string=()=>{let n=i16(),s=b.toString("utf8",off,off+n);off+=n;return s};
 function val(t){if(t===2)return i16();if(t===3)return i32();if(t===7){let n=i32(),a=b.subarray(off,off+n);off+=n;return a}if(t===11){let n=i32();return Array.from({length:n},i32)}if(t===9){let k=byte(),n=i32();return Array.from({length:n},()=>val(k))}if(t===10){let o={};for(let k=byte();k;k=byte()){let name=string();o[name]=val(k)}return o}throw Error("unsupported NBT "+t)}
 if(byte()!==10||string()!=="Schematic")throw Error("bad root");
 const n=val(10);if(off!==b.length||n.Version!==2||n.Width!==m.width||n.Height!==m.height||n.Length!==m.length||n.PaletteMax!==Object.keys(n.Palette).length||n.BlockData.length!==m.width*m.height*m.length)throw Error("bad schematic");
 const expected=new Map(m.cells.map(q=>[q.xyz.join(","),q.block]));
 const pal=Object.fromEntries(Object.entries(n.Palette).map(([k,v])=>[v,k]));
 for(let y=0;y<m.height;y++)for(let z=0;z<m.length;z++)for(let x=0;x<m.width;x++){let actual=pal[n.BlockData[x+m.width*(z+m.length*y)]],want=expected.get([x,y,z].join(","))||"minecraft:air";if(actual!==want)throw Error("voxel mismatch")}
}
const report=test(profiles,inv);
const out=process.argv[2]==="--self-test"?null:process.argv[2];
if(out)fs.mkdirSync(out,{recursive:true});
const manifest=[];
for(const p of profiles){const m=build(p),bytes=schem(m);verify(bytes,m);if(out)fs.writeFileSync(path.join(out,p.id+".schem"),bytes);manifest.push({site:p.id,status:"unplaced_preview",dimensions:[m.width,m.height,m.length],blocks:m.cells.length,sha256:crypto.createHash("sha256").update(bytes).digest("hex")})}
if(out)fs.writeFileSync(path.join(out,"manifest.json"),JSON.stringify({warning:"Approximate local preview only. No approved OSM identity or world placement.",models:manifest},null,2));
console.log(JSON.stringify({...report,nbt:"PASS",manifest},null,2));
