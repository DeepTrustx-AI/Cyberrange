---
name: CyberRange
description: Real machines, real grading. A calm, premium cyber range where progress is a clay cube you build one block at a time.
colors:
  canvas: "oklch(0.968 0.008 85)"
  surface: "#FFFFFF"
  paper: "oklch(0.988 0.006 85)"
  line: "oklch(0.93 0.01 80)"
  line-cool: "oklch(0.865 0.014 255)"
  ink-faint: "oklch(0.64 0.02 255)"
  ink-muted: "oklch(0.53 0.022 255)"
  ink-soft: "oklch(0.44 0.024 255)"
  ink: "oklch(0.21 0.024 255)"
  ink-deep: "oklch(0.165 0.02 255)"
  brand-ink: "oklch(0.27 0.03 265)"
  brand-ink-hover: "oklch(0.22 0.028 265)"
  brand-ink-side: "oklch(0.19 0.024 265)"
  brand-focus: "oklch(0.45 0.03 264)"
  brand-ink-light: "oklch(0.62 0.02 262)"
  peach-50: "oklch(0.978 0.012 65)"
  peach-100: "oklch(0.952 0.026 62)"
  peach-200: "oklch(0.905 0.05 58)"
  peach-300: "oklch(0.82 0.07 55)"
  mint-50: "oklch(0.978 0.02 168)"
  mint-500: "oklch(0.71 0.14 168)"
  mint-700: "oklch(0.5 0.1 168)"
  ember-espresso: "oklch(0.17 0.01 58)"
  ember-surface: "oklch(0.215 0.012 58)"
  ember-line: "oklch(0.28 0.013 58)"
  ember-muted: "oklch(0.68 0.014 65)"
  ember-cream: "oklch(0.94 0.008 80)"
  apricot: "oklch(0.8 0.12 70)"
  apricot-deep: "oklch(0.74 0.15 62)"
  ember-button: "oklch(0.56 0.155 40)"
  ember-button-hover: "oklch(0.5 0.145 38)"
  ember-side: "oklch(0.42 0.12 38)"
  clay-cream: "#F6F1E9"
  clay-peach: "#F6C6A6"
  clay-mint: "#9BE3C8"
  clay-butter: "#FFE08A"
  clay-sky: "#B7DCF5"
  clay-blush: "#F7C9D6"
  clay-ink: "#2A2F3D"
  clay-slot-line: "#A8927A"
  clay-slot-line-ember: "#E9DCCB"
  clay-plinth: "#F2E9DC"
  clay-plinth-ember: "#3A3029"
  mascot-top: "oklch(0.487 0.024 263)"
  mascot-front: "oklch(0.27 0.03 265)"
  mascot-side: "oklch(0.19 0.024 265)"
  mascot-top-ember: "oklch(0.728 0.131 61)"
  mascot-front-ember: "oklch(0.56 0.155 40)"
  mascot-side-ember: "oklch(0.42 0.12 38)"
  mascot-cheek: "#FF8EA6"
  mascot-mouth: "#FFE7D1"
  mascot-mouth-ember: "#3B1C0E"
  mascot-pupil: "#10131A"
  terminal-canvas: "#0C0E14"
typography:
  display:
    fontFamily: "Figtree, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  cover:
    fontFamily: "Figtree, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.4rem"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Figtree, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Figtree, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  section:
    fontFamily: "Figtree, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.02em"
  stat:
    fontFamily: "Figtree, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
    fontFeature: "\"tnum\""
  score:
    fontFamily: "Figtree, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\""
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
    fontFeature: "\"cv11\", \"ss01\", \"ss03\""
  ui:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.43
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, Cascadia Code, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
rounded:
  block: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "22px"
  3xl: "28px"
  stage: "32px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "12px"
  lg: "20px"
  xl: "24px"
  2xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.brand-ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "10px 20px"
    typography: "{typography.ui}"
  button-primary-hover:
    backgroundColor: "{colors.brand-ink-hover}"
  button-primary-dark:
    backgroundColor: "{colors.ember-button}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  button-ghost:
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.full}"
    padding: "10px 16px"
  button-auth:
    backgroundColor: "{colors.brand-ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    height: "48px"
    padding: "0 20px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    height: "48px"
    padding: "0 16px"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: "40px"
  nav-item:
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.xl}"
    padding: "10px 12px"
    typography: "{typography.ui}"
  nav-item-active:
    backgroundColor: "{colors.peach-100}"
    textColor: "{colors.ink}"
  filter-chip:
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.full}"
    padding: "6px 14px"
  filter-chip-selected:
    backgroundColor: "{colors.brand-ink}"
    textColor: "{colors.surface}"
  status-pill-complete:
    backgroundColor: "{colors.mint-50}"
    textColor: "{colors.mint-700}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  status-pill-neutral:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.3xl}"
    padding: "20px"
  card-lifted:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  stat-chip:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: "12px 16px"
  hero-stage:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.stage}"
    padding: "40px"
  level-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: "16px"
    width: "256px"
  grading-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.3xl}"
    padding: "20px"
  celebration-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.stage}"
    padding: "72px 28px 28px"
    width: "384px"
  reward-chip:
    rounded: "{rounded.full}"
    padding: "6px 12px"
    typography: "{typography.label}"
  segmented-bar:
    backgroundColor: "{colors.line}"
    rounded: "{rounded.full}"
    height: "6px"
  terminal-pane:
    backgroundColor: "{colors.terminal-canvas}"
    rounded: "{rounded.3xl}"
---

# Design System: CyberRange

## Overview

**Creative North Star: "The Clay Range"**

CyberRange is a calm, premium training space where a student's progress is a physical clay object they can see. The light theme, Soft Daylight, is warm white paper under slate ink: floating white panels with soft rings sit on a warm canvas, deep ink pills carry every primary action, peach marks what is selected or highlighted, and mint means complete. The dark theme, Ember, swaps in espresso surfaces, cream text and an apricot accent at the same lightness steps, so every pairing keeps its contrast. Both themes are first-class.

The signature is the CyberRange cube in clay. On the sign-in cover it is the logo: 27 pastel blocks that tumble in and assemble, hold, break apart and rejoin on a loop. On the dashboard it is the student's own progress: one clay block for every module they have cleared, with the blocks still to earn drawn as crisp clay-ink outlines, so the cube to build reads as a shape. The clay lab illustrations come from the same 3D kit (one material, one light rig, one tone mapping), so a lab looks the same wherever it appears. Beside the clay sits one deliberate second medium: the cube mascot, a flat-shaded vector toy version of the logo cube that does the waiting and the cheering in a fixed set of places, and never over the terminal.

Colour is held back in the interface chrome and given to the clay. Everything else is neutral, crisp and quiet enough for long sessions beside a live terminal. The category standard executed at full craft, not a costume: no neon hacker terminal, no gradient welcome banner over stat tiles, no purple or violet anywhere (the user rejected purple, lavender, indigo-on-grey and lagoon blue-green during the palette rounds), and no visual built from the lab list, because labs come and go.

**Key Characteristics:**
- Warm canvas, white floating panels with hairline rings, deep ink pill buttons.
- Peach is the selected and highlight tint; mint is completion; apricot is Ember's accent.
- The clay cube is the signature: the logo on the cover, the student's progress on the dashboard.
- One 3D kit renders the cube and every lab illustration.
- The cube mascot is the only illustrated character, in the logo's three tones, in seven allowed places.
- Every number in the game layer comes from real data.
- Figtree display, Inter UI with tabular numerals, JetBrains Mono for code and the terminal.
- Large soft radii (22 to 32px on containers), pills for actions and chips; diffuse cool shadows.

## Colors

Warm-to-slate neutrals with a single ink brand whose light end turns peach, mint for success, a pastel clay palette for 3D objects, and a mascot palette derived from the logo.

### Primary
- **Slate Ink** (brand-ink): every primary action in light: Start lab, Sign in, Next challenge, selected filter chips. Hover steps to **Deepest Ink** (brand-ink-hover). White text on it is about 14:1. It is also the logo's front face.
- **Muted Ink** (brand-focus): focus outlines, input focus borders and the 15% focus ring.
- **Logo tones** (brand-ink-light, brand-ink, brand-ink-side): the three faces of the logo mark, top, front and side. In Ember the same tokens turn apricot, burnt orange and rust, so the mark follows the theme.
- **Peach** (peach-50 to peach-300): the light end of the brand ramp. Peach-100 fills the active sidebar item; peach-50 marks the selected challenge in the workspace rail and the "Up next" module; peach-200 is the text-selection colour; peach-300 is the drawn highlight under the cover headline and the student's name on the dashboard, a clear step above the hero panels' peach glow.

### Secondary
- **Mint** (mint-500, mint-700, mint-50): completion and success only. Finished segmented bars turn mint-500 and end in a mint check; "Complete" pills are mint-700 on mint-50; cleared challenges in the rail get a mint-500 disc; passed checks tick in mint.

### Tertiary (Ember accent)
- **Apricot** (apricot, apricot-deep): Ember's accent. Links, the highlighted name, active icons and focus rings in dark use apricot; filled segments, selected chips and celebration buttons use apricot-deep with espresso text.
- **Ember Burnt Orange** (ember-button, ember-button-hover): primary pill buttons in dark (white text 5.0:1).

### Neutral
- **Warm Canvas** (canvas): the app background behind the floating sidebar and pages; the sticky header is the same colour at 80% with a backdrop blur.
- **White** (surface): panels, cards, sidebar, inputs, menus, the grading and celebration cards.
- **Paper** (paper): sunken wells, stat boxes inside panels, the hero-stage base under the wash.
- **Warm Line** (line): dividers, input borders, empty bar segments, card rings at 70%.
- **Cool Line** (line-cool): scrollbar thumbs and unchecked check circles.
- **Faint / Muted / Soft Ink** (ink-faint, ink-muted, ink-soft): placeholders and inactive icons; secondary text (5.1:1 on white); nav labels and secondary buttons.
- **Ink / Deep Ink** (ink, ink-deep): headings and body text; the darkest overlays.
- **Ember neutrals** (ember-espresso, ember-surface, ember-line, ember-muted, ember-cream): the same roles in dark. Espresso is the canvas, ember-surface the panels, ember-line the rings and dividers, ember-muted secondary text (5.6:1), ember-cream primary text.
- **Terminal Night** (terminal-canvas): the terminal and the in-pane code editor, in both themes. Code always sits on this near-black.

### Clay (3D materials and clay accents)
- **Clay Cream, Peach, Mint, Butter, Sky, Blush** (clay-*): the one palette in `three/clay.ts`, shared by the cube, the lab illustrations, confetti, the loader's ground blocks and the grading line. The logo cube uses all six; earned blocks on the dashboard skip cream, which would vanish into the plinth. **Clay Ink** (clay-ink) draws screens and details inside the illustrations.
- **Slot outline** (clay-slot-line, clay-slot-line-ember): the crisp edges of the blocks still to earn on the dashboard cube, at 42% opacity in light and 34% in Ember, over a whisper of fill.
- **Plinth** (clay-plinth, clay-plinth-ember): the rounded slab the cube stands on.
- These are lighting-dependent materials, not UI fills. Flat UI uses them only as small clay accents: confetti, loader blocks, the peach-to-butter-to-mint gradient of the grading line and the level bar, and the badge and reward-chip tints (peach #FFD9C2 to #F6B48E, butter #FFF0B8 to #FFD866, mint #C9F3E2 to #8DDDBF, sky #D6ECFA to #A5D1F2, blush #FBDCE5 to #F2B3C6, each with its own dark text).

### Mascot
The mascot's colours follow the logo, derived from the brand ramp so it changes with the theme:
- **Top and mittens** (mascot-top, mascot-top-ember): `color-mix(in oklch, brand-400 62%, brand-600)` in light, 70% in Ember. The mittens use the same lighter tone so hands read against the body.
- **Front** (mascot-front, mascot-front-ember): brand-600. Navy ink in light, burnt orange in Ember.
- **Side** (mascot-side, mascot-side-ember): brand-800 at 90%.
- **Limbs**: brand-600 mixed 82% with black.
- **Face**: white sclera and glints, pupils in mascot-pupil, cheeks and tongue in mascot-cheek at 80%, the smile in mascot-mouth (mascot-mouth-ember in dark). The carried block is clay peach.

Status hues outside the token set stay Tailwind defaults with semantic meaning only: rose for errors and failing checks, amber for warnings, "Upcoming" and the near-miss result banner, orange for the streak flame and advanced difficulty.

### Named Rules
**The Colour Lives In The Clay Rule.** Chrome stays neutral and ink. Pastel colour appears in the clay (cube, lab illustrations, confetti, loader blocks, game bars, badges) and the hero washes, and nowhere else at scale.

**The No Violet Rule.** Purple, violet, lavender and indigo are aliased onto the ink brand at the token layer. Never reintroduce them through arbitrary values; shadows are tinted cool slate (hue 230), never violet.

**The Same Steps Rule.** Ember overrides the same token names at the same lightness steps as Soft Daylight. Write one class with a `dark:` partner from the same ramp; never hand-pick a dark hex.

**The Logo Tones Rule.** Anything that stands for the brand (the logo mark, the mascot) takes its colours from brand-400, brand-600 and brand-800, so it turns apricot in Ember on its own.

## Typography

**Display Font:** Figtree (with Inter, system sans fallback)
**Body Font:** Inter (with system sans fallback), stylistic sets cv11, ss01, ss03
**Label/Mono Font:** JetBrains Mono (with Cascadia Code, Consolas)

All three are variable fonts bundled with the app (`@fontsource-variable`), so no font request leaves the site and nothing waits on a font CDN.

**Character:** A friendly geometric display face over a crisp, neutral UI sans. Figtree carries greetings, page titles and numbers; Inter does the work; mono is reserved for code, the terminal, commands and lab ids.

### Hierarchy
- **Cover** (800, 3.4rem, 4rem at xl, line-height 1.02, -0.035em): the sign-in hero headline only, with its drawn peach highlight. 1.875rem on mobile.
- **Display** (800, 3rem from sm, 2.25rem on mobile, line-height 1.05, -0.025em): the dashboard greeting and stage heroes. One per page.
- **Headline** (800, 1.875rem, 2.25rem from sm): the 404 line, "Cleared!", page titles. The auth form title is 1.75rem bold.
- **Title** (600 to 700, 1.25rem to 1.5rem): the next-lab card, lab preview sheet, workspace start state. Lab card titles are 1.125rem.
- **Section** (600, 1rem): headers inside panels (Assigned labs, Badges, Skills, Recent work) and the grading card title.
- **Stat** (700, 1.5rem, tabular): stat chips, streak and week counts; chips count up from zero on load. "Level N" on the level card is the same size at 800.
- **Score** (800, 3rem, tabular): the celebration score, counting up over 900ms.
- **Body** (400, 15px, line-height 1.625): hero, auth and sheet paragraphs; panels use 14px. Long prose holds to `max-w-prose`.
- **UI** (500, 14px): nav items, buttons (semibold for primary), tabs.
- **Label** (500, 12px, sentence case): stat chip labels, status and reward pills, rail headings, hints, timestamps.
- **Mono** (400, 13px): the terminal, the code editor, lab ids in pills, inline commands at 0.9em.

All h1 to h3 use Figtree, -0.02em tracking and balanced wrapping; paragraphs use pretty wrapping. Tables and `.tabular` use tabular numerals.

### Named Rules
**The Sentence Case Label Rule.** Labels are sentence case at 12px or larger. Tiny tracked all-caps labels were removed platform-wide and do not come back.

**The Heavy Is Rare Rule.** Extra-bold (800) belongs to the page's single display or title line and to the game's own moments (the level number, the cleared score). Everything inside panels steps down to bold or semibold.

## Layout

The student shell is a floating sidebar (240px wide, inset 12px, 28px radius, white with a hairline ring) on the warm canvas, with content offset 264px. A sticky 72px header on the canvas holds a pill search field ("/" focuses it), theme toggle, notifications and the account menu. Below 1024px the sidebar becomes a full-height 256px drawer over a 30% ink scrim. Every route change settles in with `page-in`, and the in-layout Suspense shows the mascot loader inside the content area, so the shell never blanks. After a layout settles, the rest of its pages prefetch one at a time in idle time.

Pages stack in a 24px vertical rhythm. **Sign-in** splits at `lg` into a 1.3 : 1 grid: an inset 32px-radius pastel hero panel (logo and wordmark, cover headline, "Hands-on cyber security labs!", the looping clay cube on a stage capped at 460px, three proof facts) and the form column (max 400px) on the warm canvas with the mascot (92px, 76px on phones) perched on the first field. On mobile a short 192px cube band sits above the form. **Dashboard** opens with a full-width 32px-radius hero stage: greeting, lifted next-lab card and three stat chips take the left 46%; the student's cube and the level card fill the right 54% and drop below on small screens (416px tall). Then the today strip (three panels), then assigned labs in a main column beside a 352px rail of badges, skills and recent work. **Lab workspace** is a three-column grid up to 1700px: a 272px challenge rail, the brief pane (Brief / Checks / Attempts tabs, minimum 340px, sticky to the viewport) and the terminal as the hero at about 1.4 times the brief's width, `clamp(460px, 100vh - 196px, 1000px)` tall, with the code editor opening inside the terminal pane.

Panels pad 20 to 24px; stat chips 12 by 16px with 10px gaps; list rows 14 by 24px.

### Named Rules
**The Terminal Is Sacred Rule.** Nothing overlays the terminal. The grading card docks at the foot of the brief pane and the celebration sits over the brief column on wide screens; below `xl`, where the panes stack, they float at the viewport edge instead.

## Elevation & Depth

A hybrid: surfaces separate from the canvas mainly by tone and a hairline ring (line at 70%, or ink at 5%), with soft, cool-tinted, diffuse shadows layered on top. The shadows are two-part (a tight contact shadow plus a wide negative-spread ambient one) tinted slate at hue 230. Real depth belongs to the clay: physical clay material, a warm key light from the top left with soft 2048px shadows, a rim light and a blurred room environment. Behind every page, three blurred colour fields (peach, mint, butter; apricot and mint embers in Ember) drift on 46 to 58 second loops.

### Shadow Vocabulary
- **xs** (`0 1px 2px oklch(0.3 0.04 230 / 0.06)`): inputs, secondary buttons, pills over art.
- **sm** (`0 1px 2px oklch(0.3 0.04 230 / 0.05), 0 4px 12px -2px oklch(0.3 0.04 230 / 0.07)`): resting cards, panels, the sidebar.
- **md** (`0 2px 4px oklch(0.3 0.04 230 / 0.04), 0 12px 28px -6px oklch(0.3 0.04 230 / 0.12)`): primary pills, tinted brand at 20%.
- **lg** (`0 4px 8px oklch(0.3 0.04 230 / 0.04), 0 22px 44px -12px oklch(0.3 0.04 230 / 0.16)`): hovered catalogue rows.
- **xl** (`0 8px 16px oklch(0.3 0.04 230 / 0.05), 0 32px 64px -16px oklch(0.3 0.04 230 / 0.2)`): menus, the lifted next-lab card and level card (at 5% ink tint).
- **2xl** (`0 12px 24px oklch(0.3 0.04 230 / 0.06), 0 44px 88px -20px oklch(0.3 0.04 230 / 0.26)`): the lab preview sheet and the celebration card.

### Named Rules
**The Lift On Intent Rule.** Cards rest at sm. On hover they rise 2 to 4px and deepen their shadow over 300ms. Lifted cards on a hero stage are translucent white (85 to 90%) with a backdrop blur.

## Shapes

Soft and rounded throughout. Actions, chips, pills, search, reward chips and progress bars are full pills. Containers step up with their role: 8px for menu items, 12px for small tiles and skeletons, 16px for inputs, nav items, rail items and thumbnail wells, 22px for lifted cards, stat chips, the level card and badges, 28px for cards, panels, the grading card and the sidebar, 32px for hero stages, the auth panel, the preview sheet and the celebration card. The loader's ground blocks are 20 by 10px at 4px radius.

The cube is the recurring silhouette. The logo mark is one isometric block in three brand faces; the clay cube is a 3 by 3 by 3 stack of rounded blocks (0.94 units, 0.16 corner radius) on a rounded plinth; the mascot is the same cube softened into a squishy body.

## Components

### Buttons
- **Shape:** full pill (9999px).
- **Primary:** slate ink fill, white semibold 14px text, 10 by 20px, md shadow tinted brand at 20%, often a filled play icon. Hover steps to deepest ink. In Ember the same class renders burnt orange; celebration and 404 buttons use apricot-deep with espresso text.
- **Secondary:** white with a warm-line border and xs shadow, soft-ink text, hover to paper.
- **Ghost:** text only, hover fills canvas-tinted grey.
- **Auth:** full-width 48px pills (primary and secondary) at 15px.
- **Press:** every enabled button scales to 0.97 while pressed (150ms).

### Chips
- **Filter chips:** 13px pills, soft-ink text, hover canvas; selected is slate ink with white text (apricot-deep with dark text in Ember). They expose `aria-pressed`.
- **Status pills:** 12px medium on a tint: mint for complete, amber for upcoming, peach-50 for in progress, canvas for not started.
- **Difficulty pills:** white 85% with blur over card art, a 6px dot plus coloured text (mint, amber, orange, rose by level).
- **Reward chips:** 12px semibold pills on the clay tints: "+1 block for your cube" (peach, with a tiny clay block), "First try" (butter, bolt), "Combo ×N" (mint, flame). They pop in one by one.

### Cards / Containers
- **Corner Style:** 28px (cards and panels), 22px (lifted and stat chips), 32px (stages and sheets).
- **Background:** white; ember-surface in dark.
- **Shadow Strategy:** sm at rest, deeper on hover (see Elevation).
- **Border:** a 1px ring at line/70%, ember-line in dark.
- **Internal Padding:** 20 to 24px.

### Inputs / Fields
- **Style:** white, 1px warm-line border, 16px radius, 48px tall in auth, xs shadow, 15px text, faint-ink placeholder.
- **Focus:** border to muted ink plus a 3px ring at 15%. Global focus is a 2px outline offset 2px (inputs offset 0) in muted ink, apricot in Ember.
- **Error / Disabled:** errors in a rose box at 16px radius; disabled fields go to paper.

### Navigation
- **Style:** floating sidebar, sentence-case group labels at 12px, 14px medium items with 18px stroke icons, 16px radius.
- **States:** hover fills canvas; active fills peach-100 with ink text (apricot at 15% in Ember). The account block sits in a paper well with a peach initials avatar.
- **Mobile:** off-canvas drawer with a scrim, opened from the header menu button.
- **Workspace tabs:** Brief / Checks / Attempts are underline tabs, a 2px ink border on the selected one (apricot in Ember).

### Clay Cube (signature)
`ClayCube` renders the CyberRange cube from the shared 3D kit in an orthographic isometric view, on a rounded plinth with a soft blob shadow. 27 blocks make one cube (`CUBE_BLOCKS`), built bottom layer first from the corner nearest the camera.
- **Logo mode (sign-in).** All 27 blocks in the six clay colours start scattered on a wide shell, tumble in and snap into place layer by layer, and the finished cube lands with a soft squash. With `loop` it then holds for 4.4s, breaks apart sideways (blocks only ever rise, so nothing sinks into the plate), floats, glides back staggered without overshoot (so no block passes through another) and squashes again, about a 7 second cycle. While whole it breathes and one top-layer block hops every few seconds; only top-layer blocks hop, since a lower block would jump into the one above it. The cube turns gently toward the pointer.
- **Progress mode (dashboard).** One clay block per module cleared in the current level, in five colours (no cream). The blocks still to earn are crisp clay-ink outlines with a whisper of fill. Blocks placed since this browser's last visit drop in one after another. Hovering the cube lifts the level card.
- Rendering pauses off screen and in hidden tabs. Under reduced motion the cube renders still and whole. Without WebGL the canvas is omitted and the level card carries the numbers alone.
- It is drawn in a worker on an OffscreenCanvas where the browser allows it (`ClayCube` hosts, `cubeWorker` runs `cubeScene`), so creating the context and compiling shaders never freezes the page; elsewhere, or if the worker does not start within 5 s, it draws on the page. Nothing shows until every shader is compiled; then the canvas fades in and the assembly plays from its first block. The sign-in page mounts one cube only (the hero's on wide screens, the band's on narrow ones), and the dashboard builds its cube once the counts are loaded.

### Clay rendering
All scenes share `three/world/kit.ts`: physical clay material (roughness about 0.58, clearcoat 0.25, white sheen 0.4), five-segment rounded boxes, neutral tone mapping so the pastels keep the CSS hues, a blurred room environment (0.55 intensity, 0.32 in Ember), a hemisphere fill, one warm key light from the top left with 2048px PCF shadows, and a rim light. The room environment is built once per renderer, and every shader is compiled in parallel (`compileInParallel`, KHR_parallel_shader_compile) before first use, so no clay scene blocks the page while it compiles. Ember lowers the environment and warms the key.

### Clay Lab Illustration (signature)
Each lab shows its own clay scene from `dioramas.ts` on a shared plinth, camera and light rig, rendered ahead of time into a WebP image per kind and theme (`npm run render:lab-art`, into `src/assets/lab-art/`; a kind with no image yet renders in the browser) and shown through `LabCardMedia` over a soft gradient per lab family (peach Linux, mint cloud, butter crypto and puzzle, grey-blue recon, blush OT). While a card is hovered, in the lab preview sheet and in the workspace start state, `LabScene` swaps the image for a live canvas (`LiveDiorama`) on its first frame, which matches the still exactly, and keeps the still hidden while the live scene plays its idle motion (LEDs blink, the train runs, water drips) and turns toward the pointer, so no second copy ever shows behind it. A flat SVG version shows while it renders or without WebGL. Completed labs carry a mint "Complete" stamp that lands with `stamp-in`.

### Cube Mascot (character)
`Mascot` is the logo cube as a soft toy: a flat-shaded vector body with a light top, front and darker right side, a radial shine, a centred face (big eyes with glints, blush cheeks, a small smile), mitten arms and stubby legs, on a soft ground shadow. Each arm is the colour of the face it grows from (front on the left, the shaded side on the right) and tapers from inside the body, and arms and mittens take the body's top-left light, so they read as the same soft cube. Navy ink in light, apricot in Ember (see Colors). It is drawn in SVG on purpose, as a second medium beside the clay, and is sized 44 to 136px.
- **Poses:** idle (breathes and blinks), wave, walk, carry (balances a clay block on its head), cheer (hops with arms up, happy eyes, open mouth), think (looks up, scratches its head), cover (hands over eyes), peek (one hand lowered), sleep (closed eyes, drifting z's), sway (rocks and hums, notes drifting up). The eyes can follow a look target, and the face shifts a little after them so it seems to turn its head.
- **Seated:** perched on an edge, the seat line at 92/120 of its height (`MASCOT_SEAT`) lined up with the edge. Its hands rest on the edge and its legs hang over the front and swing, one a beat behind the other, slower when asleep and faster when it sways.
- **Interactive** (a toy, never needed to use the page): a tap squashes it and pops a heart; five taps in 2.5s make it dizzy (spiral eyes, a wobble). Pressing and dragging picks it up: it hangs from the pointer, swings with the motion and kicks its legs, and when let go springs back to its seat with a bounce. Only the body and arms take the pointer, so dangling legs never block a field. The spring runs on requestAnimationFrame only while it moves.
- **Allowed places, and only these:** the page and in-layout loader (carry, walking a row of clay blocks that slides beneath it; also while a lab machine starts); perched on the sign-in form's first field (hops on, waves hello, follows the pointer and the email as it is typed, covers its eyes on the password and peeks when it is shown, scratches its head at an error; left alone it waves, sways or wonders every 6 to 12 seconds, and naps after 30 seconds until you move; rides along when the field moves); the grading card (walks the progress line, cheers on a pass, thinks on a miss); the cleared celebration (cheers on top of the card); empty states; the dashboard level card (seated on its top edge, idle, cheering when new blocks arrived); the 404 page (thinks).
- **Reduced motion** stops every mascot loop; poses still change, so it reacts without moving.

### Lab Workspace
A compact sticky header (challenge position and title, cleared count bar, workspace status with minutes left, end), the challenge rail (cleared challenges get a mint disc, the selected one a peach-50 fill), the brief pane and the terminal. Before a machine exists the terminal column shows a wash panel with the live lab scene and a start button; while it starts, the mascot carries a block over the loader ground. Under the terminal a status bar names what the grader is doing. The in-pane code editor (CodeMirror on terminal night, JetBrains Mono 13px) replaces the terminal view until the student goes back.
- **Checks:** a paper summary box (pass mark or last score, "N of M checks pass"), then one row per criterion that ticks in mint or crosses in rose with its feedback, staggered 60ms; skeleton circles while checking.
- **Attempts:** one row per submission with a status dot, "Attempt #N · time ago" and the score.
- **Result banner:** mint for a pass with a Next challenge pill, amber for a miss with "See what failed".
- **Grading card:** rises in at the foot of the brief pane. Title and the grader's real step (Sending your work, Waiting in the queue, Checking your machine), a time estimate only when this student has grading history, and an 8px line in the clay gradient that the walking mascot follows. The line eases toward 92% and only finishes when the result lands, ending at a check that turns mint on a pass.
- **Cleared celebration:** a 32px-radius card over the brief column, the cheering mascot on top in a burst of clay pieces, clay confetti falling across the screen, "Cleared!", the score counting up, the reward chips, course progress as a segmented bar with "N to go", and Stay here / Next challenge. It takes focus from the terminal and closes on Escape.

### Dashboard game layer
- **Next lab card:** lifted translucent card with the lab's clay thumbnail, its segmented bar and a Start or Continue pill.
- **Stat chips:** Modules cleared, Streak (Global rank when the student has a score), Labs complete "of N", each counting up.
- **Level card:** "Level N", "x/27 blocks", a level bar in the clay gradient and the blocks to the next level; it carries the mascot on its top edge and a "+N new blocks since your last visit" line when true.
- **Level up:** when the blocks earned since the last visit finish a cube, the card first reads "Your new blocks finish this cube" at 27/27 while the last blocks land; the full cube then spins once with a hop and a warm glow, clay confetti falls, the mascot cheers and the card stamps in "Level up! Cube N is complete" with the new level; the old cube lifts away and the next level's outlines and blocks arrive. It plays once (the seen count is stored) and goes straight to the end state under reduced motion. In development, `/dashboard?preview=levelup` plays it on demand.
- **Today strip:** next deadline, the streak with a flickering flame and a seven-day week strip, and graded submissions this week.
- **Badge shelf:** eight badges in a 4-column grid of 56px clay-tinted tiles; locked ones are grey with a lock. Newly earned badges shine once and carry a "New" tag. Each has a tooltip with its rule.
- **Skills and Recent work:** per-area module bars; the latest graded attempts, cleared or tried, with scores.

### Segmented Bar (signature)
One 6px pill segment per module with 3px gaps, so "3 of 5" reads at a glance. Filled segments sweep in 70ms apart in slate ink (apricot-deep in Ember); empty ones are line. When every module is done all segments turn mint and a small mint check ticks in. Above 24 modules it falls back to one continuous bar. Always a `progressbar` with a label.

### Lab Preview Sheet
Clicking a lab card opens a right-hand sheet that slides in (`sheet-in`): the live scene, the summary, area / modules / time, every module in order with cleared ones ticked and the next one marked "Up next" on peach, and the launch or buy action in the footer. Escape and the backdrop close it.

### Empty States and Loading
Empty lists use `EmptyState`: a wash panel with the mascot or a small clay scene, one line on why it is empty and the next step. Loading content shows shimmer skeletons shaped like what is coming; route and lazy loads show the mascot loader after a 180ms delay so quick loads never flash.

### Motion
One easing carries the system: `ease-out-expo` (cubic-bezier(0.16, 1, 0.3, 1)); celebratory pops use a springy cubic-bezier(0.34, 1.56, 0.64, 1).
- **page-in** (0.38s, 8px rise and fade): every route change.
- **rise-in** (0.5s, 6px): hero copy, card and stat rows at 0, 120 and 240ms (160ms for the cover facts); result banners; menus.
- **fade-in** (0.2s): scrims, loaders, the code editor.
- **sheet-in** (0.36s, 28px from the right): side sheets. **sheet-up** (0.42s, 24px up from 96%): the grading card.
- **celebrate-pop** (0.55s spring): the celebration card. **burst** (1.1s): clay pieces flung from behind the mascot. **confetti-fall** (2.2 to 3.4s): 36 clay pieces. **reward-pop** (0.45s spring, 140ms apart): reward chips.
- **tick-in** (0.45s): check marks, the finished-bar check, "New" tags. **stamp-in** (0.55s with a wobble): the Complete stamp. **segment-fill** (0.5s sweep): bar segments. **shine** (1.6s, once): newly earned badges.
- **skeleton shimmer** (1.4s loop): loading placeholders. **ambient drift** (46, 52 and 58s alternating loops): the background light. **flicker** (1.6s): the streak flame, only when the streak is above zero.
- **hero-mark draw** (0.9s after 0.35s): the peach highlighter wiping in under the cover headline's key words and the student's name in the dashboard greeting.
- **loader ground** (1.3s linear): clay blocks sliding under the walking mascot, with three pulsing dots.
- Count-ups ease out over 900ms; buttons press to 0.97 in 150ms.
- **Reduced motion:** every CSS animation and transition collapses to 0.01ms and one iteration; the mascot's loops stop; count-ups jump to the value; the clay cube and live dioramas render still; confetti and burst pieces are not created.

### Named Rules
**The Honest Game Rule.** Every number in the game layer comes from real data: blocks are cleared modules, levels are 27 blocks, badges unlock from what the student actually did, streaks and weeks come from graded submissions. Nothing is padded or invented.

**The No Guess Rule.** The grading card shows a time estimate only when this student has grading history; without it the line just eases on slowly. The step text is the grader's real status.

**The Earned Reward Rule.** "+1 block" appears only when the challenge was not already cleared, "First try" only when there was no earlier attempt at it, "Combo ×N" only after two or more back-to-back clears in this session. New blocks and new badges animate only for what changed since this browser last looked.

**The Mascot Has Seven Places Rule.** The mascot appears only in the loader, on the sign-in form, on the grading card, on the celebration, in empty states, on the dashboard level card and on the 404 page. It never overlays the terminal and never decorates a panel just to fill space.

## Do's and Don'ts

### Do:
- **Do** use the token ramps (slate, brand, mint) through ordinary utility classes; the aliases make old blue, indigo, emerald and grey classes land on the system.
- **Do** make every primary action a slate ink pill (burnt orange in Ember) and every container a white surface with a hairline ring and a 22 to 32px radius.
- **Do** use peach for selected and highlighted states and mint only for completion.
- **Do** render every 3D object through `three/world/kit.ts` and colour it from `CLAY`, so the cube and every lab scene share one material and light.
- **Do** show module progress with the segmented bar and lab identity with the clay illustration, the same art wherever the lab appears.
- **Do** keep the mascot in its seven places and in the logo's tones, and let it react to real events only.
- **Do** derive every game number from real data and show an estimate only when there is history to base it on.
- **Do** pair every light class with its Ember partner from the same ramp and check AA contrast in both themes.
- **Do** respect reduced motion: CSS animation, mascot loops, count-ups, confetti and the 3D motion all collapse.
- **Do** load with shimmer skeletons shaped like the content, and give every empty list an `EmptyState` with the next step.

### Don't:
- **Don't** use purple, violet, lavender or indigo, or violet-tinted shadows.
- **Don't** put a gradient welcome banner over a row of stat tiles, or dress the product as a neon hacker terminal.
- **Don't** put anything over the terminal: no cards, mascot, confetti targets or overlays in the terminal pane.
- **Don't** build a visual from the lab list; labs come and go, the cube does not.
- **Don't** invent a second character, or draw the mascot in clay or in colours outside the logo tones.
- **Don't** use tiny tracked all-caps labels or labels below 12px; the 10px counts on notification badges are the only smaller text.
- **Don't** use loose flat SVG illustrations as primary art; they are only the fallback for the clay render.
- **Don't** spread pastel fills across chrome; colour belongs to the clay, the family art stages and the washes.

## Known gaps

Authentication provider exception: Google sign-in uses the visible button rendered
by Google Identity Services, configured as outline/large/pill. Google owns the
button's typography and height and limits its width to 400px; the existing auth
secondary-action slot centers it and adapts it to narrow screens. Loading, retry
and verification states use the shared auth secondary-button style. Service
outages use the existing inline error banner and never a credential-error message.

Open items in the shipped build. These are defects or limits the build carries, not rules to copy:
- Catalogue summaries live in the frontend (`src/utils/labCopy.ts`) until the API carries real descriptions; the backend should own them.
- The playground student cart call (`/api/v1/cart`) fails because the playground database predates the `cart_items.item_type` column.
- Assigned-lab progress on the dashboard for grader-backed labs comes from the backend and can read 0/5 while challenges are cleared (the game layer counts those labs from the 50 most recent submissions instead).
- The lab list endpoint can return 503 under heavy local load.

Drift seen in the build and not canonized:
- Earned badges cast a warm clay shadow (`rgba(120,80,40,…)`) outside the cool shadow vocabulary, to sit with the clay world.
