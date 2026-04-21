# PMO Dashboard

A lightweight single-page Kanban dashboard for PMO teams to track work from backlog to live.

## Codebase overview

- `index.html`
  - Defines the complete UI structure:
    - Header actions (`Import`, `Export`, `GitHub Sync`, `+ New Task`)
    - Filter bar (assignee, ETA date, sprint)
    - Six Kanban columns (`backlog`, `todo`, `in-progress`, `in-qe`, `on-hold`, `live`)
    - Task modal (create/edit/delete)
    - GitHub sync settings modal
- `styles.css`
  - Provides a dark-themed UI with:
    - Layout and spacing for board/columns/cards
    - Button and badge styling (priority/type)
    - Modal and form styling
    - Drag-over visual feedback
- `script.js`
  - Owns all runtime behavior:
    - Local storage persistence (`pmo-tasks`, `gh-settings`)
    - Filtering and rendering logic
    - Card drag/drop status movement
    - Import/export JSON backups
    - GitHub GraphQL sync from Project V2

## Runtime data flow

1. App boots and reads tasks from `localStorage`.
2. Tasks are normalized and de-duplicated by title.
3. `renderBoard()` applies active filters and paints task cards into each status column.
4. User actions (add/edit/delete/drag/import/sync) mutate the in-memory array.
5. `saveAndRender()` persists tasks back to `localStorage` and re-renders the board.

## Workflow improvements implemented

To improve flow predictability and day-to-day triage quality:

- Added task normalization helpers so imported and synced tasks always have valid status/priority/title defaults.
- Added deterministic card ordering in each column:
  - Priority first (`High` -> `Medium` -> `Low`)
  - Earlier ETA next
  - Then title alphabetically
- Added controlled status progression for drag-and-drop:
  - Backward moves are allowed.
  - Forward moves must be one stage at a time.
  - Large jumps are blocked with a message.

This keeps pipeline transitions cleaner and avoids silently skipping key execution stages.

## Suggested next enhancements

- Add a compact analytics row (aging, blocked count, throughput by sprint).
- Add optional WIP limits for `In Progress` and `In QE`.
- Add task comments/activity history for auditability.
- Add GitHub field mapping config (custom field names per org).
