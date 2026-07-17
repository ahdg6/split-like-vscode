import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installTestResizeObserver } from "./test-resize-observer";
import {
  Workbench,
  type WorkbenchEditorGroup,
  type WorkbenchHandle,
  type WorkbenchView,
} from "./workbench";

installTestResizeObserver({ height: 600, width: 900 });

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

const views: WorkbenchView[] = [
  {
    defaultActive: true,
    icon: <span>E</span>,
    id: "explorer",
    part: "primary",
    renderContent: () => <div>Explorer View</div>,
    size: { default: 240, min: 120 },
    title: "Explorer",
  },
  {
    defaultActive: true,
    icon: <span>T</span>,
    id: "terminal",
    part: "panel",
    renderContent: () => <div>Terminal View</div>,
    size: { default: 180, min: 100 },
    title: "Terminal",
  },
  {
    defaultActive: true,
    icon: <span>I</span>,
    id: "inspector",
    part: "secondary",
    renderContent: () => <div>Inspector View</div>,
    size: { default: 260, min: 160 },
    title: "Inspector",
  },
];

const editorGroups: WorkbenchEditorGroup[] = [
  {
    id: "left",
    tabs: [
      {
        id: "app",
        renderContent: () => <div>App editor</div>,
        title: "App.tsx",
      },
      {
        id: "workbench",
        renderContent: () => <div>Workbench editor</div>,
        title: "Workbench.tsx",
      },
    ],
  },
  {
    id: "right",
    tabs: [
      {
        id: "preview",
        renderContent: () => <div>Preview editor</div>,
        title: "Preview",
      },
    ],
  },
];

function RerenderingWorkbench(props: { readonly version: number }) {
  return (
    <Workbench
      editor={<div>Editor {props.version}</div>}
      views={views.map((view) => ({ ...view }))}
    />
  );
}

describe("Workbench", () => {
  it("supports editor-only usage without an empty activity bar", () => {
    render(<Workbench>Editor</Workbench>);

    expect(screen.getByText("Editor")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Workbench views" })).toBeNull();
  });

  it("toggles active views from the activity bar", () => {
    const handle = createRef<WorkbenchHandle>();

    render(<Workbench ref={handle} editor={<div>Editor</div>} views={views} />);

    expect(handle.current?.getValue().visibleParts.primary).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Explorer" }));

    expect(handle.current?.getValue().visibleParts.primary).toBe(false);
    expect(handle.current?.getValue().activeEditorTabs).toEqual({ main: "editor" });
  });

  it("runs built-in commands", () => {
    const handle = createRef<WorkbenchHandle>();

    render(<Workbench ref={handle} editor={<div>Editor</div>} views={views} />);

    expect(handle.current?.getLayout().panelPosition).toBe("bottom");

    act(() => {
      expect(handle.current?.runCommand("workbench.action.togglePanelPosition")).toBe(true);
    });

    expect(handle.current?.getLayout().panelPosition).toBe("right");
  });

  it("resets to declared default state", () => {
    const handle = createRef<WorkbenchHandle>();

    render(
      <Workbench
        ref={handle}
        defaultPanelPosition="right"
        defaultValue={{ version: 1, visibleParts: { primary: false } }}
        editor={<div>Editor</div>}
        views={views}
      />,
    );

    expect(handle.current?.getLayout().panelPosition).toBe("right");
    expect(handle.current?.getValue().visibleParts.primary).toBe(false);

    act(() => handle.current?.togglePanelPosition());
    act(() => handle.current?.showPart("primary"));

    expect(handle.current?.getLayout().panelPosition).toBe("bottom");
    expect(handle.current?.getValue().visibleParts.primary).toBe(true);

    act(() => handle.current?.resetLayout());

    expect(handle.current?.getLayout().panelPosition).toBe("right");
    expect(handle.current?.getValue().visibleParts.primary).toBe(false);
  });

  it("dispatches built-in command keybindings from the workbench root", () => {
    const handle = createRef<WorkbenchHandle>();

    render(<Workbench ref={handle} editor={<div>Editor</div>} views={views} />);

    fireEvent.keyDown(screen.getByRole("application"), {
      ctrlKey: true,
      key: "j",
    });

    expect(handle.current?.getValue().visibleParts.panel).toBe(false);
  });

  it("keeps one document keydown subscription when workbench content rerenders", () => {
    const addEventListener = vi.spyOn(document, "addEventListener");
    const removeEventListener = vi.spyOn(document, "removeEventListener");
    const { rerender } = render(<RerenderingWorkbench version={1} />);
    const keydownSubscriptions = () =>
      addEventListener.mock.calls.filter(([event]) => event === "keydown").length;
    const keydownUnsubscriptions = () =>
      removeEventListener.mock.calls.filter(([event]) => event === "keydown").length;

    expect(keydownSubscriptions()).toBe(1);
    rerender(<RerenderingWorkbench version={2} />);

    expect(screen.getByText("Editor 2")).toBeTruthy();
    expect(keydownSubscriptions()).toBe(1);
    expect(keydownUnsubscriptions()).toBe(0);
  });

  it("does not dispatch command keybindings from editable targets", () => {
    const handle = createRef<WorkbenchHandle>();

    render(<Workbench ref={handle} editor={<input aria-label="Editor input" />} views={views} />);

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Editor input" }), {
      ctrlKey: true,
      key: "j",
    });

    expect(handle.current?.getValue().visibleParts.panel).toBe(true);
  });

  it("respects prevented keydown events from consumers", () => {
    const handle = createRef<WorkbenchHandle>();

    render(
      <Workbench
        ref={handle}
        editor={<div>Editor</div>}
        onKeyDown={(event) => event.preventDefault()}
        views={views}
      />,
    );

    fireEvent.keyDown(screen.getByRole("application"), {
      ctrlKey: true,
      key: "j",
    });

    expect(handle.current?.getValue().visibleParts.panel).toBe(true);
  });

  it("lets user commands override built-in commands by id", () => {
    const handle = createRef<WorkbenchHandle>();
    const run = vi.fn<() => void>();

    render(
      <Workbench
        ref={handle}
        commands={[{ id: "workbench.action.togglePanelPosition", run }]}
        editor={<div>Editor</div>}
        views={views}
      />,
    );

    act(() => {
      expect(handle.current?.runCommand("workbench.action.togglePanelPosition")).toBe(true);
    });

    expect(run).toHaveBeenCalledOnce();
    expect(handle.current?.getLayout().panelPosition).toBe("bottom");
  });

  it("passes workbench actions to render slots", () => {
    const handle = createRef<WorkbenchHandle>();

    render(
      <Workbench
        ref={handle}
        editor={<div>Editor</div>}
        renderPartHeader={({ actions, part, view }) => (
          <button onClick={() => actions.hidePart(part)} type="button">
            Hide {view.title}
          </button>
        )}
        views={views}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide Explorer" }));

    expect(handle.current?.getValue().visibleParts.primary).toBe(false);
  });

  it("does not emit value changes for unchanged part visibility", () => {
    const handle = createRef<WorkbenchHandle>();
    const onValueChange = vi.fn<NonNullable<ComponentProps<typeof Workbench>["onValueChange"]>>();

    render(
      <Workbench
        ref={handle}
        editor={<div>Editor</div>}
        onValueChange={onValueChange}
        views={views}
      />,
    );

    act(() => handle.current?.hidePart("primary"));
    act(() => handle.current?.hidePart("primary"));

    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        visibleParts: expect.objectContaining({ primary: false }),
      }),
    );
  });

  it("renders editor groups and tracks active editor tabs", () => {
    const handle = createRef<WorkbenchHandle>();

    render(<Workbench ref={handle} editorGroups={editorGroups} views={views} />);

    expect(screen.getByText("App editor")).toBeTruthy();
    expect(screen.getByText("Preview editor")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Workbench.tsx" }));

    expect(screen.getByText("Workbench editor")).toBeTruthy();
    expect(handle.current?.getValue().activeEditorTabs).toEqual({
      left: "workbench",
      right: "preview",
    });
    expect(handle.current?.getLayout().value.activeEditorTabs).toEqual({
      left: "workbench",
      right: "preview",
    });
    expect(handle.current?.getAreaLayout("editorGroups")).toBeTruthy();
  });

  it("restores layout snapshots with split sizes", () => {
    const handle = createRef<WorkbenchHandle>();

    render(<Workbench ref={handle} editor={<div>Editor</div>} views={views} />);

    act(() => {
      handle.current?.restoreLayout({
        panelPosition: "right",
        areaSizes: {
          workbench: {
            "workbench:editor": 540,
            "workbench:panel": 180,
            "workbench:primary": 180,
            "workbench:secondary": 120,
          },
        },
        version: 1,
        value: {
          activeByPart: {
            panel: "terminal",
            primary: "explorer",
            secondary: "inspector",
          },
          version: 1,
          visibleParts: {
            panel: true,
            primary: true,
            secondary: false,
          },
        },
      });
    });

    const snapshot = handle.current?.getLayout();
    expect(snapshot?.panelPosition).toBe("right");
    expect(handle.current?.getValue().visibleParts.secondary).toBe(false);
    expect(snapshot?.areaSizes?.workbench?.["workbench:primary"]).toBe(180);
  });

  it("does not emit value or panel changes when restoring equivalent state", () => {
    const handle = createRef<WorkbenchHandle>();
    const onPanelPositionChange =
      vi.fn<NonNullable<ComponentProps<typeof Workbench>["onPanelPositionChange"]>>();
    const onValueChange = vi.fn<NonNullable<ComponentProps<typeof Workbench>["onValueChange"]>>();

    render(
      <Workbench
        ref={handle}
        editor={<div>Editor</div>}
        onPanelPositionChange={onPanelPositionChange}
        onValueChange={onValueChange}
        views={views}
      />,
    );

    act(() => {
      handle.current?.restoreLayout(handle.current.getLayout());
    });

    expect(onPanelPositionChange).not.toHaveBeenCalled();
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
