# Product

## Register

product

## Users

Pile of Todos is built for one person planning and finishing work across a weekly rhythm. The user is usually in a focused capture, triage, or execution session: adding tasks quickly, deciding whether work belongs in backlog, current week, future weeks, unfinished work, completed work, or archives, and checking that pending offline changes will sync when the account and connection are ready.

## Product Purpose

Pile of Todos exists to make weekly task planning durable, fast, and calm. Success means the user can capture a task without context switching, review work by time horizon, move items between lanes with confidence, and understand sync state without needing to think about Supabase, queued mutations, or snapshot confirmation mechanics.

The product is intentionally browser-driven. Supabase handles authentication, confirmed reads, Realtime, and RPC writes, while a local optimistic overlay keeps the planning surface useful while changes are queued, offline, accepted, or awaiting confirmation.

## Brand Personality

Calm, practical, personal. The app should feel like a reliable working surface for one person's week rather than a flashy productivity product. It may have quiet character, but it should never compete with the user's thinking.

## Anti-references

Avoid overly bright palettes, loud gradients, massive animations, generic SaaS dashboard tropes, and overly cute todo-app styling. The UI should not feel like a marketing demo, a neon productivity toy, a team operations dashboard, or a clone of a generic notes app.

## Design Principles

- Keep capture immediate: the primary gesture is adding work, so the composer should stay obvious, reachable, and low-friction.
- Organize by decision, not storage: backlog, current, future, unfinished, completed, and archived views should help the user decide what to do next.
- Make sync confidence quiet: offline, queued, accepted, confirmed, paused, retry, and re-auth states should be visible and legible without creating anxiety.
- Prefer calm contrast over decoration: color should clarify state and hierarchy, not brighten the surface for its own sake.
- Respect focus: use compact motion, restrained emphasis, and layouts that support quick scanning.
- Keep the product personal: optimize for one user's weekly rhythm instead of team-scale dashboard density.

## Accessibility & Inclusion

No special accessibility target beyond good product hygiene, but contrast must be reliable, text must not be too small, focus states must remain visible, and touch targets should remain usable on coarse pointers. Motion should stay subtle, and reduced-motion preferences must be respected.
