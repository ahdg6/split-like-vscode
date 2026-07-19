import { describe, expect, it } from "vitest";

import {
  createPublicValueSnapshot,
  normalizeLayout,
  toCoreValue,
  toCoreValueSnapshot,
  toPublicValue,
  type WorkbenchValue,
} from "./workbench-model";

describe("workbench model", () => {
  it("round-trips runtime values with stable part names", () => {
    const publicValue: WorkbenchValue = {
      activeByPart: {
        panel: "terminal",
        primary: "explorer",
        secondary: "inspector",
      },
      activeEditorTabs: {
        left: "workbench",
      },
      version: 1,
      visibleParts: {
        panel: true,
        primary: true,
        secondary: false,
      },
    };

    const coreValue = toCoreValue(publicValue);
    expect(coreValue.activeByPart).toEqual({
      panel: "terminal",
      primary: "explorer",
      secondary: "inspector",
    });
    expect(toPublicValue(coreValue, publicValue.activeEditorTabs)).toEqual(publicValue);
  });

  it("normalizes current layout snapshots", () => {
    const layout = normalizeLayout(
      {
        areaSizes: {
          center: {
            "workbench:editor": 420,
          },
        },
        value: {
          activeByPart: {
            primary: "explorer",
          },
          activeEditorTabs: {
            left: "workbench",
          },
          version: 1,
          visibleParts: {
            primary: true,
          },
        },
      },
      undefined,
      "right",
    );

    expect(layout).toEqual({
      areaSizes: {
        center: {
          "workbench:editor": 420,
        },
        editorGroups: undefined,
        workbench: undefined,
      },
      panelPosition: "right",
      value: {
        activeByPart: {
          primary: "explorer",
        },
        activeEditorTabs: {
          left: "workbench",
        },
        version: 1,
        visibleParts: {
          primary: true,
        },
      },
      version: 1,
    });
  });

  it("keeps persisted value snapshots partial for forward-compatible restore", () => {
    expect(
      createPublicValueSnapshot(
        {
          activeByPart: {
            panel: "terminal",
            primary: "explorer",
          },
          version: 1,
          visibleParts: {
            panel: true,
            primary: true,
            secondary: false,
          },
        },
        { main: "editor" },
      ),
    ).toEqual({
      activeByPart: {
        panel: "terminal",
        primary: "explorer",
      },
      activeEditorTabs: {
        main: "editor",
      },
      version: 1,
      visibleParts: {
        panel: true,
        primary: true,
        secondary: false,
      },
    });

    expect(
      toCoreValueSnapshot({
        activeByPart: {
          primary: "explorer",
        },
        version: 1,
      }),
    ).toEqual({
      activeByPart: {
        primary: "explorer",
      },
      version: 1,
      visibleParts: undefined,
    });
  });

  it("drops malformed persisted state instead of leaking it into runtime layout", () => {
    const layout = normalizeLayout(
      {
        areaSizes: {
          center: {
            invalid: Number.NaN,
            negative: -20,
            valid: 240,
          },
        },
        value: {
          activeByPart: { primary: 42 as unknown as string },
          version: 1,
          visibleParts: { primary: "yes" as unknown as boolean },
        },
      },
      undefined,
      "bottom",
    );

    expect(layout.areaSizes?.center).toEqual({ valid: 240 });
    expect(layout.value.activeByPart).toBeUndefined();
    expect(layout.value.visibleParts).toBeUndefined();
  });
});
