import {
  WORKBENCH_PARTS,
  createSplitSizeSnapshot,
  type SplitLayout,
  type WorkbenchPart,
  type WorkbenchValue as CoreWorkbenchValue,
  type WorkbenchValueSnapshot as CoreWorkbenchValueSnapshot,
} from "@worksplit/core";

export { WORKBENCH_PARTS } from "@worksplit/core";
export type { WorkbenchPart } from "@worksplit/core";

export type WorkbenchPanelPosition = "bottom" | "right";

export interface WorkbenchValue {
  version: 1;
  activeByPart: Partial<Record<WorkbenchPart, string>>;
  activeEditorTabs: Record<string, string>;
  visibleParts: Record<WorkbenchPart, boolean>;
}

export interface WorkbenchValueSnapshot {
  version: 1;
  activeByPart?: Partial<Record<WorkbenchPart, string>> | undefined;
  activeEditorTabs?: Record<string, string> | undefined;
  visibleParts?: Partial<Record<WorkbenchPart, boolean>> | undefined;
}

export interface WorkbenchAreaSizeSnapshot {
  workbench?: Record<string, number> | undefined;
  center?: Record<string, number> | undefined;
  editorGroups?: Record<string, number> | undefined;
}

export type WorkbenchAreaLayoutId = "workbench" | "center" | "editorGroups";

export interface WorkbenchLayout {
  version: 1;
  value: WorkbenchValueSnapshot;
  panelPosition: WorkbenchPanelPosition;
  areaSizes?: WorkbenchAreaSizeSnapshot;
}

export function readStartupLayout(
  layoutStorageKey: string | undefined,
  defaultLayout: WorkbenchLayout | undefined,
  defaultValue: WorkbenchValueSnapshot | undefined,
  defaultPanelPosition: WorkbenchPanelPosition,
): WorkbenchLayout {
  const fallback = normalizeLayout(defaultLayout, defaultValue, defaultPanelPosition);
  if (!layoutStorageKey || typeof window === "undefined") {
    return fallback;
  }

  const stored = window.localStorage.getItem(layoutStorageKey);
  if (!stored) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<WorkbenchLayout>;
    if (parsed.version === 1 && parsed.value) {
      return normalizeLayout(parsed, defaultValue, defaultPanelPosition);
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export function normalizeLayout(
  layout: Partial<WorkbenchLayout> | undefined,
  defaultValue: WorkbenchValueSnapshot | undefined,
  defaultPanelPosition: WorkbenchPanelPosition,
): WorkbenchLayout {
  return {
    panelPosition: isPanelPosition(layout?.panelPosition)
      ? layout.panelPosition
      : defaultPanelPosition,
    areaSizes: normalizeAreaSizeSnapshot(layout?.areaSizes),
    version: 1,
    value: normalizeValueSnapshot(layout?.value ?? defaultValue),
  };
}

export function toCoreValue(value: WorkbenchValue): CoreWorkbenchValue {
  return {
    activeByPart: { ...value.activeByPart },
    version: 1,
    visibleParts: { ...value.visibleParts },
  };
}

export function toCoreValueSnapshot(value: WorkbenchValueSnapshot): CoreWorkbenchValueSnapshot {
  return {
    activeByPart: value.activeByPart ? { ...value.activeByPart } : undefined,
    version: 1,
    visibleParts: value.visibleParts ? { ...value.visibleParts } : undefined,
  };
}

export function toPublicValue(
  value: CoreWorkbenchValue,
  activeEditorTabs: Record<string, string>,
): WorkbenchValue {
  return {
    activeByPart: { ...value.activeByPart },
    activeEditorTabs: { ...activeEditorTabs },
    version: 1,
    visibleParts: { ...value.visibleParts },
  };
}

export function createPublicValueSnapshot(
  value: CoreWorkbenchValue,
  activeEditorTabs: Record<string, string>,
): WorkbenchValueSnapshot {
  return {
    activeByPart: { ...value.activeByPart },
    activeEditorTabs: { ...activeEditorTabs },
    version: 1,
    visibleParts: { ...value.visibleParts },
  };
}

export function normalizeValueSnapshot(
  value: WorkbenchValueSnapshot | undefined,
): WorkbenchValueSnapshot {
  if (!value) {
    return { version: 1 };
  }

  return {
    activeByPart: readPartSnapshot(value.activeByPart),
    activeEditorTabs: sanitizeActiveEditorTabs(value.activeEditorTabs),
    version: 1,
    visibleParts: readPartSnapshot(value.visibleParts),
  };
}

export function sameWorkbenchValue(left: CoreWorkbenchValue, right: CoreWorkbenchValue): boolean {
  return WORKBENCH_PARTS.every(
    (part) =>
      left.activeByPart[part] === right.activeByPart[part] &&
      left.visibleParts[part] === right.visibleParts[part],
  );
}

export function sameStringRecord(left: Record<string, string>, right: Record<string, string>) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) => left[key] === right[key]);
}

export function readCurrentAreaSizes(
  workbenchLayout: SplitLayout | null,
  centerLayout: SplitLayout | null,
  editorGroupsLayout: SplitLayout | null,
  fallback: WorkbenchAreaSizeSnapshot,
): WorkbenchAreaSizeSnapshot {
  return {
    center: centerLayout ? createSplitSizeSnapshot(centerLayout) : fallback.center,
    editorGroups: editorGroupsLayout
      ? createSplitSizeSnapshot(editorGroupsLayout)
      : fallback.editorGroups,
    workbench: workbenchLayout ? createSplitSizeSnapshot(workbenchLayout) : fallback.workbench,
  };
}

export function cloneAreaSizeSnapshot(
  snapshot: WorkbenchAreaSizeSnapshot,
): WorkbenchAreaSizeSnapshot {
  return {
    center: snapshot.center ? { ...snapshot.center } : undefined,
    editorGroups: snapshot.editorGroups ? { ...snapshot.editorGroups } : undefined,
    workbench: snapshot.workbench ? { ...snapshot.workbench } : undefined,
  };
}

function sanitizeActiveEditorTabs(
  value: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const next: Record<string, string> = {};
  for (const [groupId, tabId] of Object.entries(value)) {
    if (typeof tabId === "string") {
      next[groupId] = tabId;
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function readPartSnapshot<T>(
  value: Partial<Record<WorkbenchPart, T>> | undefined,
): Partial<Record<WorkbenchPart, T>> | undefined {
  if (!value) {
    return undefined;
  }

  const next: Partial<Record<WorkbenchPart, T>> = {};
  for (const part of WORKBENCH_PARTS) {
    const item = value[part];
    if (item !== undefined) {
      next[part] = item;
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function normalizeAreaSizeSnapshot(
  snapshot: WorkbenchAreaSizeSnapshot | undefined,
): WorkbenchAreaSizeSnapshot {
  if (!snapshot) {
    return {};
  }

  return {
    center: snapshot.center ? { ...snapshot.center } : undefined,
    editorGroups: snapshot.editorGroups ? { ...snapshot.editorGroups } : undefined,
    workbench: snapshot.workbench ? { ...snapshot.workbench } : undefined,
  };
}

function isPanelPosition(value: unknown): value is WorkbenchPanelPosition {
  return value === "bottom" || value === "right";
}
