# CyberRange Frontend Theme Contract

## Status

**Binding for all new and changed user-facing frontend work.** This contract
preserves the frontend introduced in PR #46. It applies to student, admin,
authentication, shared, loading, empty, error, and responsive states under
`backup/`.

The full visual source of truth is [DESIGN.md](DESIGN.md). Read it before
designing or changing a frontend surface. [PRODUCT.md](PRODUCT.md) defines the
product and interaction constraints that the visual system serves. This file is
the short decision contract: when it conflicts with an ad-hoc request or an
older component, follow this file and `DESIGN.md` unless the user explicitly
changes the theme.

## Theme: The Clay Range

CyberRange is a calm, premium, hands-on security-training product. It must feel
welcoming to learners and credible to professionals. The interface is quiet so
the live terminal, real grading, and real progress are easy to understand.

- **Soft Daylight:** warm paper canvas, white floating surfaces, slate-ink
  actions, peach selection, and mint completion.
- **Ember:** an equal dark-theme variant with espresso surfaces, cream text,
  and apricot/rust actions at matching semantic lightness steps.
- **Signature:** the rounded clay cube represents progress; clay lab art gives
  labs their identity; the cube mascot is deliberately scarce and purposeful.

Do not reinterpret this as a generic “cyber” interface. There are no neon grids,
green terminal chrome, purple/violet/lavender/indigo accents, or large marketing
gradients behind dashboard statistics.

## Non-negotiable visual rules

1. **Use the design tokens and existing primitives.** Prefer the semantic Tailwind
   utilities, CSS variables, and established components over new arbitrary colors,
   shadows, radii, or one-off control styles.
2. **Keep chrome neutral.** Slate and warm neutrals carry application UI; pastel
   color belongs chiefly to clay objects, lab-art stages, hero washes, rewards,
   and tightly scoped status meaning.
3. **Use color semantically.** Peach means selected/highlighted. Mint means
   completed/success. Rose means error. Amber/orange means warning or upcoming.
   In Ember, use the documented apricot/rust token partners rather than a
   separately invented dark palette.
4. **Keep shapes soft and consistent.** Buttons, filters, and status controls are
   pills; inputs and navigation items use the documented medium/large radii;
   cards, sheets, and stages use the documented 22–32px container radii.
5. **Honor the type system.** Figtree is for display and headings, Inter for UI
   and body copy, JetBrains Mono for code, commands, and terminals. Labels are
   sentence case and at least 12px; use tabular numerals for stats and tables.
6. **The terminal is sacred.** Never cover, decorate, or obstruct the terminal
   pane with mascot, confetti, cards, or promotional UI.
7. **The mascot is not filler.** Use the existing mascot only in its documented
   places and only for a real interaction, loading, success, empty, or error
   state. Do not create another character or style it outside the logo tones.
8. **Progress is honest.** Game-layer counts, rewards, streaks, badges, and
   estimates must come from real data. Never fabricate progress or success.

## Interaction, accessibility, and performance

- Treat light and Ember as first-class: every new visual treatment needs a
  deliberate dark counterpart from the same semantic ramp and WCAG AA contrast.
- Preserve keyboard operation, focus visibility, labels, dialog focus handling,
  Escape behavior, and readable error states.
- Respect `prefers-reduced-motion` and the app's graphics setting. Motion is
  purposeful, short, and optional; no new perpetual animation without an
  existing design-system rationale.
- Reuse the 3D kit and pre-rendered clay assets. Do not add live WebGL to card
  grids or other repeated surfaces. Every visual enhancement needs a light-mode
  and no-WebGL fallback.
- Design mobile as a complete experience: no clipped controls, horizontal page
  overflow, hover-only action, or dependence on a wide dashboard layout.
- Preserve routes, API integrations, real terminal behavior, and business logic
  while making visual work. A visual refresh is not authorization to remove a
  workflow.

## Required implementation workflow

1. Read `DESIGN.md`, `PRODUCT.md`, and the nearest existing component before
   editing a frontend surface.
2. Reuse or extend an established primitive. If a new primitive is necessary,
   document its token, states, light/dark behavior, responsive behavior, and
   accessibility contract in `DESIGN.md` in the same change.
3. Implement all states that apply: default, hover, focus-visible, disabled,
   loading, empty, error, success, light, dark, reduced-motion, and small-screen.
4. Build and lint from `backup/`; inspect affected desktop and mobile views when
   a runnable environment is available.
5. In the handoff, state how the work follows this contract and call out any
   deliberate exception. Do not silently drift the visual language.

## Fast review checklist

Before declaring frontend work complete, verify:

- Does it read as Soft Daylight/Ember rather than a new visual system?
- Are colors, type, shape, elevation, and motion drawn from `DESIGN.md`?
- Are both themes accessible and intentional?
- Does it work with keyboard, reduced motion, light graphics mode, and mobile?
- Are new numbers, rewards, and status claims backed by real data?
- Is the terminal unobstructed and are existing flows still intact?

## Changing this contract

Treat a theme change as a product-level decision. Change this contract and
`DESIGN.md` together, state what is being superseded, and obtain an explicit
user decision before introducing a new visual direction.
