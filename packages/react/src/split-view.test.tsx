import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Pane, SplitView, type SplitViewHandle } from "./split-view";
import { installTestResizeObserver } from "./test-resize-observer";

installTestResizeObserver({ height: 400, width: 800 });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("@worksplit/react", () => {
  it("renders declared panes", () => {
    render(
      <div style={{ height: 400, width: 800 }}>
        <SplitView>
          <Pane id="left">Left</Pane>
          <Pane id="right">Right</Pane>
        </SplitView>
      </div>,
    );

    expect(screen.getByText("Left")).toBeTruthy();
    expect(screen.getByText("Right")).toBeTruthy();
  });

  it("does not schedule a layout update for equivalent pane declarations after rerender", async () => {
    const handle = createRef<SplitViewHandle>();
    const renderPane = vi.fn<(name: string) => void>();

    function PaneContent(props: { readonly name: string }) {
      renderPane(props.name);
      return <span>{props.name}</span>;
    }

    function Fixture(props: { readonly version: number }) {
      return (
        <div data-version={props.version} style={{ height: 400, width: 800 }}>
          <SplitView ref={handle}>
            <Pane id="left" defaultSize={300} minSize={100}>
              <PaneContent name="Left" />
            </Pane>
            <Pane id="right" defaultSize="1fr" minSize={100}>
              <PaneContent name="Right" />
            </Pane>
          </SplitView>
        </div>
      );
    }

    const { rerender } = render(<Fixture version={1} />);

    await waitFor(() => expect(handle.current?.getLayout()?.sizes).toEqual([300, 500]));
    renderPane.mockClear();

    rerender(<Fixture version={2} />);

    expect(renderPane.mock.calls.map(([name]) => name)).toEqual(["Left", "Right"]);
  });

  it("resizes panes from the keyboard", () => {
    const onLayoutChange = vi.fn<NonNullable<ComponentProps<typeof SplitView>["onLayoutChange"]>>();

    render(
      <div style={{ height: 400, width: 800 }}>
        <SplitView onLayoutChange={onLayoutChange}>
          <Pane id="left" defaultSize={400} minSize={100}>
            Left
          </Pane>
          <Pane id="right" defaultSize={400} minSize={100}>
            Right
          </Pane>
        </SplitView>
      </div>,
    );

    fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowRight" });

    expect(onLayoutChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        layout: expect.objectContaining({ sizes: [410, 390] }),
        sizeById: { left: 410, right: 390 },
        sizes: [410, 390],
      }),
    );
  });

  it("collapses and restores panes through the workspace handle", () => {
    const handle = createRef<SplitViewHandle>();

    render(
      <div style={{ height: 400, width: 800 }}>
        <SplitView ref={handle}>
          <Pane id="left" defaultSize={300} minSize={100}>
            Left
          </Pane>
          <Pane id="editor" defaultSize="1fr" minSize={100}>
            Editor
          </Pane>
        </SplitView>
      </div>,
    );

    expect(handle.current?.getLayout()?.sizes).toEqual([300, 500]);

    act(() => handle.current?.collapsePane("left"));

    expect(handle.current?.isPaneVisible("left")).toBe(false);
    expect(handle.current?.getLayout()?.visibleIds).toEqual(["editor"]);
    expect(handle.current?.getLayout()?.sizes).toEqual([800]);

    act(() => handle.current?.expandPane("left"));

    expect(handle.current?.isPaneVisible("left")).toBe(true);
    expect(handle.current?.getLayout()?.visibleIds).toEqual(["left", "editor"]);
    expect(handle.current?.getLayout()?.sizes).toEqual([300, 500]);
  });

  it("emits pane visibility changes as event objects", () => {
    const handle = createRef<SplitViewHandle>();
    const onPaneVisibilityChange =
      vi.fn<NonNullable<ComponentProps<typeof SplitView>["onPaneVisibilityChange"]>>();

    render(
      <div style={{ height: 400, width: 800 }}>
        <SplitView ref={handle} onPaneVisibilityChange={onPaneVisibilityChange}>
          <Pane id="left" defaultSize={300} minSize={100}>
            Left
          </Pane>
          <Pane id="editor" defaultSize="1fr" minSize={100}>
            Editor
          </Pane>
        </SplitView>
      </div>,
    );

    act(() => handle.current?.collapsePane("left"));
    act(() => handle.current?.collapsePane("left"));
    act(() => handle.current?.expandPane("left"));
    act(() => handle.current?.expandPane("left"));

    expect(onPaneVisibilityChange).toHaveBeenNthCalledWith(1, {
      id: "left",
      visible: false,
    });
    expect(onPaneVisibilityChange).toHaveBeenNthCalledWith(2, {
      id: "left",
      visible: true,
    });
    expect(onPaneVisibilityChange).toHaveBeenCalledTimes(2);
  });

  it("sets pane sizes by id without resetting unspecified panes", () => {
    const handle = createRef<SplitViewHandle>();

    render(
      <div style={{ height: 400, width: 800 }}>
        <SplitView ref={handle}>
          <Pane id="left" defaultSize={240} minSize={100}>
            Left
          </Pane>
          <Pane id="editor" defaultSize="1fr" minSize={100}>
            Editor
          </Pane>
          <Pane id="right" defaultSize={160} minSize={100}>
            Right
          </Pane>
        </SplitView>
      </div>,
    );

    act(() => handle.current?.resizePane("left", 300));
    act(() => handle.current?.setPaneSizes({ right: 200 }));

    expect(handle.current?.getLayout()?.sizeById).toEqual({
      editor: 340,
      left: 260,
      right: 200,
    });
  });

  it("does not restore a collapsed pane by clicking the boundary sash", () => {
    const handle = createRef<SplitViewHandle>();

    render(
      <div style={{ height: 400, width: 800 }}>
        <SplitView ref={handle}>
          <Pane id="left" defaultSize={300} minSize={100}>
            Left
          </Pane>
          <Pane id="editor" defaultSize="1fr" minSize={100}>
            Editor
          </Pane>
        </SplitView>
      </div>,
    );

    act(() => handle.current?.collapsePane("left"));

    fireEvent.click(screen.getByRole("separator", { name: "Reveal left by dragging" }));

    expect(handle.current?.isPaneVisible("left")).toBe(false);
    expect(handle.current?.getLayout()?.visibleIds).toEqual(["editor"]);
  });

  it("reveals a collapsed pane by dragging from its boundary", async () => {
    const handle = createRef<SplitViewHandle>();

    render(
      <div style={{ height: 400, width: 800 }}>
        <SplitView ref={handle}>
          <Pane id="left" defaultSize={300} minSize={100}>
            Left
          </Pane>
          <Pane id="editor" defaultSize="1fr" minSize={100}>
            Editor
          </Pane>
        </SplitView>
      </div>,
    );

    act(() => handle.current?.collapsePane("left"));

    const boundary = screen.getByRole("separator", { name: "Reveal left by dragging" });
    act(() => {
      fireEvent.pointerDown(boundary, { clientX: 0, pointerId: 1 });
      fireEvent(window, new MouseEvent("pointermove", { clientX: 220 }));
      fireEvent(window, new MouseEvent("pointerup", { clientX: 220 }));
    });

    await waitFor(() => {
      expect(handle.current?.isPaneVisible("left")).toBe(true);
      expect(handle.current?.getLayout()?.sizes).toEqual([220, 580]);
    });
  });

  it("does not snap a pane closed when the drag reaches minimum but ends before the delay", () => {
    const handle = createRef<SplitViewHandle>();

    render(
      <div style={{ height: 400, width: 800 }}>
        <SplitView ref={handle}>
          <Pane id="left" defaultSize={300} minSize={100} snap>
            Left
          </Pane>
          <Pane id="editor" defaultSize="1fr" minSize={100}>
            Editor
          </Pane>
        </SplitView>
      </div>,
    );

    const sash = screen.getByRole("separator", { name: "Resize pane" });
    act(() => {
      fireEvent.pointerDown(sash, { clientX: 300, pointerId: 1 });
      fireEvent(window, new MouseEvent("pointermove", { clientX: 80 }));
      fireEvent(window, new MouseEvent("pointerup", { clientX: 80 }));
    });

    expect(handle.current?.isPaneVisible("left")).toBe(true);
    expect(handle.current?.getLayout()?.sizes).toEqual([100, 700]);
  });

  it("snaps a pane closed after holding the drag beyond minimum", () => {
    vi.useFakeTimers();
    const handle = createRef<SplitViewHandle>();

    render(
      <div style={{ height: 400, width: 800 }}>
        <SplitView ref={handle}>
          <Pane id="left" defaultSize={300} minSize={100} snap>
            Left
          </Pane>
          <Pane id="editor" defaultSize="1fr" minSize={100}>
            Editor
          </Pane>
        </SplitView>
      </div>,
    );

    const sash = screen.getByRole("separator", { name: "Resize pane" });
    act(() => {
      fireEvent.pointerDown(sash, { clientX: 300, pointerId: 1 });
      fireEvent(window, new MouseEvent("pointermove", { clientX: 40 }));
      vi.advanceTimersByTime(320);
      fireEvent(window, new MouseEvent("pointerup", { clientX: 40 }));
    });

    expect(handle.current?.isPaneVisible("left")).toBe(false);
    expect(handle.current?.getLayout()?.visibleIds).toEqual(["editor"]);
  });

  it("supports controlled pane visibility", () => {
    const { rerender } = render(
      <div style={{ height: 400, width: 800 }}>
        <SplitView>
          <Pane id="left" defaultSize={240} visible={false}>
            Left
          </Pane>
          <Pane id="editor" defaultSize="1fr">
            Editor
          </Pane>
        </SplitView>
      </div>,
    );

    expect(screen.queryByText("Left")).toBeNull();
    expect(screen.getByText("Editor")).toBeTruthy();

    rerender(
      <div style={{ height: 400, width: 800 }}>
        <SplitView>
          <Pane id="left" defaultSize={240} visible>
            Left
          </Pane>
          <Pane id="editor" defaultSize="1fr">
            Editor
          </Pane>
        </SplitView>
      </div>,
    );

    expect(screen.getByText("Left")).toBeTruthy();
  });

  it("renders sash and collapsed boundary injection points", () => {
    const handle = createRef<SplitViewHandle>();

    render(
      <div style={{ height: 400, width: 800 }}>
        <SplitView
          ref={handle}
          renderCollapsedPane={(info) => <span>restore-{info.id}</span>}
          renderSash={(info) => <span>sash-{info.beforeId}</span>}
        >
          <Pane id="left" defaultSize={300}>
            Left
          </Pane>
          <Pane id="editor" defaultSize="1fr">
            Editor
          </Pane>
        </SplitView>
      </div>,
    );

    expect(screen.getByText("sash-left")).toBeTruthy();

    act(() => handle.current?.collapsePane("left"));

    expect(screen.getByText("restore-left")).toBeTruthy();
  });
});
