# Special geometry batch: Amorepacific and Warner

Amorepacific: owner announcement confirms 22 above-ground storeys and garden levels 5/11/17. Designer drawings (PDF pages 14–18, counting from 1) show a central void, SE lower opening, NW middle opening, NE upper opening, and no SW opening. Approximate projected square side 95 m, courtyard width ~38–40% of facade, elevation breakpoints ~20/46/71/93% of height. Sources:
- https://www.apgroup.com/int/ko/misc/news/2018-01-09.html
- https://www.apgroup.com/int/en/news/2018-01-09.html
- https://cdn.archilovers.com/projects/2ebc750b-ab2d-4fe0-87cd-24d7c9b35aff.pdf
- https://www.cibsejournal.com/general/cibse-building-performance-award-winner-amorepacific-headquarters-seoul/

The new Rust renderer uses the original mapped cells and height, actual empty courtyard and openings, slab and soffit surfaces, transparent glazing, sparse invisible lamps. Approximate geometry is gated on exact existing landmark alias, Java 1:1, full near-diamond footprint, ground level, no mapped water or passages, no inner rings; fallback to previous profile otherwise. No actual OSM match or world test yet; shape/axis assumptions and tile consistency require verification. No fake garden vegetation or surveyed interior claim. The public drawings are not copied into the repo.

Warner: Heerim confirms 20 above-ground floors, north-south narrow site and sky garage; public news reports 94.7 m. Extend the Trimage floor distribution to 20 levels with aligned bands; preserve map envelope, no inferred actual private layout, garage positioning or solar-panel elevation. Sources https://www.heerim.com/kr/project/project_view.php?idx=1025&idx=1031 ; https://www.news1.kr/amp/realestate/construction/4657052 ; https://www.mk.co.kr/news/realestate/10170039 .
