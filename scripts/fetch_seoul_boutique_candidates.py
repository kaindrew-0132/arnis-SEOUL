#!/usr/bin/env python3
"""One small read-only OSM API fetch for known, unapproved way candidates.
No network retry, no actual map placement. ODbL attribution is retained."""
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode
import sys

BASE = "https://api.openstreetmap.org/api/0.6/"
UA = "arnis-SEOUL boutique research (github.com/kaindrew-0132/arnis-SEOUL)"
def fetch(kind, ids):
    query = urlencode({kind: ",".join(str(n) for n in sorted(ids))})
    with urlopen(Request(BASE+kind+".json?"+query, headers={"User-Agent":UA}), timeout=25) as response:
        raw = response.read(4*1024*1024+1)
    if len(raw)>4*1024*1024:
        raise ValueError("API result too large")
    payload=json.loads(raw)
    if not isinstance(payload.get("elements"),list): raise ValueError("missing elements")
    return payload

def combine(ways, nodes, ids):
    wm={e["id"]:e for e in ways["elements"] if e.get("type")=="way"}
    nm={e["id"]:e for e in nodes["elements"] if e.get("type")=="node"}
    if set(wm)!=set(ids): raise ValueError("missing/extra requested ways")
    out=[]
    for id in sorted(wm):
        e=dict(wm[id])
        ns=e.get("nodes",[])
        if len(ns)<4 or ns[0]!=ns[-1]: raise ValueError("unclosed building candidate")
        e["geometry"]=[{"lat":nm[n]["lat"],"lon":nm[n]["lon"]} for n in ns]
        out.append(e)
    return {"version":0.6,"generator":"arnis-seoul direct candidate review",
            "copyright":"OpenStreetMap contributors","license":"ODbL 1.0",
            "elements":out+list(nm.values())}

def main():
    out=Path(sys.argv[1])
    inv=json.loads(Path("assets/seoul/boutique_inventory.json").read_text(encoding="utf8"))
    ids={c["id"] for s in inv["sites"] for c in s.get("osm_candidates",[]) if c["type"]=="way"}
    if not ids or len(ids)>15: raise ValueError("candidate bound")
    ways=fetch("ways",ids)
    nodes={n for e in ways["elements"] if e.get("type")=="way" for n in e["nodes"]}
    if not nodes or len(nodes)>250: raise ValueError("node bound")
    result=combine(ways,fetch("nodes",nodes),ids)
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf8")
    print("Retrieved",len(ids),"candidate ways and",len(nodes),"nodes (not approved)")
if __name__=="__main__": main()
