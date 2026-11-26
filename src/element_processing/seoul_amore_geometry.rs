//! Approximate Amorepacific HQ massing derived from published 2018 elevations.
//! x points east and z south. u=x-z faces NE, v=x+z faces SE.
//! No copied drawings, exact surveyed coordinates, or whole-area suppression.
//! Fit only a complete near-square rotated footprint at 1 m/block.

use fnv::FnvHashSet;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Cell { Air, Floor, Frame, Glass, Lamp }

pub(super) struct Plan {
    footprint: FnvHashSet<(i32, i32)>,
    u0: i64, u1: i64, v0: i64, v1: i64,
    height: i32,
    floors: Vec<i32>,
}

impl Plan {
    pub(super) fn new(cells: &[(i32, i32)], height: i32) -> Option<Self> {
        if !(95..=120).contains(&height) || !(6500..=12000).contains(&cells.len()) {
            return None;
        }
        let mut u0 = i64::MAX;
        let mut u1 = i64::MIN;
        let mut v0 = i64::MAX;
        let mut v1 = i64::MIN;
        let footprint: FnvHashSet<_> = cells.iter().copied().collect();
        if footprint.len() != cells.len() { return None; }
        for &(x,z) in cells {
            let u = i64::from(x) - i64::from(z);
            let v = i64::from(x) + i64::from(z);
            u0 = u0.min(u); u1 = u1.max(u);
            v0 = v0.min(v); v1 = v1.max(v);
        }
        let (du,dv) = (u1-u0,v1-v0);
        if !(118..=158).contains(&du) || !(118..=158).contains(&dv)
            || (du-dv).abs() > 12 { return None; }
        // A diamond has half the area of its (u,v) rectangle.
        let area = du * dv / 2;
        if (cells.len() as i64)*100 < area*88 || (cells.len() as i64)*100 > area*108 {
            return None;
        }
        // Reject missing corners/partial selection: test near all four corners
        // and the center in projected coordinates.
        for (a,b) in [(8,8),(8,92),(92,8),(92,92),(50,50)] {
            let u = u0 + du*a/100;
            let v = v0 + dv*b/100;
            let (x,z) = (((u+v)/2) as i32, ((v-u)/2) as i32);
            if !footprint.contains(&(x,z)) { return None; }
        }
        // 22 above-ground storeys, approximate slab elevations from section
        // band heights: 5F at 20%, 11F at 46%, 17F at 71%.
        // Roof and upper opening head are distinct.
        let marks = [(0,0),(4,height*20/100),(10,height*46/100),(16,height*71/100),(22,height)];
        let mut floors=Vec::with_capacity(22);
        for pair in marks.windows(2) {
            let ((i0,y0),(i1,y1))=(pair[0],pair[1]);
            for i in i0..i1 { floors.push(y0+(i-i0)*(y1-y0)/(i1-i0)); }
        }
        if floors.windows(2).any(|p| p[1]-p[0]<3) { return None; }
        Some(Self{footprint,u0,u1,v0,v1,height,floors})
    }

    fn uv(&self,x:i32,z:i32)->(i64,i64){
        let u=(i64::from(x)-i64::from(z)-self.u0)*1000/(self.u1-self.u0);
        let v=(i64::from(x)+i64::from(z)-self.v0)*1000/(self.v1-self.v0);
        (u,v)
    }

    fn solid(&self,x:i32,y:i32,z:i32)->bool {
        if y<0 || y>self.height || !self.footprint.contains(&(x,z)) {return false;}
        let (u,v)=self.uv(x,z);
        let mid_u=(310..=690).contains(&u);
        let mid_v=(310..=690).contains(&v);
        // Retain the garden deck at its base, clear the courtyard above it.
        if y>self.floors[4] && mid_u && mid_v {return false;}
        // 5F south-east, 11F north-west, 17F north-east. Southwest has no opening.
        if mid_u && v>690 && y>self.floors[4] && y<self.floors[10] {return false;}
        if mid_u && v<310 && y>self.floors[10] && y<self.floors[16] {return false;}
        if mid_v && u>690 && y>self.floors[16] && y<self.height*93/100 {return false;}
        true
    }

    fn edge(&self,x:i32,y:i32,z:i32)->bool {
        [(1,0),(-1,0),(0,1),(0,-1)].iter().any(|&(dx,dz)| !self.solid(x+dx,y,z+dz))
    }

    pub(super) fn cell(&self,x:i32,y:i32,z:i32)->Cell {
        if !self.solid(x,y,z){return Cell::Air;}
        let edge=self.edge(x,y,z);
        let slab=self.floors.binary_search(&y).is_ok();
        // Roof caps and soffits at the tops of the horizontal openings.
        let cap=y==self.height || (y>0 && !self.solid(x,y-1,z));
        if y==0 || slab || cap {
            return if edge {Cell::Frame} else {Cell::Floor};
        }
        if edge {
            return Cell::Glass;
        }
        if self.floors.binary_search(&(y+1)).is_ok() && self.solid(x,y+1,z)
            && !self.edge(x,y+1,z) && x.rem_euclid(6)==0 && z.rem_euclid(6)==0 {
            return Cell::Lamp;
        }
        Cell::Air
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture()->Vec<(i32,i32)> {
        (-68i32..=68).flat_map(|x|(-68i32..=68).filter_map(move |z|
            (x.abs()+z.abs()<=68).then_some((x,z)))).collect()
    }
    #[test]
    fn three_openings_and_court_are_real_voids() {
        let p=Plan::new(&fixture(),110).unwrap();
        assert_eq!(p.floors.len(),22);
        assert_eq!(p.cell(0, p.floors[4],0),Cell::Floor);
        assert_eq!(p.cell(0,110,0),Cell::Air);
        for (x,z,lo,hi) in [(34,34,p.floors[4],p.floors[10]),(-34,-34,p.floors[10],p.floors[16]),(34,-34,p.floors[16],110*93/100)] {
            assert_eq!(p.cell(x,lo+1,z),Cell::Air);
            assert_eq!(p.cell(x,hi,z),Cell::Frame);
        }
        assert_eq!(p.cell(-34,p.floors[12]+1,34),Cell::Glass);
        assert_eq!(p.cell(100,50,100),Cell::Air);
    }
    #[test]
    fn reject_clipped_or_wrong_scale() {
        let f=fixture();
        assert!(Plan::new(&f,80).is_none());
        assert!(Plan::new(&f.iter().copied().filter(|&(x,_)|x<20).collect::<Vec<_>>(),110).is_none());
    }
}
