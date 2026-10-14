---
name: Kefken Ahşap Dekorasyon
description: Public portfolio of an Istanbul wood contractor. Real job photos lead, and WhatsApp is always one tap away.
colors:
  action: "#0b7a3e"
  action-deep: "#075c2e"
  paper: "#fbfaf7"
  mist: "#f2f0eb"
  line: "#e4e1da"
  ink: "#1d1f1c"
  ink-soft: "#5c5f58"
  error: "#b42318"
  error-soft: "#fef3f2"
typography:
  display:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.1rem, 5vw, 3.6rem)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Source Sans 3, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  button:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.98rem"
    fontWeight: 600
  label:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    letterSpacing: "0.025em"
rounded:
  photo: "10px"
  control: "10px"
  pill: "9999px"
spacing:
  gutter: "16px"
  gutter-md: "24px"
  section: "64px"
  section-md: "96px"
  container: "1280px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "#ffffff"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.action-deep}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
  button-outline-hover:
    backgroundColor: "{colors.mist}"
  button-on-photo:
    backgroundColor: "rgb(255 255 255 / 0.1)"
    textColor: "#ffffff"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  chip-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  mobile-action-cell:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    height: "56px"
  mobile-action-cell-whatsapp:
    backgroundColor: "{colors.action}"
    textColor: "#ffffff"
  closing-band:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
    padding: "48px 0"
  footer:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
---

# Design System: Kefken Ahşap Dekorasyon

## Overview

**Creative North Star: "The Finished Job, One Tap From a Human"**

This is the contractor-site standard built with care. Real job photographs carry every section. Copy is short and plain. The way to reach a person (WhatsApp, a phone call or a quote form) stays within reach on every page. The system adds no decoration of its own: wood appears only in the photos, the ground is a warm white, the text is a near-black ink, and one green marks every action. The craft is in execution: AA contrast over photos, 48px tap targets, hairline structure, a single motion moment, and empty states that always offer a next step.

The density is calm and documentary. Pages are photo grids and hairline lists separated by generous vertical rhythm, with no cards and no icon tiles. The site is built to feel like a tradesman's honest portfolio, not a luxury brand and not a template theme. It deliberately rejects the template version of this genre: slider heroes, icon-card grids, stock photos, and green used everywhere.

Recorded adaptations from the direction contract (accepted deviations, not drift):
- The header has six links, adding "Rehber". Five show while "Projeler" is hidden; it is hidden from the nav while no project is published, but its route still works.
- Gallery facets are category only. Wood-type and place facets are deferred until that tag data exists; the tag row renders only once tags exist.
- Page 1 of an unfiltered `/galeri` is a curated selection, not a raw chronological feed.
- The planned WebGL / GSAP hero effect was skipped to stay inside the 150KB JS budget. The hero motion is CSS only.

**Key Characteristics:**
- Full-bleed real photography. Nothing is illustrated, and wood is never drawn.
- One action green, reserved for buttons, links and the WhatsApp cell.
- Montserrat 600 for headings, nav and buttons. Source Sans 3 for body text.
- 10px corners on photos and controls. Pills only for filter chips and lightbox controls.
- Structure comes from 1px hairlines, not cards or boxes.
- Flat at rest, with one soft shadow reserved for floating elements.
- One authored motion moment (the hero settle). Everything else is instant or a 150ms colour change.

## Colors

The palette is a warm neutral paper with near-black ink and a single deep green that means "act here".

### Primary
- **Action Green** (`action`): the only colour that signals an action. It is used for primary and WhatsApp buttons, the WhatsApp cell of the mobile action bar, inline links, the "Tüm galeriyi gör" text link, the text selection, the caret and checkbox accents. It is not the focus colour (see Focus below). It passes AA as text on paper, and white text passes AA on it.
- **Deep Action Green** (`action-deep`): hover and pressed states of everything drawn in Action Green. It is never used at rest.

### Neutral
- **Warm Paper** (`paper`): the page ground, header, chips at rest, outline buttons, the consent banner and the mobile action bar.
- **Mist** (`mist`): quiet surfaces, used for the closing band, hover fills on outline buttons and menu rows, and the placeholder behind a photo that has not loaded.
- **Hairline** (`line`): every 1px divider and border. It draws list rules, the header's bottom edge, chip borders at rest, and the borders of the consent banner and services panel.
- **Ink** (`ink`): body and heading text, the active chip fill, the footer ground and the hero's fallback ground. The hero scrim is Ink at 64% opacity.
- **Soft Ink** (`ink-soft`): secondary text, such as sublines, captions, list metadata, "(zorunlu / isteğe bağlı)" markers and the uppercase labels.

### Feedback
- **Error Red** (`error`) on **Error Wash** (`error-soft`): used only for form validation. It colours the invalid field border and the error summary box.

### Named Rules

**The One Green Rule.** Action Green is the only green on the page outside the logo. The logo's own greens live inside the logo image and are never used as UI colour. Two such tokens are declared in the stylesheet and unused: `--color-brand` (#009444) and `--color-leaf` (#39b54a). No UI fill, border, icon or text uses them.

**The Photo Brings the Warmth Rule.** No wood textures, beige gradients or tinted section washes. Warmth comes from the photographs on a paper ground.

## Typography

**Display Font:** Montserrat (self-hosted woff2, static 600, the only weight the type system uses), with ui-sans-serif / system-ui as fallbacks
**Body Font:** Source Sans 3 (self-hosted variable woff2, weights 400–600), with ui-sans-serif / system-ui as fallbacks

**Character:** Montserrat is the brand's own face. At 600 weight it gives headings, nav and buttons a firm, tradesman-like voice. Source Sans 3 keeps long Turkish text quiet and readable at a 17px base.

### Hierarchy
- **Display** (600, clamp 2.1→3.6rem, 1.08): the hero H1 only, in white over the scrim. It is capped at 22ch so it stays at two lines or fewer on desktop.
- **Headline** (600, clamp 2→3rem, 1.15, tight tracking): the H1 of inner pages (contact, search, 404, content pages).
- **Title** (600, clamp 1.75→2.5rem, 1.15): homepage section H2s. Closing bands use a 1.5→1.85rem H2. Card and list titles step down to 1.05–1.25rem, still in Montserrat 600.
- **Body** (400, 17px, 1.6): all running text. Prose is capped at 52–65ch. Sublines and metadata use Soft Ink.
- **Button** (600, 0.98rem): every button. Nav links use 0.95rem in the same face and weight.
- **Label** (600, 0.875rem, 0.025em tracking, uppercase, Soft Ink): only when the label *is* the heading or the term itself. It appears on footer column heads, contact-page section heads and fact-list terms on the about page. It never sits above another heading.

### Named Rules

**The Two Faces Rule.** Montserrat is for anything you navigate or press, and for headings. Source Sans 3 is for anything you read. Headings are always weight 600, balanced (`text-wrap: balance`), and slightly tightened.

**The No Kicker Rule.** No small uppercase line sits above a headline. A heading speaks for itself.

## Layout

The page is a single centred column with a 1280px maximum width. Side gutters are 16px, rising to 24px from the `md` breakpoint (768px). Every section uses this same container. Homepage sections are separated by 64px of vertical padding, rising to 96px at `md`. A section head puts its title on the left and an optional "see all" text link on the right, aligned at the bottom.

- **Hero:** full-bleed photo. On mobile it fills the viewport minus the 4.5rem header (`100svh`, minimum 30rem). On desktop it is 78vh, capped at 56rem. The text block is anchored bottom-left inside the container. The image focal point sits low (50% 85%), so the work surface stays in frame.
- **Grids:** category photo grid is 2 columns on mobile and 3 at `lg`, with a 4:3 crop. The project grid is 1 / 2 / 3 columns. The gallery is a masonry layout whose column distribution is computed from known aspect ratios.
- **Lists:** process steps, references, wood types, guide indexes and image facts are hairline lists. Rows are separated by `line` rules, with a top rule to open the list. On mobile a 5-column process strip becomes stacked rows. On mobile a wide table becomes stacked definition lists.
- **Chips:** the filter row scrolls horizontally on mobile (bleeding to the screen edge) and wraps from `md`.
- **Mobile chrome:** below `lg` (1024px), a fixed bottom action bar appears. The footer adds bottom padding so the action bar never covers content.
- **Logical properties throughout** (`ms`/`me`, `start`/`end`, `rtl:rotate-180` on directional arrows), so the layout is ready for Arabic RTL.

**The Closing Band Rule.** Every category page, the references page and the projects index ends with a full-width Mist band containing a heading, one line of text, an optional service-area line, WhatsApp and "Teklif al". When the band is the last thing in `<main>`, the footer drops its top margin so the band sits directly on the footer. Project pages close with the same WhatsApp + "Teklif al" pair inline.

## Elevation & Depth

The system is flat. Depth comes from photographs, Ink surfaces (footer, hero fallback, lightbox) and hairlines, not from shadows. One soft, diffuse shadow exists, and only on things that float above the page: the services dropdown, the consent banner and the lightbox controls. The mobile action bar uses an upward variant of the same softness. Nothing at rest in the page flow has a shadow.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 8px 24px -8px rgb(29 31 28 / 0.28), 0 2px 6px -2px rgb(29 31 28 / 0.16)`): the services dropdown, the consent banner and the lightbox round controls.
- **Bar lift** (`box-shadow: 0 -6px 20px -12px rgb(29 31 28 / 0.35)`): the fixed mobile action bar only.

### Named Rules

**The Float Only Rule.** A shadow means "this is above the page and will go away". Section content, photos, list rows and in-flow buttons never carry one. Shadows are always soft and diffuse, never hard-offset.

**The Functional Scrim Rule.** The hero's bottom scrim is the only gradient in the system. It runs from Ink at 0.64 to transparent and is anchored behind the text block, not the whole section. It keeps white text at AA or better over any photo, including bright patches and the watermark, and fades out over 6rem above the H1. It exists for legibility, not decoration.

## Shapes

Corners are gently rounded and consistent. Photos and controls (buttons, inputs, the consent banner, the services panel) share a 10px radius, so an image and the button under it read as one family. Pills (fully round) appear only on gallery filter chips and on the lightbox's round 48px controls. Borders are 1px. Outline buttons and inputs use Ink at 20–25% opacity. Hairlines and resting chips use `line`. Photos are never framed, bordered or tilted. Icons come from one stroke set (lucide) at a 1.75 stroke width, sized 18–26px.

## Components

### Buttons
- **Character:** solid and plain, with a 48px minimum height and the label in Montserrat 600. An optional leading lucide icon sits 8px from the label.
- **Primary / WhatsApp:** Action Green with white text. The WhatsApp variant leads with the message-circle icon and carries a prefilled, page-specific message. When no mobile number is configured, the WhatsApp button renders nothing.
- **Outline ("Teklif al", secondary):** Paper fill, ink text and a 1px Ink-at-20% border. On hover the border darkens to 40% and the fill turns Mist.
- **On photo:** used only on the hero. It has a white 70% border, a white 10% fill and white text, turning to a 20% fill on hover. It pairs with the WhatsApp button as "Teklif al".
- **Quiet:** an Action Green text link with no side padding, so it aligns with the column edge. It underlines on hover and is used for "see all" links with a trailing arrow.
- **Hover:** a 150ms colour transition only.
- **Focus:** one global two-tone ring on `:focus-visible`: a 2px white inner ring (`box-shadow: 0 0 0 2px #fff`) inside a 3px Ink outer ring (`outline: 3px solid ink; outline-offset: 2px`). One of the two rings holds at least 3:1 against any ground: paper, the dark footer, the hero photo and the lightbox stage. Text fields use the same ring and also turn their border Action Green. A visually hidden control shows the ring on its visible label (`peer-focus-visible:focus-ring`).

### Chips (gallery filters)
- **Style:** pill, 44px minimum height, Montserrat 600 at 0.875rem, single line.
- **State:** at rest, a Paper fill with a hairline border, darkening on hover. When active, an Ink fill with Paper text, marked with `aria-current="page"`. Chips are plain links with shareable query URLs (`?kategori=`). On the homepage they link into `/galeri`.

### Cards / Containers
- **There are no cards.** A grid item is a 4:3 photo with a 10px radius, a Montserrat title below it that turns Action Green on hover, and a line of Soft Ink metadata. There is no box, background or shadow around the item.
- **Hairline lists** replace card grids wherever content is text: references, process steps, guides, wood types and image facts.

### Inputs / Fields
- **Style:** white fill, 1px Ink-at-25% border, 10px radius, 12×14px padding, 16px text. Placeholders use Soft Ink.
- **Labels:** Montserrat label text followed by "(zorunlu)" or "(isteğe bağlı)" in Source Sans Soft Ink. Every field states which one it is.
- **Focus:** the border turns Action Green, and the global two-tone focus ring applies.
- **Error:** the border turns Error Red. An error summary box on Error Wash appears, and focus moves to the first invalid field.
- **Consent:** a required checkbox (accent Action Green) whose label links to the KVKK notice and names the processors (Cloudflare, Resend, Google).

### Navigation
- **Header:** sticky, 4.5rem tall, Paper with a hairline bottom border. The logo sits on the left. The links are Montserrat 600 at 0.95rem in ink and turn Action Green on hover. Hizmetler opens a two-column services panel on hover or focus that works without JS. On the right are the phone number (the number shows from `xl`, an icon below that) and the TR / EN switch.
- **Mobile menu:** a full panel. Services sit in a disclosure, the links are 48px rows, and focus is trapped while it is open. WhatsApp and "Teklif al" are pinned to the bottom edge of the panel.
- **Mobile action bar:** three equal cells (WhatsApp · Ara · Teklif al), each 56px tall with an icon over a label. WhatsApp is the only filled cell, in Action Green. It is mounted once in the locale layout, so it is identical on every template. It hides from `lg` up.

### Hero
A full-bleed photo with the H1, a one-sentence subline and two buttons (WhatsApp + on-photo "Teklif al") anchored bottom-left above the Functional Scrim. **Motion:** the system's single authored moment. The photo settles from scale 1.04 over 1.8s, and the scrim fades up from 0.8 opacity over 1.2s. Both use `cubic-bezier(0.16, 1, 0.3, 1)`. The image is visible from the first frame. The motion is CSS only and is disabled under `prefers-reduced-motion`. No slider and no autoplay.

### Lightbox
A native modal `<dialog>` on a near-black stage (#141513) with an 80% black backdrop. Across the top, an "n / N" counter in tabular Montserrat sits opposite the close button. The photo is centred with `object-contain` and a 10px radius. Below it are the title, an optional caption in white at 80%, and underlined links to the category and to the image's own page. The controls are 48px round buttons in black at 45% with the Float shadow. On desktop, prev/next sit at the sides. On mobile they sit under the caption, and swipe works. The URL follows the open image. Esc closes the dialog, and focus returns to the card that opened it.

### Consent Banner
A floating Paper panel with a 10px radius, a hairline border and the Float shadow. On mobile it sits above the action bar. On desktop it sits bottom-right at 28rem wide. **Reddet** and **Kabul et** are two identical outline buttons in a 50/50 grid: equal weight, with no nudge toward acceptance.

### Empty States
An empty result always offers a way forward. No search results and the 404 page show popular-category chips. An empty guide index shows a WhatsApp button.

## Do's and Don'ts

### Do:
- **Do** let a real job photo lead every work section. Use a 4:3 crop in grids, `object-contain` in the lightbox, and a 10px radius everywhere.
- **Do** reserve Action Green for things that act: buttons, links, the WhatsApp cell and selection. Focus uses the two-tone ink/white ring, not green.
- **Do** pair WhatsApp (solid green) with "Teklif al" (outline) wherever a page asks for contact, and end category, references and project pages with that pair.
- **Do** keep the hero H1 at two lines or fewer on desktop, followed by one sentence of subline, with the scrim anchored behind the text block.
- **Do** use hairline lists (`line`, 1px) for text-led collections.
- **Do** keep every tap target at 44px or more (48px for buttons and menu rows), and write layout with logical properties.
- **Do** give every empty state a next step: chips to categories, or a WhatsApp button.
- **Do** mark every form field "zorunlu" or "isteğe bağlı", and name the data processors in the consent label.
- **Do** keep motion to the hero settle. Everything else is an instant or 150ms colour change, and all of it stops under reduced motion.

### Don't:
- **Don't** add eyebrow or kicker labels above headings. Uppercase labels are allowed only when they are the heading or the term itself.
- **Don't** use decorative gradients. The hero scrim is the one gradient, and it exists for legibility.
- **Don't** use glass: no `backdrop-filter`, no frosted panels.
- **Don't** use hard (zero-blur) offset shadows. Don't put a shadow on anything in the page flow; Float is for floating elements only.
- **Don't** build icon-card grids or boxed cards. Use photos for work and hairline lists for text.
- **Don't** mix icon sets or use glyph or emoji icons. Use lucide only, with a 1.75 stroke.
- **Don't** use the logo greens (#009444, #39b54a) in UI, and don't add a second accent colour.
- **Don't** use sliders, autoplay, carousels or stock or illustrated imagery.
- **Don't** nudge consent: Reddet and Kabul et always look identical.
