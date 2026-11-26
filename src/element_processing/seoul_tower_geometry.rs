//! Experimental high-rise geometry within the mapped footprint.
use std::collections::{HashMap,HashSet};
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub(super) enum Cell { Air, Floor, Frame, Glass, Lamp }
#[derive(Clone,Copy)]
enum Style { Lotte{cx:f64,cz:f64,crown:i32}, Ifc }
pub(super) struct Plan { tops:HashMap<(i32,i32),i32>, style:Style, floors:Vec<i32> }
fn levels(top:i32,count:i32)->Option<Vec<i32>>{
    if count<=0 || top<3*count{return None;}
    Some((0..count).map(|i| ((i64::from(i)*i64::from(top))/i64::from(count)) as i32).collect())
}
fn bounds(c:&[(i32,i32)])->Option<(i32,i32,i32,i32)>{
    Some((c.iter().map(|p|p.0).min()?,c.iter().map(|p|p.0).max()?,
        c.iter().map(|p|p.1).min()?,c.iter().map(|p|p.1).max()?))
}
fn taper(y:i32,h:i32)->f64{let k=((f64::from(y)/f64::from(h)-0.12)/0.88).clamp(0.0,1.0);1.0-0.68*k.powf(1.45)}
impl Plan{
    pub(super) fn lotte(c:&[(i32,i32)],h:i32)->Option<Self>{
        if !(540..=570).contains(&h)||!(3600..=6000).contains(&c.len()){return None;}
        let (x0,x1,z0,z1)=bounds(c)?;
        let (w,d)=(i64::from(x1)-i64::from(x0)+1,i64::from(z1)-i64::from(z0)+1);
        if !(60..=105).contains(&w)||!(60..=105).contains(&d)||(w-d).abs()>16{return None;}
        let footprint:HashSet<_>=c.iter().copied().collect();
        if footprint.len()!=c.len(){return None;}
        let cx=(f64::from(x0)+f64::from(x1))*0.5;
        let cz=(f64::from(z0)+f64::from(z1))*0.5;
        if !footprint.contains(&(cx.round() as i32,cz.round() as i32)){return None;}
        let paired=c.iter().filter(|&&(x,z)|footprint.contains(&((2.0*cx-f64::from(x)).round() as i32,(2.0*cz-f64::from(z)).round() as i32))).count();
        if paired*100<c.len()*90{return None;}
        let crown=h-50;
        let floors=levels(crown,123)?;
        let scales:Vec<_>=(0..=h).map(|y|taper(y,h)).collect();
        let mut tops=HashMap::with_capacity(c.len());
        for &(x,z) in c{
            let mut top=0;
            for y in 1..=h{
                let f=scales[y as usize];
                let p=((cx+(f64::from(x)-cx)/f).round() as i32,(cz+(f64::from(z)-cz)/f).round() as i32);
                if !footprint.contains(&p){break;}top=y;
            }
            tops.insert((x,z),top);
        }
        let plan=Self{tops,style:Style::Lotte{cx,cz,crown},floors};
        for sign in [-1.0,1.0]{
            if !c.iter().any(|&(x,z)|plan.solid(x,h,z)&&sign*((f64::from(x)-cx)-(f64::from(z)-cz))>0.0){return None;}
        }
        Some(plan)
    }
    pub(super) fn ifc(c:&[(i32,i32)],h:i32,tower:u8,rise:i32,bearing:f64)->Option<Self>{
        let (reference,count)=match tower{1=>(185,32),2=>(176,29),3=>(284,56),_=>return None};
        if (h-reference).abs()>15||!(3..=45).contains(&rise)||!bearing.is_finite()||!(500..=5000).contains(&c.len()){return None;}
        let (x0,x1,z0,z1)=bounds(c)?;
        if !(20..=90).contains(&(i64::from(x1)-i64::from(x0)+1))||!(20..=90).contains(&(i64::from(z1)-i64::from(z0)+1)){return None;}
        let (dx,dz)=(bearing.to_radians().sin(),-bearing.to_radians().cos());
        let p=|x:i32,z:i32|(f64::from(x)-f64::from(x0))*dx+(f64::from(z)-f64::from(z0))*dz;
        let low=c.iter().map(|&(x,z)|p(x,z)).fold(f64::INFINITY,f64::min);
        let high=c.iter().map(|&(x,z)|p(x,z)).fold(f64::NEG_INFINITY,f64::max);
        if high-low<10.0{return None;}
        let floors=levels(h-rise,count)?;
        let tops:HashMap<_,_>=c.iter().map(|&(x,z)|((x,z),h-(f64::from(rise)*(p(x,z)-low)/(high-low)).round() as i32)).collect();
        if tops.len()!=c.len(){return None;}
        Some(Self{tops,style:Style::Ifc,floors})
    }
    pub(super) fn top(&self,x:i32,z:i32)->Option<i32>{self.tops.get(&(x,z)).copied()}
    fn solid(&self,x:i32,y:i32,z:i32)->bool{
        if y<0||self.top(x,z).is_none_or(|h|y>h){return false;}
        if let Style::Lotte{cx,cz,crown}=self.style{
            if y>crown&&((f64::from(x)-cx)-(f64::from(z)-cz)).abs()<1.0+f64::from(y-crown)/20.0{return false;}
        }true
    }
    fn edge(&self,x:i32,y:i32,z:i32)->bool{[(1,0),(-1,0),(0,1),(0,-1)].iter().any(|&(dx,dz)|!self.solid(x+dx,y,z+dz))}
    pub(super) fn cell(&self,x:i32,y:i32,z:i32)->Cell{
        if !self.solid(x,y,z){return Cell::Air;}
        let edge=self.edge(x,y,z);
        let cap=!self.solid(x,y+1,z);
        let crown_deck=matches!(self.style,Style::Lotte{crown,..} if crown==y);
        if self.floors.binary_search(&y).is_ok()||crown_deck||cap{return if edge{Cell::Frame}else{Cell::Floor};}
        if edge{
            if let Style::Lotte{crown,..}=self.style{
                if y>crown&&((i64::from(x)+i64::from(z)+i64::from(y)).rem_euclid(9)==0||(i64::from(x)-i64::from(z)+i64::from(y)).rem_euclid(9)==0){return Cell::Frame;}
            }return Cell::Glass;
        }
        if (self.floors.binary_search(&(y+1)).is_ok()||matches!(self.style,Style::Lotte{crown,..} if crown==y+1))
            && x.rem_euclid(6)==0&&z.rem_euclid(6)==0&&self.solid(x,y+1,z){return Cell::Lamp;}
        Cell::Air
    }
}
#[cfg(test)]
mod tests{
    use super::*;
    fn square(n:i32)->Vec<(i32,i32)>{(0..n).flat_map(|x|(0..n).map(move|z|(x,z))).collect()}
    #[test]fn lotte_taper_and_split(){
        let p=Plan::lotte(&square(70),555).unwrap();
        assert_eq!(p.floors.len(),123);
        assert!(p.floors.windows(2).all(|w|w[1]-w[0]>=3));
        assert_eq!(p.cell(35,550,35),Cell::Air);
        assert_eq!(p.cell(35,505,35),Cell::Floor);
        assert!(p.top(0,0).unwrap()<200);
        assert_eq!(p.cell(-1,0,0),Cell::Air);
        assert!(p.tops.values().any(|&h|h==555));
        assert!(Plan::lotte(&square(40),555).is_none());
    }
    #[test]fn ifc_roof_respects_mapped_bearing(){
        let p=Plan::ifc(&square(40),185,1,20,90.0).unwrap();
        assert_eq!(p.floors.len(),32);
        assert_eq!(p.top(0,20),Some(185));
        assert_eq!(p.top(39,20),Some(165));
        assert!(Plan::ifc(&square(40),185,3,20,90.0).is_none());
        assert!(Plan::ifc(&square(40),185,1,0,90.0).is_none());
    }
}
