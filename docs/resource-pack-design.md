# Seoul resource pack v0.8 — design
Status: design only, not yet implemented. Reference date proposed: 2026-11-26.
Target Java 1.21.1 (pack format 34); check actual supported game versions before release.
32 px core, 16 px low variant; identical geometry and block IDs. No required mods, shaders,
animated block textures or per-building block entities. Original procedural art, not downloaded photographs.
Retain normal cube and glass models, cullfaces, physics, and actual light blocks. No faux reflection
that depends on view direction. A resource pack changes a block globally; building profiles choose
shared material slots, not per-building texture overrides.

## Shared material contract (proposed)
RGB hex and alpha values are art-direction targets, not surveyed material measurements.
For transparent glass: alpha is PNG opacity, not physical light transmission.
Every tile is 32x32, repeatable, no baked sun, no random bright windows.
Glass center alpha is constant; mullions occupy edge pixels with alpha 190–220.
Stone/metal tiles opaque, subtle variation within ±4 RGB levels.
Keep GLASS, LIGHT, doors, terrain and common crafting blocks unchanged where possible.
Overridden slots must be audited for non-building uses and documented.

| Slot | Minecraft ID | RGB | Center alpha | Pixel pattern (32px) |
|---|---|---|---:|---|
| cool_blue | light_blue_stained_glass | #547B99 | 78 | 1px vertical edge seam, 1px center line at x=16; no opaque horizontal strip |
| silver_glass | light_gray_stained_glass | #B1C1CB | 65 | 1px vertical seam at x=0; 1px center line; low-contrast |
| smoke_glass | gray_stained_glass | #667580 | 92 | 1px edge only, minimal grid |
| dark_glass | black_stained_glass | #343B43 | 110 | 1px edge only, retain see-through center |
| warm_gold | yellow_stained_glass | #BB9251 | 90 | 1px dark bronze seam at x=0,y=0; restrained satin tint |
| red_steel | red_concrete | #B51E2C | 255 | flat satin color, subtle shading, no bolts |
| silver_metal | light_gray_concrete | #AEB8C1 | 255 | subtle uniform metal |
| white_metal | white_concrete | #E2E5E5 | 255 | flat matte white |
| pale_stone | smooth_quartz | #DCD5C7 | 255 | fine grain, no exaggerated mortar; audit shared quartz texture paths |
| charcoal_panel | gray_concrete | #505A62 | 255 | restrained panel edge |
| black_stone | polished_blackstone | #292C30 | 255 | subtle volcanic-stone grain |
| bronze_frame | brown_concrete | #796044 | 255 | subtle satin grain |
| white_fabric | quartz_block | #F0EFEA | 255 | very fine woven pattern, conditional on global-use audit |
| floor | smooth_stone | #B7B9B6 | 255 | retain existing texture initially |

The art palette is deliberately shared. Silver glass has ONE recipe for LWT/IFC/etc.
Do not force an upper bound on every section's palette or recolor other structures.
LIGHT stays invisible. Emissive textures are not actual light; leave optional enhancements to later.
No use of TINTED_GLASS for vision glass (blocks light).
Check Arnis is_glass_wall and light opacity/emission/export classifiers for yellow glass before use.
No overlay signs repeated citywide: vanilla sign text initially; only sparse optional panels.

## Building profiles — first analysis batch
All geometry must use verified footprints, orientations, height/floor sources.
Profiles are proposals; no invented survey dimensions, exact structural levels, floor plans or OSM IDs.
Each RGB comes from the shared contract, not a unique texture for the building.

| Profile | Shared slots | Generator geometry / lighting | Evidence |
|---|---|---|---|
| Parc.1 towers | cool_blue, red_steel, silver_metal, floor, LIGHT | Red structural posts, silver horizontal floor bands, glass bays; correct existing provisional 12-storey red bands using elevations; no solid backing on vision glass. | https://rshp.com/projects/mixed-use/parc-1/ ; https://www.guardianglass.com/eu/en/projects/project-details/parc-one |
| 63 Building | warm_gold, bronze_frame, charcoal_panel, floor, LIGHT | Curved footprint, actual dark mechanical bands, continuous golden glazing. Avoid literal yellow wall. Separate current podium from historic tower. | https://dotsawards.com/work/workView.php?wid=2062 |
| Lotte World Tower | silver_glass, white_metal, charcoal_panel, floor, LIGHT | Tapered section by height, vertical seam, split crown; slender white mullions in texture; no invented bands. | https://www.kpf.com/project/lotte-world-tower ; https://www.kpf.com/news/lotte-world-tower-opens-in-seoul |
| Raemian One Bailey | smoke_glass, charcoal_panel, pale_stone, silver_metal, floor, LIGHT | 23 buildings, up to 35 floors, two skybridges (verify linked towers and elevations). Dark gray-blue fields with bright vertical strips from photo; distinguish opaque curtain-wall-look from windows. | https://secc.co.kr/ko/business/portfolio/all/300 ; https://www.fnnews.com/news/202502261808104895 |
| Amorepacific HQ | silver_glass, white_metal, charcoal_panel, floor, LIGHT | Cube with courtyard and real large facade openings; regular white fins via vertical texture except prominent structural edges. A dedicated fin texture may need a separately reserved glass ID after audit; no fake holes in texture. | https://davidchipperfield.com/projects/amorepacific-headquarters ; https://en.hdec.kr/en/tech/project.aspx?bizCate=HOSPITAL&bizIntro=383&searchType=ARCHI |
| IFC Seoul | silver_glass, smoke_glass, silver_metal, floor, LIGHT | Distinct prismatic office towers; angled faces and tops via footprint/height, not baked reflections. | https://arquitectonica.com/architecture/project/international-finance-center-seoul-conrad-hotel/ ; https://www.skyscrapercenter.com/seoul/three-international-finance-center/646 |
| ACRO Seoul Forest | smoke_glass, white_metal, pale_stone, floor, LIGHT | Two residential towers with large clear window bays, white cladding and cantilevered facade pattern; D Tower separate office profile. | https://junglim.com/en/acro-seoul-forest/ ; https://www.grespania.com/en/inspiration/projects/acro-seoul-forest-skyscraper ; https://www.jung-group.com/ko-KR/Residential-and-Office-Complex-ACRO-Seoul-Forest-South-Korea/4627 |
| Warner (ONER) Cheongdam | dark_glass, smoke_glass, charcoal_panel, silver_metal, floor, LIGHT | 20 above-ground floors, narrow site, one household per residential floor, usable sky garage zone only from public plans; BIPV opaque panels distinct from glazing. Actual facade mapping remains pending completed photos, colors provisional. | https://www.heerim.com/kr/project/project_view.php?idx=1025&idx=1031 ; https://www.mk.co.kr/news/realestate/10170039 ; https://mbiz.heraldcorp.com/article/10739129 |
| Eterno Cheongdam | pale_stone, smoke_glass, white_metal, floor, LIGHT | Deep stone piers, balconies and broad window openings as geometry; no false full-glass box. Color and exact bay spacing provisional. | https://eterno-official.com/cheongdam/ ; https://en.hdec.kr/kr/tech/project.aspx?bizIntro=261&searchType=HOUSE |
| Centerfield | smoke_glass, silver_metal, charcoal_panel, floor, LIGHT | Two towers and podium; vertical rhythm; fine vertical lines in texture, structural differences in geometry. | https://www.dagroup.kr/works/design.php?code=design&idx=922&page=1&ptype=view |
| Tower Palace III | smoke_glass, pale_stone, silver_metal, floor, LIGHT | Main shaft and distinct base, large glazed entry canopy; color and tower elevations provisional pending photo and elevation study. | https://www.lerchbates.com/projects/tower-palace-iii/ |
| Louis Vuitton Maison Seoul | GLASS, pale_stone, silver_metal, LIGHT | Curved and angled signature glass sails; actual block shell shape, no heavy decorative entities; local sign. | https://www.permasteelisagroup.com/project/louis-vuitton-maison-seoul/ ; https://us.louisvuitton.com/eng-us/magazine/articles/cafe-louis-vuitton-seoul |
| House of Dior Cheongdam | white_fabric, silver_metal, GLASS, LIGHT | White billowing shells and rear silver box; geometry for shells, subtle woven pattern and optional rear cannage texture only after material audit. Verify store/site reference date. | https://www.2portzamparc.com/en/projects/house-of-dior-seoul/ |
| Chanel Seoul flagship | black_stone, dark_glass, white_metal, LIGHT | Black volcanic stone and dark glass; crisp facade openings and white signage. | https://visitgangnam.net/en/places/chanel-seoul-flagship ; https://www.chanel.com/kr/fashion/services/boutique-seoul-flagship/ |

## Integration and acceptance
Existing src/mapillary/displays.rs writes world/resources.zip; do not replace it independently.
Start with optional client pack and explicit priority ordering. For automated world export, unify or
merge ZIP entries, preserve user packs, validate format per supported game version, and test existing
Mapillary panels and pack backups. Existing display item models may require newer game versions.
A citywide pack may alter other uses of chosen vanilla IDs; audit all generated uses and document.
Test transparency, light and mipmaps at 8/128/256-chunk views with Sodium/DH; regenerate LOD color
cache if required and verify Distant Horizons retains acceptable appearance and nighttime lighting.
Compare on same Yeouido bbox, resolution and settings, with vs without pack: median FPS, 1% low,
VRAM/RAM, load times, file size, screenshots day/night. Target no more than 5% median FPS loss as
a provisional acceptance goal, not a measured result. No new geometry/entities from Core pack.
Use 16px if 32px fails. Test at normal gameplay distance and LOD distance.
Remaining: detailed per-building analysis of all priority candidates (including Trimage, PH129,
other Banpo towers, Tower Palace I/II, other offices) and complete verified boutique inventory;
do not label preliminary profiles as surveyed or claim all district buildings are covered.
