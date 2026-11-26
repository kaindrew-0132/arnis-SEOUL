//! Explicitly reviewed, in-plane boutique facade application.
//! Never infer permission from a name, a POI, or a third-party ID.
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub(super) enum Material { Clear, Silver, Smoke, Dark, White, Stone, Black, Gray, Metal, Brown, Brass, Green, Lamp }
#[allow(dead_code)]
#[derive(Clone,Copy,Debug,PartialEq,Eq)]
enum Style { Sails, Stone, Openwork, Garden, TwoGlass, Ceramic, Plaid, Brass, Arch, DoubleSkin, Lattice }
#[derive(Clone,Copy,Debug)]
struct Approval {
    way:u64, start:u64, end:u64,
    // Exact projected cardinal segment length at 1:1; node identities alone
    // do not prove a footprint is unchanged.
    edge_length:i32, offset:i32, width:i32, height:i32, style:Style,
}
// Empty until an actual OSM footprint, storefront occupancy, reference date,
// and facade direction/extent have been reviewed. No fabricated approvals.
const APPROVED:&[Approval]=&[];
pub(super) fn has_approval(way:u64)->bool { APPROVED.iter().any(|a|a.way==way) }
#[derive(Clone,Copy,Debug)]
pub(super) struct Plan { a:Approval, x:i32,z:i32,dx:i32,dz:i32 }
fn resolve_in(approved:&[Approval],way:u64,ring:&[(u64,i32,i32)],height:i32)->Option<Plan>{
    let mut matches=approved.iter().filter(|a|a.way==way);
    let a=*matches.next()?;
    if matches.next().is_some()||a.start==a.end||a.width<9||a.width>60||a.height<8||a.height>50
        ||a.offset<1||a.offset.checked_add(a.width)?>a.edge_length||a.height>=height{return None;}
    if ring.len()<5||ring.first()!=ring.last(){return None;}
    let mut found=None;
    for pair in ring.windows(2){
        let (p,q)=match (pair[0].0,pair[1].0){
            (u,v) if u==a.start&&v==a.end=>(pair[0],pair[1]),
            (u,v) if u==a.end&&v==a.start=>(pair[1],pair[0]),
            _=>continue,
        };
        if found.is_some(){return None;}
        let (dx,dz)=(q.1.checked_sub(p.1)?,q.2.checked_sub(p.2)?);
        if (dx==0)==(dz==0)||dx.checked_abs()?.max(dz.checked_abs()?)!=a.edge_length{return None;}
        found=Some(Plan{a,x:p.1,z:p.2,dx:dx.signum(),dz:dz.signum()});
    }
    found
}
pub(super) fn resolve(way:u64,ring:&[(u64,i32,i32)],height:i32)->Option<Plan>{resolve_in(APPROVED,way,ring,height)}
impl Plan {
    pub(super) fn material(&self,x:i32,z:i32,y:i32)->Option<Material>{
        let (x,z)=(x.checked_sub(self.x)?,z.checked_sub(self.z)?);
        if (self.dx==0&&x!=0)||(self.dz==0&&z!=0){return None;}
        let u=x.checked_mul(self.dx)?.checked_add(z.checked_mul(self.dz)?)?.checked_sub(self.a.offset)?;
        if !(0..self.a.width).contains(&u)||!(1..self.a.height).contains(&y){return None;}
        // Preserve the original entrance in the middle; the caller additionally
        // preserves every mapped/procedural door and party wall.
        if y<=3&&(u-self.a.width/2).abs()<=1{return None;}
        Some(pattern(self.a.style,u,y,self.a.width,self.a.height))
    }
}
fn pattern(style:Style,x:i32,y:i32,w:i32,h:i32)->Material{
    use Material::*;
    let (base,glass,frame)=match style{
        Style::Sails=>(Stone,Clear,Metal),Style::Stone=>(Black,Dark,White),
        Style::Openwork=>(Stone,Silver,Brown),Style::Garden=>(Gray,Clear,Metal),
        Style::TwoGlass=>(Gray,Silver,Metal),Style::Ceramic=>(Green,Clear,Green),
        Style::Plaid=>(Metal,Silver,Gray),Style::Brass=>(Brown,Clear,Brass),
        Style::Arch=>(Stone,Silver,Lamp),Style::DoubleSkin=>(White,Clear,Brass),
        Style::Lattice=>(Stone,Silver,Brown),
    };
    if x==0||x==w-1||y==h-1{return base;}
    if y<=4{return if x>=2&&x<=w-3{glass}else{base};}
    if y<6{return base;}
    match style{
        Style::Sails=>glass,
        Style::Stone=>if (x-w/2).abs()<=2&&y%5!=0{glass}else{base},
        Style::Openwork=>if x%4==0||y%4==0{frame}else{glass},
        Style::Garden=>if x%5==0||y%5==0{frame}else{glass},
        Style::TwoGlass=>if x<w/2{Silver}else{Smoke},
        Style::Ceramic=>base,
        Style::Plaid=>if x%5==0||y%5==0{frame}else{glass},
        Style::Brass=>if (x+y)%6==0||(x-y).rem_euclid(6)==0{frame}else{glass},
        Style::Arch=>{
            let u=(x-1)%7;let r=y-6;
            if ((0..=11).contains(&r)&&(u==0||u==6))||
                ((12..=13).contains(&r)&&(u==1||u==5))||
                ((14..=15).contains(&r)&&(u==2||u==4))||(r==16&&u==3){Lamp}else{glass}
        }
        Style::DoubleSkin=>if x%7==1||y%7==0{Brass}else if x%5==0||(x*3+y*2)%17==0{White}else{Clear},
        Style::Lattice=>if y==h-2||x%4==0||y%5==0{frame}else{glass},
    }
}
#[cfg(test)]mod tests{
    use super::*;
    const A:Approval=Approval{way:42,start:1,end:2,edge_length:30,offset:3,width:19,height:16,style:Style::Sails};
    const R:[(u64,i32,i32);5]=[(1,0,0),(2,30,0),(3,30,20),(4,0,20),(1,0,0)];
    #[test]fn explicit_edge_and_bounded_span(){
        let p=resolve_in(&[A],42,&R,30).unwrap();
        assert_eq!(p.material(5,0,7),Some(Material::Clear));
        assert_eq!(p.material(12,0,2),None);
        assert_eq!(p.material(2,0,7),None);
        assert_eq!(p.material(22,0,7),None);
        assert_eq!(p.material(5,1,7),None);
        assert_eq!(p.material(5,0,16),None);
        assert_eq!(p.material(5,0,0),None);
        let mut rev=R;rev.reverse();
        assert_eq!(resolve_in(&[A],42,&rev,30).unwrap().material(5,0,7),Some(Material::Clear));
    }
    #[test]fn fail_closed(){
        assert!(resolve(42,&R,30).is_none());
        assert!(!has_approval(42));
        assert!(resolve_in(&[A],43,&R,30).is_none());
        assert!(resolve_in(&[A,A],42,&R,30).is_none());
        assert!(resolve_in(&[A],42,&R[..4],30).is_none());
        assert!(resolve_in(&[A],42,&R,16).is_none());
        let mut changed=R;changed[1].1=31;
        assert!(resolve_in(&[A],42,&changed,30).is_none());
        let mut diagonal=R;diagonal[1].2=1;
        assert!(resolve_in(&[A],42,&diagonal,30).is_none());
    }
}
