# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: college students learning cyber security by doing. They sign in (email or college SSO), pick a lab or CTF, work in a real Linux terminal in the browser, submit, and get graded. Many are beginners who find terminals intimidating; some are competitive and chase the leaderboard.

Also primary: industry practitioners (working security and IT people) using the same labs for upskilling. The product must read as a serious professional tool, not only a student portal.

Secondary: college admins (faculty, lab coordinators) who buy labs, assign them to student groups, schedule them and read progress reports. Confirmed as lower priority for this pass: admin pages take the new system, not a bespoke redesign.

## Product Purpose

A hands-on cyber range: real, graded, sandboxed labs (Linux sysadmin, race conditions, cryptography, cloud security, compliance, recon), CTF events with scoreboards, study material, progress tracking and verifiable certificates. Success is a student finishing a lab they thought was beyond them, and an admin seeing that progress.

## Positioning

Real machines, real grading. Students type into an actual sandboxed shell and an autograder checks the actual system state, not a multiple-choice quiz or a simulated terminal.

## Operating Context

- Students work in long sessions with a split view: brief on one side, live terminal on the other. Reading comfort and focus matter more than decoration in that view.
- Light and dark themes exist; the theme is saved per user. Auth pages are forced to light today.
- Used on college lab machines and personal laptops; mobile is for checking progress, not doing labs.

## Capabilities and Constraints

- React 19 + Vite + Tailwind v4 + TypeScript; lucide-react icons; recharts; xterm terminal; CodeMirror editor (race lab).
- ~80 routes. All behaviour, API calls, routes and copy must keep working; this is a visual and UX pass, not a logic rewrite.
- Google Sign-In and Razorpay scripts load in index.html and must stay.
- This is the playground copy (CyberRange-Playground); it never pushes anywhere.

## Brand Commitments

- Name: CyberRange. Only asset on hand is public/favicon.png. No logo files, no brand palette committed.
- Standing preference (user, 2026-10-21): a clean, modern, professional learning platform (the category standard done at full craft) because industry users use it too. HackTheBox and TryHackMe are the craft bar and inspiration, but CyberRange must look different from them and stand out.

## Evidence on Hand

- Real lab catalogue, CTF data and progress come from the backend at runtime. No testimonials, partner logos or usage numbers exist; do not invent any.

## Product Principles

1. The terminal is the hero. Everything else helps a student get into it, stay in it, and understand what happened.
2. Make hard feel possible: friendly guidance and clear progress for beginners, without talking down to experienced students.
3. Honest feedback: grading results, errors and states are plain and specific.
4. Calm under long sessions: comfortable reading, low visual noise, both themes first-class.

## Accessibility & Inclusion

- WCAG AA contrast in both themes; full keyboard use; respect prefers-reduced-motion (3D and motion must switch off or simplify).
