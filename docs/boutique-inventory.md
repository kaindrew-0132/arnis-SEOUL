# Boutique inventory, identity review (batch 3)

Base: 7c933d38f476b72fca5139cd750ae5a427accabc (expanded landmarks; Windows CI 45794831097 succeeded).
The previous document names 32 brands plus additional mapped stores, not 33 verified stores.
This change creates an extensible inventory and an offline OSM candidate review tool.
Four address records across three brands: Louis Vuitton 454 and Chanel 431 have official address evidence; Dior 464 and 467 are separate official address records requiring reference-date review. No OSM identity, building geometry, runtime material profile, or completed store census is claimed. Do not attach the historic Dior 464 facade to 467.

Run:
```
node scripts/review_seoul_boutiques.cjs --self-test
node scripts/review_seoul_boutiques.cjs district-overpass.json > boutique-review.json
```

Input must be a district-cropped Overpass JSON export including building ways/relations, shop POIs, address tags and geometry when available. The tool matches exact normalized names/brand aliases or exact street + number. It intentionally misses unlisted aliases and addressless buildings; results need manual spatial association and evidence. It never promotes a node to a building, never treats building:part as a whole building, and never approves any identity. Review geometry, dates, tenancy, footprint, height and orientation before adding an explicit generator profile. For shared buildings, model the storefront only. No broad area suppression.

Next: verified OSM district export, complete address inventory, per-site facade geometry, explicit runtime identity mapping and in-game comparison.
