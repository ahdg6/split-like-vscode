# Worksplit

A small split-view workspace library inspired by VS Code and the `johnwalley/allotment` layout model.

This repo is intentionally split into DOM-free core logic and a React binding:

- `app`: business frontend. Add business-only UI libraries and runtime dependencies here.
- `packages/demo`: Vite 8 + React 19 demo with nested editor/workspace panes.
- `@worksplit/core`: pane constraints, preferred sizes, proportional resize, sash drag math, value snapshots.
- `@worksplit/react`: React components, ResizeObserver integration, pointer handling, CSS.

pnpm workspaces manage package linking. Turbo coordinates package task graphs and local caching. The
root package stays as the workspace orchestration layer; app dependencies belong in their own
package files, primarily `app/package.json`.

The VS Code-like behavior contract is tracked in
[docs/vscode-workbench-behavior.md](./docs/vscode-workbench-behavior.md).

## Run

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts the business frontend on port `5173`. Use `pnpm dev:demo` for the library demo
on port `5174`.

## Scripts

```sh
pnpm lint
pnpm format
pnpm test
pnpm typecheck
pnpm build
```

`build`, `test`, `typecheck`, and `lint` are Turbo-backed. `format` stays a whole-repo write operation.

## Example

### SplitView

```tsx
import { useRef } from "react";
import { Pane, SplitView, type SplitViewHandle } from "@worksplit/react";
import "@worksplit/react/style.css";

export function Workspace() {
  const workspace = useRef<SplitViewHandle>(null);

  return (
    <SplitView ref={workspace} orientation="horizontal">
      <Pane id="explorer" minSize={180} defaultSize={260}>
        <button onClick={() => workspace.current?.collapsePane("explorer")}>Explorer</button>
      </Pane>
      <Pane id="editor" minSize={320} defaultSize="1fr">
        Editor
      </Pane>
      <Pane id="assistant" minSize={220} defaultSize={320}>
        Assistant
      </Pane>
    </SplitView>
  );
}
```

### Workbench

```tsx
import { Workbench, type WorkbenchEditorGroup, type WorkbenchView } from "@worksplit/react";
import "@worksplit/react/style.css";

const views: WorkbenchView[] = [
  {
    id: "explorer",
    part: "primary",
    title: "Explorer",
    size: { default: 260, min: 180, max: 420 },
    renderContent: () => <Explorer />,
  },
  {
    id: "terminal",
    part: "panel",
    title: "Terminal",
    size: { default: 220, min: 140, max: 360 },
    renderContent: () => <Terminal />,
  },
];

const editorGroups: WorkbenchEditorGroup[] = [
  {
    id: "main",
    tabs: [
      { id: "app", title: "App.tsx", renderContent: () => <AppFile /> },
      { id: "split-view", title: "SplitView.tsx", renderContent: () => <SplitViewFile /> },
    ],
  },
  {
    id: "preview",
    size: { default: 360, min: 260 },
    tabs: [{ id: "preview", title: "Preview", renderContent: () => <Preview /> }],
  },
];

export function Workspace() {
  return (
    <Workbench
      editorGroups={editorGroups}
      layoutStorageKey="workspace-layout"
      renderPartHeader={({ actions, part, view }) => (
        <Header title={view.title} onClose={() => actions.hidePart(part)} />
      )}
      views={views}
    />
  );
}
```

Workbench state is controlled with `value` / `onValueChange`; uncontrolled defaults use
`defaultValue` and `defaultLayout`. Layout changes emit a versioned `WorkbenchLayout` through
`onLayoutChange`, with area sizes stored by pane id. The center editor area can be `children`, an
`editor` node, or descriptor-based `editorGroups` with tabs; pass one of them. Runtime
`WorkbenchValue` is complete, while `WorkbenchValueSnapshot` stays partial for persistence and
initialization. Render slots receive a stable `actions` object, so common UI does not need an
imperative ref.
