//! Approximate 1:1 N Seoul Tower. Public height 135.7m body + 101m aerial;
//! radial dimensions and deck elevations are artistic approximations.
use super::schematic::PalettizedSchematic;
use crate::block_definitions::*;
const SIDE:i32=31;
const C:i32=15;
fn ring(x:i32,z:i32,r:i32)->bool{
    let inside=|a:i32,b:i32|a*a+b*b<=r*r;
    inside(x,z)&&[(1,0),(-1,0),(0,1),(0,-1)].iter().any(|&(a,b)|!inside(x+a,z+b))
}
fn radius(y:i32)->i32{match y{0..=5=>6,6..=23=>5,24..=103=>4,104..=110=>5+(y-104),111..=115=>12,116..=128=>13,129..=132=>12,133..=135=>9,136..=154=>3,155..=189=>2,190..=219=>1,_=>0}}
fn slot(x:i32,y:i32,z:i32)->Option<u8>{
    let r=radius(y);let d=x*x+z*z;if d>r*r{return None;}
    if y>=136{return (r==0||ring(x,z,r)||x==0&&z==0).then_some(if ((y-136)/10)%2==0{0}else{3});}
    if y==0{return Some(1);}
    let deck=[5,104,111,115,120,124,128,132,135].contains(&y);
    if deck||y==135||d>radius(y+1).pow(2){return Some(if ring(x,z,r){0}else{4});}
    if ring(x,z,r){return Some(if (116..=128).contains(&y){2}else{0});}
    if (110..=134).contains(&y)&&[111,115,120,124,128,132,135].contains(&(y+1))&&x.rem_euclid(5)==0&&z.rem_euclid(5)==0{return Some(5);}
    None
}
pub fn build()->PalettizedSchematic{
    let palette=[WHITE_CONCRETE,LIGHT_GRAY_CONCRETE,LIGHT_BLUE_STAINED_GLASS,RED_CONCRETE,SMOOTH_STONE,LIGHT].into_iter().map(|block|BlockWithProperties{block,properties:None}).collect();
    let mut voxels=Vec::new();
    for y in 0..237{for x in -C..=C{for z in -C..=C{if let Some(p)=slot(x,y,z){voxels.push(((x+C) as i16,y as i16,(z+C) as i16,p));}}}}
    PalettizedSchematic{width:SIDE,length:SIDE,palette,voxels}
}
#[cfg(test)]mod tests{use super::*;#[test]fn height_deck_and_empty_shaft(){
    let m=build();assert_eq!(m.voxels.iter().map(|v|v.1).max(),Some(236));
    assert_eq!(slot(0,50,0),None);assert_eq!(slot(4,50,0),Some(0));assert_eq!(slot(13,117,0),Some(2));assert_eq!(slot(0,117,0),None);assert_eq!(slot(0,236,0),Some(0));assert!(m.voxels.len()<25_000);
}}
