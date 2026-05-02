# Impeccable Assessment A — Pile of Todos

_Source-only review. Browser automation was not available in this session._

## AI slop verdict

**Verdict: not full AI slop, but it has several AI-ish seams.** The visual system is more restrained than a generic neon SaaS demo: dark surface, muted sage/pink accents, visible focus states, and reduced-motion support align with the product brief. The slop shows up in product truth and interaction details: **“Backlog by default” is false**, secondary weekly-planning views are hidden behind a generic hamburger, editing is undiscoverable, icon actions lack accessible names, and the “Sync Model” copy exposes implementation jargon instead of giving quiet confidence.

The app feels like a handsome component pass over a todo data model, not yet a fully directed personal planning surface.

## Nielsen heuristic scores

Scale: **0 = broken, 4 = excellent**.

| Heuristic                          | Score | Key issue                                                                                                                                                                        |
| ---------------------------------- | ----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Visibility of system status     |   2.5 | Loading states and sync status exist, but sync/auth are mostly tucked into the menu and the footer copy is technical rather than reassuring.                                     |
| 2. Match with real world           |     2 | “Backlog by default” contradicts the actual default current week; “Electric baseline,” “txid,” and “optimistic overlay” are developer language, not planner language.            |
| 3. User control and freedom        |     2 | Tasks can be completed/moved/archived, but archive has no undo/restore path in the archived view, and editing is hidden behind double-click.                                     |
| 4. Consistency and standards       |   2.5 | Calm styling is consistent, but primary vs secondary nav feels arbitrary; “Completed” route is `finished`; create form and move modal offer different week ranges.               |
| 5. Error prevention                |   1.5 | Form validation exists, but archive is one-click, hidden actions increase accidental use, mutation failures go to console only, and the default-week mismatch can misfile tasks. |
| 6. Recognition rather than recall  |     2 | The user must remember hidden secondary views, double-click editing, and unlabeled icon actions. Badges explain state but become repetitive.                                     |
| 7. Flexibility and efficiency      |   2.5 | Fixed capture form is efficient; moving tasks is available. Missing bulk triage, sort controls, arbitrary week selection, and visible edit affordances limit planning flow.      |
| 8. Aesthetic and minimalist design |   2.5 | Palette is calm, but huge brand/title spacing, heavy shadows, repeated badges, staggered animations, and a technical sync panel add unnecessary visual weight.                   |
| 9. Error recovery                  |     2 | Create/auth errors are visible; sync retry exists. Todo update errors are console-only, and archived tasks appear to have no clear recovery route.                               |
| 10. Help and documentation         |     2 | Empty states help lightly. There is no simple explanation of the weekly workflow; the only explanatory block is too implementation-centric.                                      |

## Cognitive load checklist

**Failure count: 8 / 12**

- [x] Primary task capture is always visible.
- [ ] Capture destination is trustworthy — helper says backlog by default, code defaults to current week.
- [ ] Navigation reflects planning priority — Unfinished, Completed, Archived are hidden behind a menu labeled only by an icon.
- [ ] Task actions are self-evident — move/archive are icon-only; edit is double-click only.
- [ ] Keyboard and pointer affordances are equivalent — desktop actions are visually hidden until hover but remain focusable.
- [ ] View purpose is reinforced — large titles exist, but no counts, filters, or short explanations of what belongs in each view.
- [ ] State labels reduce thinking — every card repeats schedule and lifecycle badges, often stating the obvious for the current view.
- [x] Text size is mostly acceptable for body/input content.
- [ ] Microcopy is calm and human — sync footer uses backend terminology.
- [ ] Error paths are visible — mutation failures are logged, not surfaced.
- [x] Motion is subtle and reduced-motion is respected.
- [ ] Recovery is clear — archived tasks lack a visible restore/unarchive action.

## Emotional journey

1. **Arrival:** The surface feels calm and serious. The dark palette and muted sage accent are appropriate for a personal planning tool.
2. **Orientation:** The user sees Backlog, Current, and Future quickly, but may miss Unfinished/Completed/Archived. The hamburger makes the app feel more like a responsive marketing shell than a focused planner.
3. **Capture:** The bottom form is convenient and confident. Then the week picker appears only after typing, and the helper text introduces distrust because it says backlog is default when current week is selected.
4. **Review:** Cards are readable, but the repeated badges and hover-only actions make scanning and acting slower than necessary.
5. **Maintenance:** Completing and moving tasks is straightforward once discovered. Archiving feels like a trapdoor because recovery is not clear.
6. **Sync/account confidence:** Status exists, but it is buried or technical. The user gets implementation disclosure instead of calm assurance.

## What’s working

- **The base palette is directionally right.** Dark surfaces with sage/pink accents avoid the bright productivity-toy trap and support a calm personal workspace.
- **The fixed capture form supports low-friction entry.** It is always available, has a clear input, and routes newly created tasks to the relevant view.
- **Reduced-motion support and visible focus outlines are present.** This is good product hygiene and fits the brief’s accessibility expectations.

## Priority issues

### 1. Fix the task destination trust break

**What:** `NewTodoForm.vue` initializes `weekNumber` to `currentWeek`, but the helper says “Backlog by default.”

**Why it matters:** This is the most damaging detail in a planning app. If users cannot trust where a task goes, capture becomes anxious instead of frictionless.

**Fix:** Either default to backlog and keep the helper, or keep current-week default and change the helper to something like “Current week by default.” Consider showing the selected destination even before typing.

### 2. Make planning views visible, not hidden in a hamburger

**What:** Only Backlog, Current, and Future are in the main nav. Unfinished, Completed, and Archived are hidden under a generic menu.

**Why it matters:** “Unfinished” is a core weekly planning mode, not a saved view. Hiding it weakens the weekly rhythm and increases recall burden.

**Fix:** Use a compact segmented nav or two-row nav that keeps Backlog, Current, Future, and Unfinished visible. Put Completed/Archived in a quieter secondary area if needed, but label the menu as “More views” rather than relying on a hamburger.

### 3. Replace hidden/ambiguous task actions with explicit affordances

**What:** Edit requires double-click. Move/archive are icon-only and visually hidden on desktop until hover; the buttons do not bind `aria-label`.

**Why it matters:** The app asks the user to discover core actions by accident. Keyboard users can tab to invisible controls. Touch/desktop behavior differs.

**Fix:** Add a visible, quiet action row or overflow button per card. Bind accessible names for icon buttons. Add a visible “Edit” affordance or make the title focusable/editable with clear instructions.

### 4. Humanize sync confidence

**What:** The footer explains “Electric baseline,” “local pending overlay,” and “txid.” Sync/auth status lives mainly in the header menu.

**Why it matters:** The product principle says sync confidence should be quiet and understandable. Current copy centers the implementation and may create anxiety.

**Fix:** Replace with user-facing states: “Saved on this device,” “Waiting to sync,” “Synced,” “Needs sign-in,” “Retry sync.” Keep technical diagnostics out of the main UI.

### 5. Add recovery for archive and mutation errors

**What:** Archive is one click, archived tasks still show an Archive action, and there is no obvious restore/unarchive. Update failures are only logged to the console.

**Why it matters:** Weekly planning involves moving tasks around. Users need safe reversibility, especially when offline/sync states are involved.

**Fix:** In Archived, replace Archive with Restore. Show a small undo toast after archive. Surface mutation failures inline or as a calm status message.

## Minor observations

- The huge “Pile” brand and 4xl–6xl page title consume a lot of vertical space for a utility app.
- “Future Week” should likely be “Future Weeks” because the view aggregates all weeks greater than current.
- Badges are useful in mixed views, but redundant in filtered views; consider reducing them contextually.
- Staggered card animations are subtle but may feel ornamental when reviewing long lists repeatedly.
- Sync status colors use default amber/blue/sky utilities that may not be tuned to the custom dark palette.
- Empty states are clean, but generic; they could teach the weekly workflow more directly.
- The create form and move modal offer different future ranges, which makes week planning feel arbitrary.

## Provocative questions

- Is “Pile” charming enough to justify the visual brand weight, or is it stealing attention from the week’s work?
- Should “Unfinished” be the app’s most important weekly review surface after Current?
- Why is archive available before restore exists?
- Does the user need to know Electric exists, or only whether their changes are safe?
- Are badges helping scan, or are they compensating for views that do not communicate enough on their own?
