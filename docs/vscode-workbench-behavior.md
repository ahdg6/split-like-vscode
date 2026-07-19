# VS Code Workbench Behavior Contract

This document records the behavior patterns this workspace layout library should follow when it
models a VS Code-like workbench. The goal is not API compatibility with VS Code or Allotment. The
goal is to copy the interaction semantics that make a workbench feel predictable under repeated
use.

## Reference Model

- VS Code separates low-level split layout from workbench concepts. This project follows the same
  shape: `@worksplit/core` owns framework-free layout and workbench state, while
  `@worksplit/react` owns DOM interaction and rendering.
- VS Code `SplitView` supports snap views. A snap-capable view does not disappear the moment it
  reaches minimum size. This project keeps the pane clamped at `minSize` first, then treats a
  continued inward drag as hide intent only after a short delay.
- VS Code stores visibility and size separately. A hidden view keeps a remembered size and can be
  restored without losing the user's previous intent.

Primary source for the split/sash behavior:
https://github.com/microsoft/vscode/blob/main/src/vs/base/browser/ui/splitview/splitview.ts

## Parts And Views

Workbench layout is organized around parts:

- `primary`
- `secondary`
- `panel`
- editor area

Views are registered into parts. A part has one active view, and visibility belongs to the part.
This matches how VS Code activity bar entries switch side bar containers while the side bar itself
can be shown or hidden. The core and React APIs both use the same part names.

Implemented API:

- `WorkbenchView.part`
- `Workbench.partSizes`
- `WorkbenchView.renderContent`
- `WorkbenchView.defaultActive`
- `WorkbenchView.defaultVisible`
- `WorkbenchView.activityGroup`
- `WorkbenchEditorGroup`
- `WorkbenchEditorTab`
- `WorkbenchIcon`
- `WorkbenchActions`
- `WorkbenchPartSize`
- `WorkbenchHandle.activateView`
- `WorkbenchHandle.activateEditorTab`
- `WorkbenchHandle.toggleView`
- `WorkbenchHandle.showPart`
- `WorkbenchHandle.hidePart`
- `WorkbenchHandle.resetLayout`
- `WorkbenchHandle.setPanelPosition`
- `WorkbenchHandle.togglePanelPosition`
- `WorkbenchHandle.runCommand`
- `WorkbenchHandle.getLayout`
- `WorkbenchHandle.restoreLayout`
- `WorkbenchHandle.getAreaLayout`
- versioned `WorkbenchValue`

## Sash Resize

Visible sashes resize adjacent visible panes. Resizing respects:

- minimum size
- maximum size
- priority-based redistribution in core
- proportional container resize
- keyboard arrows

Sash double-click resets preferred sizes only for normal visible sashes. Hidden boundary sashes do
not treat double-click or click as restore commands.

## Snap Collapse

Snap collapse is opt-in at pane level:

```tsx
<Pane id="explorer" minSize={180} defaultSize={280} snap />
```

Workbench part panes enable `snap` by default. Editor panes do not snap by default.

Collapse behavior:

- Dragging toward a snap pane's minimum size clamps at `minSize`.
- The pane stays visible and stable at `minSize`; it does not keep shrinking visually.
- If the user keeps dragging inward while the pane is already at `minSize`, a collapse timer starts.
- The pane collapses only if the inward drag remains active for `snapCollapseDelay`.
- Default `snapCollapseDelay` is 320 ms.
- `snapThreshold` is a small pointer-pressure tolerance beyond `minSize` before the timer starts.
- Default `snapThreshold` is 2 px.
- The size from the beginning of the snap drag is cached before collapse.

This creates a deliberate "detent": reaching the minimum is resize intent; holding continued
inward pressure is hide intent.

## Hidden Boundary Restore

Hidden panes render a boundary sash at their previous edge. This boundary is not a button.

Restore behavior:

- Click does not restore a hidden pane.
- Dragging the hidden boundary outward restores the pane.
- Restore starts only after a small reveal threshold to avoid accidental pointer jitter.
- After restore, the dragged distance becomes the pane size.
- Keyboard restoration uses the directional arrow that points outward from the hidden boundary.
- Activity bar and command handles can still show/hide views directly.

This keeps the same mental model as VS Code: the activity bar is for commands and view activation;
the sash is for spatial layout.

## Activity Bar

Activity items are view commands:

- Clicking an inactive item activates its view and shows its part.
- Clicking the active visible item hides its part.
- The active item remains distinguishable even if the part is hidden.
- Footer items are supported with `activityGroup: "footer"` for settings/account-like entries.
- Consumers can replace item rendering through `renderActivityItem`.

## Editor Area

The editor area supports two levels:

- `editor` for simple single-node usage
- `editorGroups` for one or more editor groups with tabs

The two inputs are mutually exclusive. `editor` is a convenience path for a single editor surface;
`editorGroups` is the long-term model for editor tabs and split editor groups.

Each editor group owns its active tab. Multiple groups are rendered as a horizontal split inside the
center area, and their split sizes are persisted separately from the workbench side/panel splits.
This keeps editor tabs and workbench views separate: views live in workbench parts, while editor
tabs live in editor groups.

## Persistence

Workbench layout is serializable:

- `activeByPart`
- `activeEditorTabs`
- `visibleParts`
- `panelPosition`
- workbench area pane sizes
- center split pane sizes
- editor group split pane sizes
- schema `version`

Runtime `WorkbenchValue` is normalized and complete. `WorkbenchValueSnapshot` is the partial shape
used for persistence and initial values.

The React `Workbench` can persist this state with `storageKey`. Stored layouts must use the
current `WorkbenchLayout` shape.

## Panel Position

The panel can be positioned at the bottom or on the right:

- `defaultLayout.panelPosition` sets the uncontrolled initial position.
- `togglePanelPosition` mirrors the common workbench command shape.
- Changing position remounts the relevant split view so pane-id size snapshots can be applied
  cleanly to the new topology.

## Commands And Keybindings

Workbench commands are app-level actions. Built-in commands:

- `workbench.action.toggleSidebarVisibility`: `mod+b`
- `workbench.action.togglePanel`: `mod+j`
- `workbench.action.toggleAuxiliaryBar`: `mod+alt+b`
- `workbench.action.togglePanelPosition`: `mod+shift+j`
- `workbench.action.resetLayout`: `mod+shift+0`

`mod` maps to Ctrl on Windows/Linux and Meta on macOS. Keybindings are handled on the workbench
root through React event bubbling. Editable targets are ignored so text editing is not hijacked.
Consumers can append commands with the `commands` prop and run commands through the imperative
handle.

## Injection Points

The library should expose behavior hooks without hard-coding product UI:

- `renderSash`
- `renderCollapsedPane`
- `renderActivityItem`
- `renderPartHeader`
- `renderCollapsedPart`

Injected content must not change the sash role. The sash remains the interaction target.

## Accessibility

Current contract:

- Sashes use `role="separator"`.
- Orientation is mapped to ARIA orientation.
- Visible sashes support keyboard resize with arrow keys.
- Hidden boundary sashes support directional keyboard restore.
- Activity items expose `aria-pressed`.
- Editor tabs use roving focus, arrow/Home/End navigation, and linked `tab`/`tabpanel` semantics.

Future work:

- expose command labels for custom keybinding systems
- add roving focus for activity bar groups

## Backlog For Further VS Code Alignment

- editor group split and merge model
- drag-and-drop editor groups
- zen/focus modes
- primary side bar position left/right
- secondary side bar independent activity targets
- hover affordances and delayed sash activation for dense UIs
- view container badges and contextual menus
