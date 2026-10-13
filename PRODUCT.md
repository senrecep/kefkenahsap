# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router, React 19, Tailwind 4) + Payload CMS 3.x in one app, bun, Postgres 17, media on S3-compatible storage (Cloudflare R2 in prod, MinIO locally), Docker Compose on Dokploy behind Cloudflare. next-intl style locale-prefixed routing (/tr, /en; AR/RU/DE later, AR needs RTL). Animation: Motion, GSAP ScrollTrigger, OGL (lazy, reduced-motion aware).

## Users

Kefken Ahşap Dekorasyon is a wood fabrication and installation contractor in Istanbul. All four groups below are real past customers; villa owners are the priority audience.

1. **Villa and detached-house owners (primary).** They want a deck, pergola, gazebo, fence or poolside wood work for their own home. They mostly arrive on a phone from Google or Instagram, look through photos of similar work, and message on WhatsApp.
2. **Site managements and institutions** (e.g. Riva Konakları, İBB Sosyal Tesisler, Kemer Golf & Country). They have large areas and recurring maintenance, and look for references and capacity.
3. **Architects, landscape architects and contractors.** They need a reliable subcontractor and care about wood species, technical detail and capacity.
4. **Hotels, restaurants, marinas and boat owners.** Their jobs are commercial outdoor areas, piers, teak and boat decks.

Admin users are the owner plus one or two editors, at least one non-technical (~60 years old). They mainly use a phone on site to add photos, reorder them, and fix short texts.

## Product Purpose

The site is a public portfolio and lead generator, replacing a 2018 WordPress site. Success means being found with a minimal marketing budget, in Google (including local/Maps searches) and in AI answer engines (ChatGPT, Claude, Perplexity, Google AI Overviews), for wood-work queries in Istanbul and across Türkiye. A visitor should see real work similar to what they want and then send a WhatsApp message (the primary action) or a quote request.

## Positioning

- Fabrication and installation are done by the same hands: the company has its own workshop and team, from measurement to installation, with no middleman.
- It has decades of master-craftsman (esnaf) experience.
- It stays after installation: maintenance, repair and refinishing, including work other companies built.
- It takes on hard and large jobs: bridges, piers, institutional projects, and work abroad (Libya).

## Operating Context

- Work categories (11): Ahşap Yapılar, Boya Tamir ve Bakım, Çiçeklik ve Oturma Grubu, Deck ve Zeminler, Ireko-Teak, Kapı Dolap ve Seperatör, Köprü ve İskele, Korkuluk ve Çit, Merdivenler, Mobilya ve Cila, Pergola ve Kamelyalar.
- Content model: categories, tags (wood species, setting, color/finish, before/after/process/detail), projects (location, year, wood, size, duration, finish, testimonial), guides/blog, admin-managed region pages, references.
- Location: Mavigöl, Münteha Sk. No:31, Arnavutköy/İstanbul. Service area is Istanbul first, then all of Türkiye.
- Contact channels: WhatsApp/GSM 0532 295 84 16, landline 0212 322 43 59, kefkenahsapdekorasyon@gmail.com (info@kefkenahsap.com once active). Instagram, Facebook and a Google Business Profile exist.

## Capabilities and Constraints

- Every photo is a real job photo. Most are older phone or Facebook-era shots of mixed quality and resolution, and many carry an existing www.kefkenahsap.com watermark, which stays. 568 curated launch images are in kefken-data/Webiste; a larger archive (Kaliteli, 3250) will be added later.
- Galleries hold many images (up to ~140 per category), so they need masonry, infinite scroll, a lightbox, and an SSR page per image.
- Performance targets: Lighthouse mobile 95+, Core Web Vitals green, initial JS ≤150KB gz. Any 3D or WebGL loads lazily and is optional.
- Undecided: founding year, founder/master's name, team size, project count. These are admin placeholders; do not state "30 years" until it is confirmed.

## Brand Commitments

- The existing logo (KEFKEN wordmark + leaf, greens #009444 / #39b54a, dark #231f20 / #414042) and Montserrat (brand font asset) are kept.
- Green is the brand signature only. The site must not be drowned in green.
- No stock photography: only the company's real work.
- The site must not look "luxury" in a way that scares people off on price. The warmth of a tradesman (esnaf) stays.
- It must not look like a template corporate theme (no Elementor/WordPress feel).
- Visual direction (chosen 2026-10-14): the category standard, executed at full craft. White ground, brand green as the action color, full-bleed real photography, a clear service grid. The conventions are embraced deliberately; quality comes from execution, not novelty.

## Evidence on Hand

- 568 categorized real job photos (kefken-data/Webiste/<Category>/) and an archive of 3250 (kefken-data/Kaliteli).
- A reference list of 9 named clients with locations (current /referanslar page).
- A logo in vector and raster formats (kefkenahsap-logo/).
- Absent and not to be fabricated: testimonials, project counts, years, prices, certifications, team photos. All of these come later through the admin.

## Product Principles

1. The work is the proof. Real photos lead; copy supports them.
2. One tap to a human. WhatsApp is always within reach, prefilled with the context the visitor is looking at.
3. Specific beats generic. Wood species, place, size and year are named everywhere they are known, because both people and AI engines quote specifics.
4. Simple enough for the owner. Any content task the business does weekly must be doable from a phone without help.
5. Honest craft. No invented claims, no luxury posturing.

## Accessibility & Inclusion

WCAG 2.2 AA. Respect reduced-motion and low-power devices. Use large tap targets and readable type for an older admin user and older homeowners. Arabic will need RTL later.
