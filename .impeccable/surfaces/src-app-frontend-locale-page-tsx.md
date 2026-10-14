---
version: 1
slug: "src-app-frontend-locale-page-tsx"
primary_target: "src/app/(frontend)/[locale]/page.tsx"
related_targets: []
---

# Surface brief — public site (homepage first; categories, gallery, project, contact inherit)

Mode: Persuade (home, category), Experience (gallery, image page), Read (guides), Operate (admin — separate).
Audience: villa/detached-house owners on a phone (primary), site managements, architects, hotels/marinas. Job: see real work like theirs, then message on WhatsApp.
Proof: 568 real job photos (watermarked, mixed quality), 11 work categories, references (9 named clients), founder Murat Şen, since 2009. No invented claims.
Constraints: TR/EN (AR RTL later → logical CSS), Lighthouse mobile ≥95, initial JS ≤150KB gz, WCAG 2.2 AA, Montserrat + logo greens are brand commitments, no stock photos, not "luxury", not a WordPress template.

## Direction contract
THESIS: The category standard executed at full craft — a contractor site where real photographs carry every section and the WhatsApp action is always one tap away. It refuses the template version of the same thing: slider heroes, icon-card grids, stock photos, green everywhere.
OWN-WORLD: Warm white ground (#fbfaf7) with near-black ink (#1d1f1c) and one brand green used only for action and the logo (#0b7a3e for text/buttons — the logo #009444 fails AA on white — with #39b54a as a thin accent line). Wood is never drawn: it comes from the photos. Montserrat (brand) for headings, nav and buttons in semibold; Source Sans 3 for body at 17–18px. Radius 10px on photos and buttons, 1px hairlines in #e4e1da, soft offset shadows only on floating elements (sticky action bar, lightbox controls). Icons: one stroke set (lucide), 1.75 stroke.
STORY: In one viewport the visitor sees a real finished job full-bleed, reads what Kefken does and where ("Ahşap deck, pergola ve dış mekan ahşap işleri — İstanbul ve Türkiye geneli"), and has WhatsApp + Teklif al in reach; scrolling, the gallery with filter chips proves range, categories and projects prove depth, process and references prove reliability, and every page ends in a WhatsApp/contact close.
FIRST VIEWPORT: Full-bleed photo (admin-chosen hero image, 100svh on mobile minus header, ~78vh desktop) with a bottom-left text block on a subtle bottom scrim: H1 (Montserrat 600, clamp 2.1→3.6rem, max 2 lines), one-sentence subline, then two buttons — primary green "WhatsApp'tan yazın" and secondary white outline "Teklif al". Top: slim header (logo left, 5 links, phone + language right; mobile: logo, phone icon, menu). Mobile only: sticky bottom bar WhatsApp · Ara · Teklif. No slider, no autoplay, no eyebrow labels.
FORM: Category standard (canon card chosen by the owner on the decision page); references Millboard (filterable gallery with captioned lightbox), Archadeck (category page flow, repeated soft CTAs), Oakwrights (project facts box + story). Seed key 12d6d9c7 (canon).
SIGNATURE: Gallery-first homepage — under the hero, a masonry gallery with filter chips (category · ahşap türü · mekan) and shareable URLs; tapping opens a captioned lightbox whose URL is the image's own page. Motion: one authored moment — the hero photo settles in with a slow scale-from-1.04 + scrim fade (respecting reduced motion); everything else is instant.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
