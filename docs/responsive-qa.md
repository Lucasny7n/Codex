# Responsive QA Checklist

Ailu should preserve its current identity while behaving like a real desktop app across window sizes.

## Layout Modes

- `comfortable`: default spacing for normal desktop use.
- `compact`: denser controls for split-screen, notebooks and square windows.
- `focus`: hides the sidebar and prioritizes the center workspace.

The mode control appears near the topbar and is persisted locally.

## Breakpoints

- Narrow: `< 760px`.
- Compact: `760px - 1179px`.
- Wide: `1180px - 1799px`.
- Ultrawide: `>= 1800px`.
- Square-ish: width/height ratio between `0.82` and `1.18`.

## Scenarios

| Viewport | Expected behavior |
| --- | --- |
| 1920x1080 fullscreen | Sidebar visible, center dominates, library/workspace grids use multiple columns. |
| 1366x768 | Sidebar remains usable; central chat and composer do not overflow horizontally. |
| 1280x720 | Sidebar becomes overlay/collapsible; main content remains usable. |
| 1024x768 | Compact/narrow behavior prevents squeezed cards and keeps scroll inside panels. |
| 900x900 | Square-ish class reduces hero vertical waste and keeps cards readable. |
| 800x600 | Tauri minimum window remains usable; layout control and topbar fit. |
| Half horizontal | Compact mode should keep composer, model picker and library filters usable. |
| 420px narrow | Library and workspace become single-column; text wraps instead of clipping. |
| Ultrawide | Content uses max-width constraints and does not stretch into unreadable line lengths. |

## Manual Checks

- No horizontal page overflow.
- Sidebar collapse button remains reachable.
- Layout mode buttons are keyboard reachable and have visible active state.
- Library filter selects wrap into two columns or one column as needed.
- Resource cards do not clip long titles, tags or URLs.
- AI Workspace plan rows wrap long details and paths.
- Terminal drawer does not cover the composer permanently.
- Modal focus trap still works in Settings and project dialogs.
- Reduced motion users should not need animation to understand state.

## Validation Commands

```bash
npm run screenshots
npm run test:visual
```

Visual smoke should be used as evidence, but manual window resizing is still required before a release claim.
