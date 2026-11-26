#!/usr/bin/env python3
"""Bounded public OSM identity and street-frontage review. Never approves placement."""
import json, math, re, sys, unicodedata
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlencode
from fetch_seoul_boutique_candidates import BASE,UA,fetch,combine

def norm(s):
    return "".join(c for c in unicodedata.normalize("NFKC",str(s)).casefold()
                   if not c.isspace() and unicodedata.category(c)[0] not in "PS")

def read_api(endpoint,params=None):
    url=BASE+endpoint+("?" + urlencode(params) if params else "")
    with urlopen(Request(url,headers={"User-Agent":UA}),timeout=25) as r:
        data=r.read(8*1024*1024+1)
    if len(data)>8*1024*1024: raise ValueError("oversized response")
    p=json.loads(data)
    if not isinstance(p.get("elements"),list):raise ValueError("missing elements")
    return p

def enrich(data):
    nodes={e["id"]:e for e in data["elements"] if e.get("type")=="node"}
    out=[]
    for e in data["elements"]:
        e=dict(e)
        if e.get("type")=="way" and all(n in nodes for n in e.get("nodes",[])):
            e["geometry"]=[{"lat":nodes[n]["lat"],"lon":nodes[n]["lon"]} for n in e["nodes"]]
        out.append(e)
    return {"version":0.6,"copyright":"OpenStreetMap contributors","license":"ODbL 1.0","elements":out}

def local_map(lat,lon,span):
    if not(37.4<lat<37.7 and 126.8<lon<127.2 and 0<span<=.002):
        raise ValueError("outside bounded Seoul request")
    return enrich(read_api("map.json",{"bbox":f"{lon-span:.7f},{lat-span:.7f},{lon+span:.7f},{lat+span:.7f}"}))

def report(registry,ways,relations):
    by={(e.get("type"),e.get("id")):e for e in ways["elements"]+relations["elements"]}
    rows=[]
    for c in registry["entries"]:
        e=by.get((c["type"],c["id"]))
        t=e.get("tags",{}) if e else {}
        names=[t.get(k,"") for k in ("name","name:ko","name:en","official_name")]
        name_match=any(norm(n) in c["aliases"] for n in names if n)
        h=t.get("height","")
        try:height=float(re.sub(r"\s*m$","",h))
        except (ValueError,TypeError):height=None
        rng=c["height_m_range"]
        row={"key":c["key"],"type":c["type"],"id":c["id"],"present":e is not None,
             "building":t.get("building"),"building_part":t.get("building:part"),"name":names,
             "exact_name_match":name_match,"height":height,"levels":t.get("building:levels"),
             "height_in_range":height is not None and rng[0]<=height<=rng[1],
             "relation_type":t.get("type"),"node_count":len(e.get("nodes",[])) if e else 0,
             "members":e.get("members",[]) if e and c["type"]=="relation" else [],
             "approved":False}
        rows.append(row)
    return rows

def dump(out,name,data):
    (out/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf8")

def main():
    out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
    reg=json.loads(Path("assets/seoul/landmark_identity_candidates.json").read_text(encoding="utf8"))
    inv=json.loads(Path("assets/seoul/boutique_inventory.json").read_text(encoding="utf8"))
    ids={c["id"] for c in reg["entries"] if c["type"]=="way"}
    bids={c["id"] for s in inv["sites"] for c in s.get("osm_candidates",[]) if c["type"]=="way"}
    if len(ids|bids)>20:raise ValueError("way limit")
    ways=fetch("ways",ids|bids)
    nodes={n for e in ways["elements"] if e.get("type")=="way" for n in e["nodes"]}
    if len(nodes)>400:raise ValueError("node limit")
    geom=combine(ways,fetch("nodes",nodes),ids|bids)
    dump(out,"known-ways.json",geom)
    rids={c["id"] for c in reg["entries"] if c["type"]=="relation"}
    relations=fetch("relations",rids) if rids else {"elements":[]}
    dump(out,"relations.json",relations)
    rows=report(reg,geom,relations)
    dump(out,"landmark-review.json",rows)
    for row in rows: print("LANDMARK",json.dumps({k:v for k,v in row.items() if k!="members"},ensure_ascii=False))
    # Two small, independently attributable maps: boutique street and Trimage.
    # Derive boutique centers from raw way geometry, not arbitrary guesses.
    boutiques=[e for e in geom["elements"] if e.get("type")=="way" and e["id"] in bids]
    points=[p for e in boutiques for p in e["geometry"]]
    if points:
        lat=(min(p["lat"] for p in points)+max(p["lat"] for p in points))/2
        lon=(min(p["lon"] for p in points)+max(p["lon"] for p in points))/2
        span=max(max(abs(p["lat"]-lat),abs(p["lon"]-lon)) for p in points)+.0006
        try:
            m=local_map(lat,lon,span)
            dump(out,"boutique-street.json",m)
            print("BOUTIQUE_STREET",len(m["elements"]))
        except Exception as exc: print("BOUTIQUE_STREET_UNAVAILABLE",str(exc))
    for box in reg["local_review_boxes"]:
        try:
            m=local_map(*box["center"],box["half_span_deg"])
            dump(out,box["key"]+".json",m)
            # Log only public building feature names and heights, no contact or personal data.
            for e in m["elements"]:
                t=e.get("tags",{})
                if e.get("type")=="way" and (t.get("building") or t.get("building:part")):
                    n=t.get("name","")+" "+t.get("name:en","")+" "+t.get("name:ko","")
                    if any(a in norm(n) for a in ["trimage","트리마제","lotteworldtower","롯데월드타워"]) or (box["key"]=="trimage" and t.get("building")=="apartments"):
                        print("LOCAL",json.dumps({"district":box["key"],"id":e["id"],"name":n,"height":t.get("height"),"levels":t.get("building:levels"),"part":t.get("building:part"),"nodes":len(e.get("nodes",[]))},ensure_ascii=False))
        except Exception as exc: print("LOCAL_UNAVAILABLE",box["key"],str(exc))
if __name__=="__main__": main()
