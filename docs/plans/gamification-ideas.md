# Gamification Ideas

> Status reminder: every idea in this document must keep its `Status` field current. Use one of `not started`, `in work`, `done`, or `trashed` whenever an idea is added, changed, implemented, or rejected.

## Summary

Gamification in Pile of Todos should feel like quiet progress, not a game layer pasted onto a planning tool. The goal is to help the user reflect on the week, notice planning patterns, and build momentum without making unfinished work feel punitive.

The strongest first idea is a weekly summary that shows:

- Done todos for the week.
- Todos moved off the current week.
- Todos still not done at the end of the week.
- A gentle signal for todos that keep moving across weeks.

This summary needs historical data. The current `todos` row stores the latest state of a todo, so it can answer questions like "what is unfinished right now?" but it cannot reliably answer "what moved out of week 21?" after the todo has been moved again.

## Data Model Direction

Use the current `todos` table as the present-state read model, but add an append-only activity history before building serious weekly summaries.

Recommended source of truth:

- `todo_created`
- `todo_completed`
- `todo_reopened`
- `todo_scheduled`
- `todo_moved`
- `todo_archived`
- `todo_deleted`

Weekly summaries should be derived from this event history. A separate `weekly_summaries` table can be added later as a cache or materialized read model, but it should be rebuildable from events.

Storing only weekly summaries without the underlying events would be fragile. It would be hard to correct summaries when a todo is edited, reopened, moved multiple times, deleted, or synced late from another device.

The existing `todo_mutation_ledger` is not enough for this. It records accepted mutation IDs, todo IDs, txids, and acceptance time, but it does not keep the mutation payload or old values. It is useful for idempotency and sync confirmation, not for reconstructing weekly planning history.

## Weekly Summary Idea

Status: `not started`

The weekly summary should be a calm review surface shown near the end of a week or when the user opens a past week.

Useful summary metrics:

- Completed this week: todos that became done during the week.
- Carried forward: todos that were planned for the week but moved to a later week or backlog.
- Left open: todos still assigned to the week and not done when the week ends.
- Reopened: todos marked done and then reopened during the week.
- Planning drift: todos moved across multiple weeks over time.

The language should stay neutral. Prefer "carried forward" over "failed", "left open" over "missed", and "planning drift" over "procrastination".

Potential display:

- A compact weekly reflection card on the current-week page.
- A past-week detail view that lists completed, carried-forward, and left-open todos.
- A small trend strip comparing the last few weeks.

## Additional Ideas

### Weekly Reflection

Status: `not started`

Add a short weekly review prompt:

- What got finished?
- What should move forward?
- What no longer matters?

This can be the main gamification loop without needing points.

### Kept Commitments Ratio

Status: `not started`

Show how much planned work was completed within its planned week. This should be framed as a planning-quality signal, not a productivity score.

Good labels:

- Focus ratio
- Plan follow-through
- Kept commitments

### Gentle Streaks

Status: `not started`

Use streaks for healthy planning rituals instead of raw output.

Examples:

- Reviewed the week for 3 weeks in a row.
- Cleared unfinished decisions for 2 weeks in a row.
- Captured at least one future commitment for 4 weeks in a row.

Avoid streaks that punish vacations, illness, or quiet weeks.

### Personal Bests

Status: `not started`

Use personal bests sparingly and keep them reflective.

Examples:

- Most focused week: high completion with low carry-forward.
- Cleanest plan: fewest stale unfinished todos.
- Strongest finish: most todos completed near week end.

Avoid leaderboards, public comparison, and oversized celebration UI.

### Reschedule Awareness

Status: `not started`

Track todos that keep moving forward. This can help the user decide whether a task should be broken down, deprioritized, archived, or made current.

Do not implement this as a UI-only badge on top of the current `todos.weekNumber` field. The badge depends on temporal history, not just present todo state. Implement the data foundation first:

- Use a durable week identity instead of bare week numbers, because week `4` repeats every year.
- Add append-only todo history for schedule changes, including old week, new week, todo ID, user ID, mutation ID, txid, and occurrence time.
- Write schedule-change events in the same transaction as the todo update so offline retries and accepted mutations stay idempotent.
- Treat badge values as derived data that can be rebuilt from events.
- Only render awareness chips after the event/history layer exists.

Possible language:

- "Moved 3 times"
- "Carried across 4 weeks"
- "Needs a decision"

Use compact icon-first awareness chips where possible:

- `{move_icon} 2x` for repeated rescheduling.
- `{carry_icon} 4w` for carrying a todo across weeks.
- `{Scale}` for todos that need a decision.

The decision icon is settled: use Lucide's `Scale` icon. It suggests weighing options and making a call without turning the signal into a warning.

Recommended Lucide candidates:

- `Repeat2` for the move icon. It reads as repeated movement and pairs well with a count like `2x`.
- `ArrowRightLeft` for the move icon if a more literal "moved" metaphor is preferred.
- `CalendarSync` for the carry icon. It combines week/calendar context with repeated carry-forward behavior.

Custom combined icons are also worth exploring later. Lucide's Vue guide for [combining icons](https://lucide.dev/guide/vue/advanced/combining-icons) supports combining icons by nesting one Lucide SVG component inside another, passing SVG positioning props such as `x` and `y` to the inner icon, and keeping the nested icon within the outer icon's `24x24` viewBox.

Potential combined-icon directions:

- `{move_icon}`: `ArrowRight` plus a small nested `Repeat2`, to communicate repeated rescheduling.
- `{carry_icon}`: `CalendarRange` plus a small nested `ArrowRight`, to communicate carrying a todo across weeks.

These should appear as quiet signals on the todo or in a review view, not as warning banners.

### Momentum Timeline

Status: `not started`

Show a small timeline of recent weeks:

- Done count.
- Carried-forward count.
- Left-open count.
- Review completed or not.

This gives the user a sense of rhythm without turning the app into an analytics dashboard.

## Future Implementation Notes

An eventual implementation should treat events as the durable history and summaries as derived data.

Important behavior to preserve:

- A todo moved from week 21 to week 22 counts as moved off week 21.
- A todo moved multiple times keeps every movement event.
- Completing a todo credits the week when completion happened.
- Reopening a todo is distinct from first completion.
- Deleting or archiving a todo does not erase its past contribution to weekly history.
- Offline queued mutations produce the same event history after sync.
- Weekly summaries can be rebuilt from events.

For a first version, keep the UI simple: one weekly summary card, one past-week detail view, and no permanent points system.
