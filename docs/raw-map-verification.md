# Raw map verification results (2026-11-26)
Source: https://github.com/kaindrew-0132/arnis-SEOUL/actions/runs/45825983884 (OpenStreetMap contributors, ODbL 1.0). Ten candidate building ways and Lotte World Tower relation 8824257 all matched name and mapped height range. Lotte relation type=building, not a single footprint; dedicated relation handling remains unverified.
Four Trimage towers raw names are bare numbered Korean names, not complex names:
- 101: way 601252644, 157m, 47 levels
- 102: way 601252645, 154m, 46 levels
- 103: way 601252642, 144m, 45 levels
- 104: way 601252643, 150m, 47 levels
Nearby unrelated 101–106 numbered buildings are much lower; never globally alias bare numbered names. Two Galleria Foret apartment ways 473812530/473812532 share the same name, 171.5m and 45 levels; no assignment to 101/102. The generator now recognizes these six identities with strict name/type/level/height guards. Existing name-based rules retained. IFC3 maps 55 levels versus operator 56; Amore 21 vs owner 22; Trade Tower 55 vs operator 54. Existing operator-based schedules not silently changed.
Street evidence: Moncler way 357063920 matches both brand and address. Prada 357024707 only brand, current temporary location unconfirmed. LV east-facing candidate edge 18.72m, 67.4°; 19m preview does not fit the required margins; do not select the opposite wall just to fit. Gucci candidate 22.17m, 65.7°, nominal 19m preview fits; Cartier candidate 24.26m, 198.9°, 21m preview fits but brand/address tags unconfirmed. All real candidate edges are angled; the cardinal-only renderer still needs diagonal support. No boutique approval issued. Actual world and visual checks remain outstanding.
