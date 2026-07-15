export type WorkbenchPart = "primary" | "secondary" | "panel";

export interface WorkbenchViewDescriptor {
  id: string;
  part: WorkbenchPart;
  title?: string;
  order?: number;
  defaultActive?: boolean;
  defaultVisible?: boolean;
}

export interface WorkbenchValue {
  version: 1;
  activeByPart: Partial<Record<WorkbenchPart, string>>;
  visibleParts: Record<WorkbenchPart, boolean>;
}

export interface WorkbenchValueSnapshot {
  version: 1;
  activeByPart?: Partial<Record<WorkbenchPart, string>> | undefined;
  visibleParts?: Partial<Record<WorkbenchPart, boolean>> | undefined;
}

export const WORKBENCH_PARTS: readonly WorkbenchPart[] = ["primary", "secondary", "panel"];

const EMPTY_VISIBLE_PARTS: Record<WorkbenchPart, boolean> = {
  panel: false,
  primary: false,
  secondary: false,
};

export function createWorkbenchValue(
  views: readonly WorkbenchViewDescriptor[],
  snapshot?: WorkbenchValueSnapshot | null,
): WorkbenchValue {
  const orderedViews = orderViews(views);
  const activeByPart: Partial<Record<WorkbenchPart, string>> = {};
  const visibleParts = { ...EMPTY_VISIBLE_PARTS };

  for (const part of WORKBENCH_PARTS) {
    const partViews = orderedViews.filter((view) => view.part === part);
    const restoredActive = snapshot?.activeByPart?.[part];
    const active =
      findView(partViews, restoredActive) ??
      partViews.find((view) => view.defaultActive) ??
      partViews[0];

    if (active) {
      activeByPart[part] = active.id;
      visibleParts[part] = snapshot?.visibleParts?.[part] ?? active.defaultVisible !== false;
    }
  }

  return { activeByPart, version: 1, visibleParts };
}

export function activateWorkbenchView(
  views: readonly WorkbenchViewDescriptor[],
  value: WorkbenchValue,
  viewId: string,
  visible = true,
): WorkbenchValue {
  const view = views.find((item) => item.id === viewId);
  if (!view) {
    return value;
  }

  return {
    ...value,
    activeByPart: { ...value.activeByPart, [view.part]: view.id },
    visibleParts: { ...value.visibleParts, [view.part]: visible },
  };
}

export function setWorkbenchPartVisibility(
  value: WorkbenchValue,
  part: WorkbenchPart,
  visible: boolean,
): WorkbenchValue {
  if (value.visibleParts[part] === visible) {
    return value;
  }
  return { ...value, visibleParts: { ...value.visibleParts, [part]: visible } };
}

export function toggleWorkbenchPart(
  views: readonly WorkbenchViewDescriptor[],
  value: WorkbenchValue,
  part: WorkbenchPart,
): WorkbenchValue {
  const activeId = value.activeByPart[part];
  const fallback = orderViews(views).find((view) => view.part === part);
  if (!activeId && !fallback) {
    return value;
  }

  return {
    ...value,
    activeByPart: activeId ? value.activeByPart : { ...value.activeByPart, [part]: fallback?.id },
    visibleParts: { ...value.visibleParts, [part]: !value.visibleParts[part] },
  };
}

export function getActiveWorkbenchView(
  views: readonly WorkbenchViewDescriptor[],
  value: WorkbenchValue,
  part: WorkbenchPart,
): WorkbenchViewDescriptor | undefined {
  return (
    findView(views, value.activeByPart[part]) ??
    orderViews(views).find((view) => view.part === part)
  );
}

export function createWorkbenchValueSnapshot(value: WorkbenchValue): WorkbenchValueSnapshot {
  return {
    activeByPart: { ...value.activeByPart },
    version: 1,
    visibleParts: { ...value.visibleParts },
  };
}

function orderViews(views: readonly WorkbenchViewDescriptor[]): WorkbenchViewDescriptor[] {
  return views.toSorted((left, right) => {
    const order = (left.order ?? 0) - (right.order ?? 0);
    return order === 0 ? left.id.localeCompare(right.id) : order;
  });
}

function findView(
  views: readonly WorkbenchViewDescriptor[],
  id: string | undefined,
): WorkbenchViewDescriptor | undefined {
  return id ? views.find((view) => view.id === id) : undefined;
}
