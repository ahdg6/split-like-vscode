import {
  IconArticle,
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconBackward,
  IconBolt,
  IconBold,
  IconBranch,
  IconBriefcase,
  IconClose,
  IconCode,
  IconColumnsStroked,
  IconEdit,
  IconFile,
  IconFolderOpen,
  IconForward,
  IconGridSquare,
  IconH1,
  IconH2,
  IconItalic,
  IconList,
  IconLink,
  IconMoon,
  IconOrderedList,
  IconPlay,
  IconPlus,
  IconQuote,
  IconRefresh,
  IconRowsStroked,
  IconSave,
  IconSearch,
  IconServer,
  IconSetting,
  IconStop,
  IconStrikeThrough,
  IconSun,
  IconTerminal,
  IconUnderline,
  IconUnlink,
  IconUndo,
  IconRedo,
  IconUser,
  IconWrench,
} from "@douyinfe/semi-icons";
import {
  AIChatInput,
  Badge,
  Button,
  Card,
  Chat,
  ConfigProvider,
  Descriptions,
  Divider,
  Empty,
  Input,
  List,
  MarkdownRender,
  Popover,
  Progress,
  Select,
  Space,
  Switch,
  TabPane,
  Tabs,
  Tag,
  TextArea,
  Timeline,
  Toast,
  Tooltip,
  Tree,
  Typography,
} from "@douyinfe/semi-ui";
import type { MessageContent, Reference } from "@douyinfe/semi-ui/lib/es/aiChatInput/interface";
import type { Message } from "@douyinfe/semi-ui/lib/es/chat/interface";
import { Extension } from "@tiptap/core";
import { Link } from "@tiptap/extension-link";
import { TableKit } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { Underline } from "@tiptap/extension-underline";
import { Markdown } from "@tiptap/markdown";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import { StarterKit } from "@tiptap/starter-kit";
import {
  Workbench,
  type WorkbenchActivityItemRenderInfo,
  type WorkbenchEditorGroup,
  type WorkbenchHandle,
  type WorkbenchPart,
  type WorkbenchView,
} from "@worksplit/react";
import {
  StrictMode,
  Suspense,
  type ReactNode,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";

import "@douyinfe/semi-ui/dist/css/semi.min.css";
import "@worksplit/react/style.css";
import "./styles.css";

const { Text, Title } = Typography;
const { Configure } = AIChatInput;
const ReadonlyFileViewer = lazy(() => import("./ReadonlyFileViewer"));

type ThemeMode = "light" | "dark";
type TabResource =
  | {
      kind: "file";
      id: string;
    }
  | {
      kind: "session";
      id: string;
    };

interface MarkdownFile {
  kind: "markdown";
  id: string;
  name: string;
  path: string;
  content: string;
}

interface PreviewFile {
  description: string;
  kind: "preview";
  id: string;
  mimeType: string;
  name: string;
  path: string;
  size: string;
  sourceUrl: string;
  viewerType: string;
}

type WorkspaceFile = MarkdownFile | PreviewFile;

interface AiSession {
  branch: string;
  id: string;
  messages: Message[];
  status: "active" | "waiting" | "done";
  title: string;
}

interface ShortTaskProposal {
  from: number;
  id: string;
  next: string;
  original: string;
  title: string;
  to: number;
}

interface FloatingQuote {
  fileName: string;
  filePath: string;
  id: string;
  text: string;
}

const inlineDiffPluginKey = new PluginKey<ShortTaskProposal | null>("inline-diff");

const InlineDiffExtension = Extension.create({
  name: "inlineDiff",
  addProseMirrorPlugins() {
    return [
      new Plugin<ShortTaskProposal | null>({
        key: inlineDiffPluginKey,
        props: {
          decorations(state) {
            const proposal = inlineDiffPluginKey.getState(state);
            if (!proposal) {
              return null;
            }

            const docEnd = state.doc.content.size;
            const from = Math.max(0, Math.min(proposal.from, docEnd));
            const to = Math.max(from, Math.min(proposal.to, docEnd));
            if (from === to) {
              return null;
            }

            const suggestion = document.createElement("span");
            suggestion.className = "inlineDiffAdded";
            suggestion.textContent = proposal.next;
            suggestion.setAttribute("aria-label", "润色建议");

            return DecorationSet.create(state.doc, [
              Decoration.inline(from, to, { class: "inlineDiffRemoved" }),
              Decoration.widget(to, suggestion, { side: 1 }),
            ]);
          },
        },
        state: {
          init: () => null,
          apply(transaction, current) {
            const meta = transaction.getMeta(inlineDiffPluginKey) as
              | ShortTaskProposal
              | null
              | undefined;
            if (meta !== undefined) {
              return meta;
            }
            if (transaction.docChanged) {
              return null;
            }
            return current;
          },
        },
      }),
    ];
  },
});

const workspaceFilesSeed: WorkspaceFile[] = [
  {
    kind: "markdown",
    id: "session-md",
    name: "session.md",
    path: "workspace/session.md",
    content: `# pi 工作区草稿

这是一份前端 Markdown 工作区示例。左侧的 \`.md\` 文件可以点开成编辑标签页；AI session 也会作为独立标签页打开。

## 当前状态

- 模型: pi-api/gpt-4.1
- 工作区: /workspace/pluxel
- 模式: 计划 + 应用

| 步骤 | 工具 | 状态 |
| --- | --- | --- |
| 1 | inspect_workspace | done |
| 2 | edit_markdown | active |
| 3 | run_tests | queued |

## 工具备注

\`\`\`json
{
  "tool": "edit_file",
  "path": "workspace/session.md",
  "dryRun": true
}
\`\`\`
`,
  },
  {
    kind: "markdown",
    id: "handoff-md",
    name: "handoff.md",
    path: "workspace/docs/handoff.md",
    content: `# 交接说明

## 目标

- Markdown 编辑保持本地、可回退。
- AI 对话作为工作区资源打开，而不是侧栏里的噪音。
- 工具、审批、上下文、运行状态放到检查器或会话区域。

## 后续 API 形态

| 界面 | 后端来源 |
| --- | --- |
| files | workspace tree |
| sessions | pi conversation runs |
| tools | pi tool registry |
`,
  },
  {
    kind: "markdown",
    id: "tool-plan-md",
    name: "tool-plan.md",
    path: "workspace/docs/tool-plan.md",
    content: `# 工具调用计划

1. 读取当前 Markdown 文件。
2. 生成补丁草案。
3. 等待用户确认。
4. 应用并验证。
`,
  },
  {
    description: "多页 Word 提案，包含段落、表格和分页，用于验证文档阅读、搜索、缩放、打印和导出。",
    id: "proposal-docx",
    kind: "preview",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    name: "proposal.docx",
    path: "workspace/office/proposal.docx",
    size: "3.0 KB",
    sourceUrl: "/sample-files/proposal.docx",
    viewerType: "docx",
  },
  {
    description: "多工作表 Excel 示例，包含 Pipeline、Forecast、Risks 三个 sheet 和简单公式。",
    id: "pipeline-xlsx",
    kind: "preview",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    name: "pipeline.xlsx",
    path: "workspace/office/pipeline.xlsx",
    size: "4.4 KB",
    sourceUrl: "/sample-files/pipeline.xlsx",
    viewerType: "xlsx",
  },
  {
    description: "PowerPoint 演示示例，用于验证常用办公幻灯片预览。",
    id: "handoff-pptx",
    kind: "preview",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    name: "handoff.pptx",
    path: "workspace/office/handoff.pptx",
    size: "2.3 KB",
    sourceUrl: "/sample-files/handoff.pptx",
    viewerType: "pptx",
  },
  {
    description: "四页 PDF 运营复盘，用于验证多页阅读、搜索、缩放、打印和导出。",
    id: "runbook-pdf",
    kind: "preview",
    mimeType: "application/pdf",
    name: "runbook.pdf",
    path: "workspace/docs/runbook.pdf",
    size: "2.2 KB",
    sourceUrl: "/sample-files/runbook.pdf",
    viewerType: "pdf",
  },
];

const sessionsSeed: AiSession[] = [
  {
    branch: "main",
    id: "run-7142",
    messages: [
      {
        content: "已载入 workspace/session.md。你可以直接编辑文件，或让我生成补丁计划。",
        createAt: Date.now() - 1000 * 60 * 4,
        id: "assistant-1",
        role: "assistant",
        status: "complete",
      },
      {
        content: "把 Markdown 表格里的 queued 步骤补成实际验证命令。",
        createAt: Date.now() - 1000 * 60 * 2,
        id: "user-1",
        role: "user",
        status: "complete",
      },
    ],
    status: "active",
    title: "重构 Markdown 工作区",
  },
  {
    branch: "research",
    id: "run-7138",
    messages: [
      {
        content: "我在比较 pi-web 的资源模型：文件、会话、工具调用都应该能作为工作区对象打开。",
        createAt: Date.now() - 1000 * 60 * 8,
        id: "assistant-7138",
        role: "assistant",
        status: "complete",
      },
    ],
    status: "waiting",
    title: "比较 pi-web 工作台布局",
  },
];

const toolCalls = [
  {
    args: '{ "path": "workspace/session.md" }',
    name: "read_file",
    status: "done",
    time: "128 ms",
  },
  {
    args: '{ "path": "workspace/session.md", "patch": "..." }',
    name: "apply_patch",
    status: "draft",
    time: "local",
  },
  {
    args: '{ "cmd": "pnpm --filter @worksplit/app typecheck" }',
    name: "shell.exec",
    status: "queued",
    time: "pending",
  },
];

const emptyResource: TabResource = { id: "empty", kind: "file" };

function App() {
  const workbenchRef = useRef<WorkbenchHandle>(null);
  const lastPrimaryViewRef = useRef("workspace");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [toolsPart, setToolsPart] = useState<WorkbenchPart>("panel");
  const [files, setFiles] = useState<WorkspaceFile[]>(workspaceFilesSeed);
  const [sessions, setSessions] = useState(sessionsSeed);
  const [openTabs, setOpenTabs] = useState<TabResource[]>([
    { id: "session-md", kind: "file" },
    { id: "run-7142", kind: "session" },
  ]);
  const [activeTabId, setActiveTabId] = useState("file:session-md");

  useEffect(() => {
    document.body.setAttribute("theme-mode", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      workbenchRef.current?.activateEditorTab("main", activeTabId);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTabId, openTabs]);

  const openResource = useCallback((resource: TabResource) => {
    const tabId = createTabId(resource);
    setOpenTabs((current) =>
      current.some((item) => createTabId(item) === tabId) ? current : [...current, resource],
    );
    setActiveTabId(tabId);
  }, []);

  const closeResource = useCallback(
    (tabId: string) => {
      setOpenTabs((current) => {
        if (current.length <= 1) {
          setActiveTabId("file:empty");
          return [];
        }

        const index = current.findIndex((item) => createTabId(item) === tabId);
        const next = current.filter((item) => createTabId(item) !== tabId);
        if (activeTabId === tabId) {
          const fallback = next[Math.max(0, index - 1)] ?? next[0];
          if (fallback) {
            setActiveTabId(createTabId(fallback));
          }
        }
        return next;
      });
    },
    [activeTabId],
  );

  const createMarkdownFile = useCallback(() => {
    const id = `note-${Date.now()}`;
    setFiles((current) => {
      const serial = current.filter((file) => file.kind === "markdown").length + 1;
      const file: MarkdownFile = {
        content: `# Untitled ${serial}\n\n`,
        id,
        kind: "markdown",
        name: `untitled-${serial}.md`,
        path: `workspace/docs/untitled-${serial}.md`,
      };
      return [...current, file];
    });
    openResource({ id, kind: "file" });
  }, [openResource]);

  const updateFile = useCallback((id: string, content: string) => {
    setFiles((current) =>
      current.map((file) =>
        file.id === id && file.kind === "markdown" ? { ...file, content } : file,
      ),
    );
  }, []);

  const updateSessionMessages = useCallback((id: string, messages: Message[]) => {
    setSessions((current) =>
      current.map((session) => (session.id === id ? { ...session, messages } : session)),
    );
  }, []);

  const views = useMemo<WorkbenchView[]>(
    () => [
      {
        defaultActive: true,
        icon: <IconBriefcase />,
        id: "workspace",
        order: 10,
        part: "primary",
        renderContent: () => (
          <WorkspacePanel
            activeTabId={activeTabId}
            files={files}
            onCreateFile={createMarkdownFile}
            onOpenFile={(id) => openResource({ id, kind: "file" })}
            onOpenSession={(id) => openResource({ id, kind: "session" })}
            sessions={sessions}
          />
        ),
        title: "工作区",
      },
      {
        icon: <IconSearch />,
        id: "search",
        order: 20,
        part: "primary",
        renderContent: () => (
          <SearchPanel
            files={files}
            onCreateFile={createMarkdownFile}
            onOpenFile={(id) => openResource({ id, kind: "file" })}
          />
        ),
        title: "搜索",
      },
      {
        defaultActive: true,
        icon: <IconTerminal />,
        id: "events",
        order: 30,
        part: "panel",
        renderContent: () => <EventPanel activeTabId={activeTabId} />,
        title: "事件",
      },
      {
        defaultActive: true,
        icon: <IconWrench />,
        id: "tools",
        order: 40,
        part: toolsPart,
        renderContent: () => <ToolPanel activeTabId={activeTabId} files={files} />,
        title: "工具",
      },
      {
        activityGroup: "footer",
        icon: theme === "dark" ? <IconMoon /> : <IconSun />,
        id: "theme-toggle",
        order: 80,
        part: "primary",
        renderContent: () => null,
        title: theme === "dark" ? "切换到浅色" : "切换到深色",
      },
      {
        activityGroup: "footer",
        icon: <IconSetting />,
        id: "settings",
        order: 90,
        part: "primary",
        renderContent: () => (
          <SettingsPanel
            onThemeChange={setTheme}
            onToolsPartChange={setToolsPart}
            theme={theme}
            toolsPart={toolsPart}
          />
        ),
        title: "设置",
      },
    ],
    [activeTabId, createMarkdownFile, files, openResource, sessions, theme, toolsPart],
  );

  const editorGroups = useMemo<WorkbenchEditorGroup[]>(
    () => [
      {
        defaultActiveTabId: activeTabId,
        id: "main",
        size: { default: "1fr", min: 520 },
        tabs: (openTabs.length > 0 ? openTabs : [emptyResource]).map((resource) => {
          if (resource.id === "empty") {
            return {
              icon: <IconFile />,
              id: createTabId(resource),
              renderContent: () => (
                <EmptyEditor
                  onCreateFile={createMarkdownFile}
                  onOpenFile={(id) => openResource({ id, kind: "file" })}
                  files={files}
                />
              ),
              title: "欢迎",
            };
          }

          if (resource.kind === "file") {
            const file = files.find((item) => item.id === resource.id)!;
            if (file.kind === "preview") {
              return {
                icon: <IconFile />,
                id: createTabId(resource),
                renderContent: () => (
                  <Suspense fallback={<ReadonlyPreviewFallback fileName={file.name} />}>
                    <ReadonlyFileViewer
                      file={file}
                      onOpenFile={(id) => openResource({ id, kind: "file" })}
                      relatedFiles={files.filter((item) => item.kind === "preview")}
                      theme={theme}
                    />
                  </Suspense>
                ),
                title: file.name,
              };
            }

            return {
              icon: <IconEdit />,
              id: createTabId(resource),
              renderContent: () => <MarkdownFileEditor file={file} onChange={updateFile} />,
              title: file.name,
            };
          }

          const session = sessions.find((item) => item.id === resource.id)!;
          return {
            icon: <IconBolt />,
            id: createTabId(resource),
            renderContent: () => (
              <AiSessionEditor
                onMessagesChange={(messages) => updateSessionMessages(session.id, messages)}
                session={session}
              />
            ),
            title: session.title,
          };
        }),
      },
    ],
    [
      activeTabId,
      createMarkdownFile,
      files,
      openResource,
      openTabs,
      sessions,
      theme,
      updateFile,
      updateSessionMessages,
    ],
  );

  const renderActivityItem = useCallback((info: WorkbenchActivityItemRenderInfo) => {
    if (info.view.id !== "theme-toggle") {
      return info.icon ?? <span>{(info.view.title ?? info.view.id).slice(0, 1)}</span>;
    }

    return (
      <Tooltip content={info.view.title ?? "切换主题"} position="right">
        <span className="activityThemeToggle">{info.icon}</span>
      </Tooltip>
    );
  }, []);

  return (
    <ConfigProvider>
      <Workbench
        ref={workbenchRef}
        className="piShell"
        defaultPanelPosition="bottom"
        defaultValue={{
          activeByPart: { panel: "tools", primary: "workspace", secondary: "tools" },
          activeEditorTabs: { main: activeTabId },
          version: 1,
          visibleParts: { panel: false, primary: true, secondary: false },
        }}
        editorGroups={editorGroups}
        layoutStorageKey="pi-web-md-workspace-layout-v4"
        onValueChange={(value) => {
          const next = value.activeEditorTabs.main;
          if (next) {
            setActiveTabId(next);
          }
          const primaryView = value.activeByPart.primary;
          if (primaryView === "theme-toggle") {
            setTheme((current) => (current === "dark" ? "light" : "dark"));
            window.requestAnimationFrame(() => {
              workbenchRef.current?.activateView(lastPrimaryViewRef.current);
            });
          } else if (primaryView) {
            lastPrimaryViewRef.current = primaryView;
          }
        }}
        partSizes={{
          panel: { default: 210, max: 380, min: 150 },
          primary: { default: 280, max: 420, min: 220 },
          secondary: { default: 340, max: 480, min: 280 },
        }}
        renderActivityItem={renderActivityItem}
        renderEditorTabLabel={({ active, icon, tab }) => (
          <span className="editorTabLabel">
            {icon}
            <span>{tab.title ?? tab.id}</span>
            {tab.id !== "file:empty" && (
              <Button
                aria-label={`Close ${tab.title ?? tab.id}`}
                className="tabCloseButton"
                icon={<IconClose />}
                onClick={(event) => {
                  event.stopPropagation();
                  closeResource(tab.id);
                }}
                size="small"
                theme="borderless"
                type={active ? "tertiary" : "tertiary"}
              />
            )}
          </span>
        )}
        renderPartHeader={({ actions, icon, part, view }) => (
          <PanelHeader icon={icon} onClose={() => actions.hidePart(part)} part={part} view={view} />
        )}
        views={views}
      />
    </ConfigProvider>
  );
}

function WorkspacePanel(props: {
  activeTabId: string;
  files: WorkspaceFile[];
  onCreateFile(): void;
  onOpenFile(id: string): void;
  onOpenSession(id: string): void;
  sessions: AiSession[];
}) {
  const selectedKey = props.activeTabId.startsWith("file:")
    ? props.activeTabId.replace("file:", "")
    : props.activeTabId;
  const treeData = [
    {
      icon: <IconFolderOpen />,
      key: "workspace",
      label: "workspace",
      children: [
        {
          icon: <IconFile />,
          key: "session-md",
          label: "session.md",
        },
        {
          icon: <IconFolderOpen />,
          key: "docs",
          label: "docs",
          children: props.files
            .filter((file) => file.kind === "markdown" && file.path.includes("/docs/"))
            .map((file) => ({
              icon: file.kind === "markdown" ? <IconArticle /> : <IconFile />,
              key: file.id,
              label: file.name,
            })),
        },
        {
          icon: <IconFolderOpen />,
          key: "viewer",
          label: "viewer",
          children: props.files
            .filter((file) => file.kind === "preview")
            .map((file) => ({
              icon: <IconFile />,
              key: file.id,
              label: file.name,
            })),
        },
        {
          icon: <IconFolderOpen />,
          key: "tools",
          label: "tools",
          children: [
            {
              disabled: true,
              icon: <IconCode />,
              key: "tools-manifest",
              label: "manifest.json",
            },
          ],
        },
      ],
    },
  ];

  return (
    <div className="panelScroll">
      <div className="panelSearch">
        <Input prefix={<IconSearch />} placeholder="搜索工作区" size="small" />
        <Tooltip content="新建 Markdown 文件">
          <Button
            icon={<IconPlus />}
            onClick={props.onCreateFile}
            size="small"
            theme="borderless"
            type="tertiary"
          />
        </Tooltip>
      </div>

      <section className="navSection">
        <SectionTitle icon={<IconBranch />} title="AI 会话" />
        <List className="resourceList sessionList" size="small" split={false}>
          {props.sessions.map((session) => (
            <List.Item
              className={[
                "resourceListItem",
                props.activeTabId === `session:${session.id}` ? "active" : "",
              ].join(" ")}
              extra={
                <Tag
                  color={
                    session.status === "active"
                      ? "green"
                      : session.status === "waiting"
                        ? "amber"
                        : "grey"
                  }
                  size="small"
                >
                  {session.status}
                </Tag>
              }
              key={session.id}
              main={
                <Space className="resourceListMain" spacing={2} vertical>
                  <Text ellipsis={{ showTooltip: true }} strong>
                    {session.title}
                  </Text>
                  <Text ellipsis={{ showTooltip: true }} size="small" type="tertiary">
                    {session.id} · {session.branch}
                  </Text>
                </Space>
              }
              onClick={() => props.onOpenSession(session.id)}
            />
          ))}
        </List>
      </section>

      <section className="navSection">
        <SectionTitle icon={<IconFolderOpen />} title="工作区文件" />
        <Tree
          blockNode
          className="workspaceTree"
          defaultExpandedKeys={["workspace", "docs", "viewer", "tools"]}
          directory
          filterTreeNode
          labelEllipsis
          onSelect={(treeKey) => {
            const file = props.files.find((item) => item.id === treeKey);
            if (file) {
              props.onOpenFile(file.id);
            }
          }}
          searchPlaceholder="筛选文件"
          showLine
          treeData={treeData}
          value={selectedKey}
        />
      </section>

      <section className="navSection">
        <SectionTitle icon={<IconArticle />} title="上下文" />
        <div className="contextBox">
          <Tag color="blue" size="small">
            app/
          </Tag>
          <Tag color="teal" size="small">
            packages/react
          </Tag>
          <Tag color="grey" size="small">
            local mock
          </Tag>
        </div>
      </section>
    </div>
  );
}

function SearchPanel(props: {
  files: WorkspaceFile[];
  onCreateFile(): void;
  onOpenFile(id: string): void;
}) {
  return (
    <div className="panelScroll">
      <div className="panelSearch">
        <Input prefix={<IconSearch />} placeholder="搜索工作区文件" size="small" />
        <Button
          icon={<IconPlus />}
          onClick={props.onCreateFile}
          size="small"
          theme="borderless"
          type="tertiary"
        />
      </div>
      <List className="resourceList searchList" size="small" split={false}>
        {props.files.map((file) => (
          <List.Item
            className="resourceListItem"
            extra={
              <Tag color={file.kind === "markdown" ? "blue" : "teal"} size="small">
                {file.kind === "markdown" ? "md" : file.viewerType}
              </Tag>
            }
            key={file.id}
            main={
              <Space className="resourceListMain" spacing={2} vertical>
                <Text ellipsis={{ showTooltip: true }} strong>
                  {file.name}
                </Text>
                <Text ellipsis={{ showTooltip: true }} size="small" type="tertiary">
                  {file.path}
                </Text>
              </Space>
            }
            onClick={() => props.onOpenFile(file.id)}
          />
        ))}
      </List>
    </div>
  );
}

function MarkdownFileEditor(props: {
  file: MarkdownFile;
  onChange(id: string, content: string): void;
}) {
  const [documentMode, setDocumentMode] = useState("edit");
  const [markdownDraft, setMarkdownDraft] = useState(props.file.content);
  const [lastSaved, setLastSaved] = useState("unsaved");
  const [floatingQuote, setFloatingQuote] = useState<FloatingQuote | null>(null);
  const [shortTaskProposal, setShortTaskProposal] = useState<ShortTaskProposal | null>(null);
  const [, refreshEditorState] = useState(0);
  const extensions = useMemo(
    () => [
      StarterKit,
      Link.configure({
        autolink: true,
        defaultProtocol: "https",
        linkOnPaste: true,
        openOnClick: false,
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TableKit.configure({
        table: { resizable: true },
      }),
      Markdown.configure({
        indentation: { size: 2, style: "space" },
      }),
      InlineDiffExtension,
    ],
    [],
  );
  const editor = useEditor({
    content: props.file.content,
    contentType: "markdown",
    editorProps: {
      attributes: {
        "aria-label": `${props.file.name} 编辑器`,
        class: "proseEditor",
      },
    },
    extensions,
    immediatelyRender: false,
    onSelectionUpdate: () => refreshEditorState((current) => current + 1),
    onUpdate: ({ editor: activeEditor }) => {
      const next = activeEditor.getMarkdown();
      setMarkdownDraft(next);
      props.onChange(props.file.id, next);
      setLastSaved("unsaved");
      setShortTaskProposal(null);
    },
  });

  useEffect(() => {
    setMarkdownDraft(props.file.content);
    setLastSaved("unsaved");
    if (editor && editor.getMarkdown() !== props.file.content) {
      editor.commands.setContent(props.file.content, {
        contentType: "markdown",
        emitUpdate: false,
      });
    }
  }, [editor, props.file.content, props.file.id]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.view.dispatch(editor.state.tr.setMeta(inlineDiffPluginKey, shortTaskProposal));
  }, [editor, shortTaskProposal]);

  const applyMarkdown = useCallback(() => {
    editor?.commands.setContent(markdownDraft, { contentType: "markdown" });
    props.onChange(props.file.id, markdownDraft);
  }, [editor, markdownDraft, props]);

  const save = useCallback(() => {
    setLastSaved(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    Toast.success(`${props.file.name} 已本地保存`);
  }, [props.file.name]);

  const createPolishProposal = useCallback(() => {
    if (!editor) {
      return;
    }
    const { from, to, empty } = editor.state.selection;
    const original = editor.state.doc.textBetween(from, to, "\n");
    if (empty || !original.trim()) {
      Toast.warning("先选中一段需要润色的文本");
      return;
    }
    setShortTaskProposal({
      from,
      id: `polish-${Date.now()}`,
      next: createPolishedDraft(original),
      original,
      title: "润色选区",
      to,
    });
  }, [editor]);

  const createFloatingQuote = useCallback(() => {
    if (!editor) {
      return;
    }
    const { from, to, empty } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, "\n");
    if (empty || !text.trim()) {
      Toast.warning("先选中一段要引用的文本");
      return;
    }
    setFloatingQuote({
      fileName: props.file.name,
      filePath: props.file.path,
      id: `quote-${Date.now()}`,
      text,
    });
  }, [editor, props.file.name, props.file.path]);

  const applyShortTaskProposal = useCallback(() => {
    if (!editor || !shortTaskProposal) {
      return;
    }
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: shortTaskProposal.from, to: shortTaskProposal.to },
        shortTaskProposal.next,
      )
      .run();
    setShortTaskProposal(null);
    setLastSaved("unsaved");
    Toast.success("已应用润色结果");
  }, [editor, shortTaskProposal]);

  return (
    <main className="editorSurface">
      <div className="editorTopbar">
        <div>
          <Title heading={4}>{props.file.name}</Title>
          <Text ellipsis={{ showTooltip: true }} size="small" type="tertiary">
            {props.file.path} · {lastSaved === "unsaved" ? "未保存" : `已保存 ${lastSaved}`}
          </Text>
        </div>
        <div className="topbarActions">
          <Tabs
            activeKey={documentMode}
            className="documentModeTabs"
            onChange={setDocumentMode}
            size="small"
            type="button"
          >
            <TabPane itemKey="edit" tab="编辑" />
            <TabPane itemKey="source" tab="源码" />
            <TabPane itemKey="preview" tab="预览" />
          </Tabs>
          <Button icon={<IconSave />} onClick={save} size="small" theme="solid" type="primary">
            保存
          </Button>
        </div>
      </div>

      <EditorToolbar editor={editor} onApplyMarkdown={applyMarkdown} />

      {shortTaskProposal ? (
        <ShortTaskDiff
          onApply={applyShortTaskProposal}
          onDismiss={() => setShortTaskProposal(null)}
          proposal={shortTaskProposal}
        />
      ) : null}

      <div className="documentBody">
        <section
          className={["editorPane", "richPane", documentMode === "edit" ? "active" : ""].join(" ")}
        >
          {editor && documentMode === "edit" ? (
            <InlineFormatMenu
              editor={editor}
              onPolishSelection={createPolishProposal}
              onQuoteSelection={createFloatingQuote}
            />
          ) : null}
          {editor && documentMode === "edit" ? <QuickInsertMenu editor={editor} /> : null}
          <EditorContent editor={editor} />
        </section>
        <section
          className={["editorPane", "sourcePane", documentMode === "source" ? "active" : ""].join(
            " ",
          )}
        >
          <div className="sourceHeader">
            <Text strong>Markdown 源码</Text>
            <Button
              icon={<IconRefresh />}
              onClick={applyMarkdown}
              size="small"
              theme="borderless"
              type="tertiary"
            >
              应用到编辑器
            </Button>
          </div>
          <TextArea
            autosize={false}
            className="markdownSource"
            onChange={(next) => {
              setMarkdownDraft(next);
              props.onChange(props.file.id, next);
              setLastSaved("unsaved");
            }}
            spellCheck={false}
            value={markdownDraft}
          />
        </section>
        <section
          className={["editorPane", "previewPane", documentMode === "preview" ? "active" : ""].join(
            " ",
          )}
        >
          <MarkdownRender className="markdownPreview" format="md" raw={markdownDraft} />
        </section>
      </div>
      {floatingQuote ? (
        <FloatingSelectionChat onClose={() => setFloatingQuote(null)} quote={floatingQuote} />
      ) : null}
    </main>
  );
}

function ReadonlyPreviewFallback(props: { fileName: string }) {
  return (
    <main className="readonlySurface">
      <div className="readonlyTopbar">
        <div className="readonlyTitle">
          <Title ellipsis={{ showTooltip: true }} heading={5}>
            {props.fileName}
          </Title>
          <Text size="small" type="tertiary">
            加载预览器
          </Text>
        </div>
        <Tag color="grey" size="small">
          loading
        </Tag>
      </div>
      <div className="readonlyPreviewLoading">
        <Progress percent={48} showInfo={false} size="small" />
      </div>
    </main>
  );
}

function EmptyEditor(props: {
  files: WorkspaceFile[];
  onCreateFile(): void;
  onOpenFile(id: string): void;
}) {
  return (
    <main className="emptyEditor">
      <Empty
        className="emptyEditorContent"
        description={
          <Text type="tertiary">
            从工作区文件树打开 Markdown、Office/PDF 预览，创建新笔记，或打开 AI 会话标签页。
          </Text>
        }
        image={<IconArticle />}
        title={<Title heading={4}>未打开编辑器</Title>}
      >
        <div className="emptyActions">
          <Button icon={<IconPlus />} onClick={props.onCreateFile} theme="solid" type="primary">
            新建 Markdown
          </Button>
          {props.files.slice(0, 3).map((file) => (
            <Button key={file.id} onClick={() => props.onOpenFile(file.id)} type="tertiary">
              {file.name}
            </Button>
          ))}
        </div>
      </Empty>
    </main>
  );
}

function AiSessionEditor(props: {
  onMessagesChange(messages: Message[]): void;
  session: AiSession;
}) {
  const [generating, setGenerating] = useState(false);
  const [model, setModel] = useState("pi-api/gpt-4.1");
  const [references, setReferences] = useState<Reference[]>([
    {
      content: "workspace/session.md",
      id: "ref-session-md",
      type: "text",
    },
  ]);

  const sendMessage = useCallback(
    (content: string) => {
      const now = Date.now();
      props.onMessagesChange([
        ...props.session.messages,
        { content, createAt: now, id: `user-${now}`, role: "user", status: "complete" },
        {
          content:
            "模拟回复：\n\n- 读取当前 Markdown 标签页\n- 生成补丁预览\n- 在应用前请求确认\n\n这个会话是中心标签页，后续可以直接接 pi 的事件流。",
          createAt: now + 1,
          id: `assistant-${now}`,
          role: "assistant",
          status: "complete",
        },
      ]);
      setGenerating(true);
      window.setTimeout(() => setGenerating(false), 600);
    },
    [props],
  );

  const handleAiInputSend = useCallback(
    (content: MessageContent) => {
      const text = extractAiInputText(content);
      sendMessage(text || "执行工作区任务");
      setReferences([]);
    },
    [sendMessage],
  );

  const renderConfigureArea = useCallback(
    () => (
      <>
        <Configure.Select
          field="model"
          initValue={model}
          optionList={[
            { label: "pi-api/gpt-4.1", value: "pi-api/gpt-4.1" },
            { label: "pi-api/o4-mini", value: "pi-api/o4-mini" },
            { label: "local/mock-agent", value: "local/mock-agent" },
          ]}
        />
        <Configure.Button field="search" icon={<IconSearch />}>
          联网搜索
        </Configure.Button>
        <Configure.Mcp
          onConfigureButtonClick={() => Toast.info("打开 MCP 注册表")}
          options={[
            { icon: <IconFile />, label: "工作区文件", value: "fs" },
            { icon: <IconWrench />, label: "工具调用", value: "tools" },
          ]}
          showConfigure
        />
        <Configure.RadioButton
          field="mode"
          initValue="balanced"
          options={[
            { label: "快速", value: "fast" },
            { label: "均衡", value: "balanced" },
            { label: "深度", value: "deep" },
          ]}
        />
      </>
    ),
    [model],
  );

  return (
    <main className="sessionSurface">
      <div className="editorTopbar">
        <div>
          <Title heading={4}>{props.session.title}</Title>
          <Text size="small" type="tertiary">
            {props.session.id} · 分支 {props.session.branch} · 会话标签页
          </Text>
        </div>
        <div className="topbarActions">
          <Select
            onChange={(value) => setModel(String(value))}
            optionList={[
              { label: "pi-api/gpt-4.1", value: "pi-api/gpt-4.1" },
              { label: "pi-api/o4-mini", value: "pi-api/o4-mini" },
              { label: "local/mock-agent", value: "local/mock-agent" },
            ]}
            size="small"
            style={{ width: 170 }}
            value={model}
          />
          <Badge count={props.session.status} theme="light" type="primary" />
        </div>
      </div>
      <Descriptions
        className="sessionDescriptions"
        column={3}
        data={[
          { key: "模型", value: <Text ellipsis={{ showTooltip: true }}>{model}</Text> },
          { key: "上下文", value: "3 个 md 文件" },
          { key: "工具", value: "确认模式" },
        ]}
        size="small"
      />
      <Chat
        align="leftAlign"
        chats={props.session.messages}
        className="sessionChat"
        enableUpload={false}
        hints={["总结当前 md", "生成补丁计划", "列出需要的工具调用"]}
        mode="bubble"
        onChatsChange={(nextChats) => props.onMessagesChange(nextChats ?? [])}
        onHintClick={sendMessage}
        onMessageSend={sendMessage}
        placeholder="发送消息到当前 pi 会话..."
        renderInputArea={() => null}
        roleConfig={{
          assistant: { avatar: <IconBolt />, color: "green", name: "pi" },
          system: { avatar: <IconServer />, color: "grey", name: "system" },
          user: { avatar: <IconUser />, color: "blue", name: "you" },
        }}
        sendHotKey="enter"
        showClearContext
      />
      <AIChatInput
        className="sessionInput"
        generating={generating}
        immediatelyRender={false}
        keepSkillAfterSend={false}
        onConfigureChange={(value) => {
          if (typeof value.model === "string") {
            setModel(value.model);
          }
        }}
        onMessageSend={handleAiInputSend}
        onReferenceDelete={(reference) =>
          setReferences((current) => current.filter((item) => item.id !== reference.id))
        }
        onSkillChange={(skill) => Toast.info(`技能：${skill.label ?? skill.value}`)}
        onStopGenerate={() => setGenerating(false)}
        placeholder="询问 pi、引用文件，或输入 / 选择技能"
        references={references}
        renderConfigureArea={renderConfigureArea}
        sendHotKey="enter"
        showUploadButton={false}
        skills={[
          { icon: <IconEdit />, label: "修改当前 md", value: "patch-md" },
          { icon: <IconWrench />, label: "规划工具调用", value: "tool-plan", hasTemplate: true },
          { icon: <IconArticle />, label: "总结文档", value: "summarize" },
        ]}
        skillHotKey="/"
        suggestions={[
          { content: "总结当前 Markdown 文件" },
          { content: "创建 apply_patch 补丁草案" },
          { content: "编辑前列出验证命令" },
        ]}
      />
    </main>
  );
}

function InlineFormatMenu(props: {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  onPolishSelection(): void;
  onQuoteSelection(): void;
}) {
  const { editor } = props;

  return (
    <BubbleMenu className="inlineFormatMenu" editor={editor} options={{ placement: "top" }}>
      <Button
        icon={<IconBolt />}
        onClick={props.onPolishSelection}
        size="small"
        theme="solid"
        type="primary"
      >
        润色
      </Button>
      <Button
        icon={<IconQuote />}
        onClick={props.onQuoteSelection}
        size="small"
        theme="light"
        type="tertiary"
      >
        引用
      </Button>
      <Button
        icon={<IconBold />}
        onClick={() => editor.chain().focus().toggleBold().run()}
        size="small"
        theme={editor.isActive("bold") ? "solid" : "borderless"}
        type="tertiary"
      />
      <Button
        icon={<IconItalic />}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        size="small"
        theme={editor.isActive("italic") ? "solid" : "borderless"}
        type="tertiary"
      />
      <Button
        icon={<IconUnderline />}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        size="small"
        theme={editor.isActive("underline") ? "solid" : "borderless"}
        type="tertiary"
      />
      <Button
        icon={<IconCode />}
        onClick={() => editor.chain().focus().toggleCode().run()}
        size="small"
        theme={editor.isActive("code") ? "solid" : "borderless"}
        type="tertiary"
      />
      <Button
        icon={<IconLink />}
        onClick={() => {
          const previousUrl = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("链接地址", previousUrl ?? "https://");
          if (url) {
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }
        }}
        size="small"
        theme={editor.isActive("link") ? "solid" : "borderless"}
        type="tertiary"
      />
    </BubbleMenu>
  );
}

function ShortTaskDiff(props: { onApply(): void; onDismiss(): void; proposal: ShortTaskProposal }) {
  return (
    <section className="shortTaskDiff" aria-label={props.proposal.title}>
      <div className="shortTaskDiffHeader">
        <Space align="center" spacing={6}>
          <IconBolt />
          <Text strong>{props.proposal.title}</Text>
          <Tag color="blue" size="small">
            短任务
          </Tag>
          <Text size="small" type="tertiary">
            红色为原文，绿色为建议，已在正文中标出。
          </Text>
        </Space>
        <Space align="center" spacing={6}>
          <Button onClick={props.onDismiss} size="small" theme="borderless" type="tertiary">
            丢弃
          </Button>
          <Button
            icon={<IconSave />}
            onClick={props.onApply}
            size="small"
            theme="solid"
            type="primary"
          >
            应用
          </Button>
        </Space>
      </div>
    </section>
  );
}

function FloatingSelectionChat(props: { onClose(): void; quote: FloatingQuote }) {
  const [message, setMessage] = useState("基于这段文字给出修改建议");

  useEffect(() => {
    setMessage("基于这段文字给出修改建议");
  }, [props.quote.id]);

  return (
    <Card
      className="floatingSelectionChat"
      headerExtraContent={
        <Button
          aria-label="关闭引用对话"
          icon={<IconClose />}
          onClick={props.onClose}
          size="small"
          theme="borderless"
          type="tertiary"
        />
      }
      title={
        <Space align="center" spacing={6}>
          <IconQuote />
          <Text strong>引用选区</Text>
        </Space>
      }
    >
      <Text ellipsis={{ showTooltip: true }} size="small" type="tertiary">
        {props.quote.filePath}
      </Text>
      <blockquote>{props.quote.text}</blockquote>
      <TextArea
        autosize={false}
        onChange={setMessage}
        placeholder="问一句，或让 LLM 基于引用修改..."
        value={message}
      />
      <div className="floatingSelectionChatActions">
        <Button onClick={props.onClose} size="small" theme="borderless" type="tertiary">
          取消
        </Button>
        <Button
          icon={<IconBolt />}
          onClick={() => {
            Toast.info("已发送引用短问答");
            props.onClose();
          }}
          size="small"
          theme="solid"
          type="primary"
        >
          发送
        </Button>
      </div>
    </Card>
  );
}

function QuickInsertMenu(props: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  const { editor } = props;

  return (
    <FloatingMenu className="quickInsertMenu" editor={editor} options={{ placement: "left-start" }}>
      <Button
        icon={<IconH1 />}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        size="small"
        theme="borderless"
        type="tertiary"
      />
      <Button
        icon={<IconList />}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        size="small"
        theme="borderless"
        type="tertiary"
      />
      <Button
        icon={<IconQuote />}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        size="small"
        theme="borderless"
        type="tertiary"
      />
      <Button
        icon={<IconGridSquare />}
        onClick={() =>
          editor.chain().focus().insertTable({ cols: 3, rows: 3, withHeaderRow: true }).run()
        }
        size="small"
        theme="borderless"
        type="tertiary"
      />
    </FloatingMenu>
  );
}

function EditorToolbar(props: {
  editor: NonNullable<ReturnType<typeof useEditor>> | null;
  onApplyMarkdown(): void;
}) {
  const { editor } = props;
  const disabled = !editor;
  const inTable = Boolean(editor?.isActive("table"));
  const tableDisabled = disabled || !inTable;
  const setLink = useCallback(() => {
    if (!editor) {
      return;
    }
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("链接地址", previousUrl ?? "https://");
    if (url === null) {
      return;
    }
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="editorToolbar" role="toolbar">
      <Tooltip content="撤销">
        <Button
          disabled={disabled}
          icon={<IconUndo />}
          onClick={() => editor?.chain().focus().undo().run()}
          size="small"
          theme="borderless"
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="重做">
        <Button
          disabled={disabled}
          icon={<IconRedo />}
          onClick={() => editor?.chain().focus().redo().run()}
          size="small"
          theme="borderless"
          type="tertiary"
        />
      </Tooltip>
      <Divider layout="vertical" margin="4px" />
      <Button
        disabled={disabled}
        onClick={() => editor?.chain().focus().setParagraph().run()}
        size="small"
        theme={editor?.isActive("paragraph") ? "solid" : "borderless"}
        type="tertiary"
      >
        正文
      </Button>
      <Tooltip content="粗体">
        <Button
          disabled={disabled}
          icon={<IconBold />}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          size="small"
          theme={editor?.isActive("bold") ? "solid" : "borderless"}
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="斜体">
        <Button
          disabled={disabled}
          icon={<IconItalic />}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          size="small"
          theme={editor?.isActive("italic") ? "solid" : "borderless"}
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="删除线">
        <Button
          disabled={disabled}
          icon={<IconStrikeThrough />}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          size="small"
          theme={editor?.isActive("strike") ? "solid" : "borderless"}
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="下划线">
        <Button
          disabled={disabled}
          icon={<IconUnderline />}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          size="small"
          theme={editor?.isActive("underline") ? "solid" : "borderless"}
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="行内代码">
        <Button
          disabled={disabled}
          icon={<IconCode />}
          onClick={() => editor?.chain().focus().toggleCode().run()}
          size="small"
          theme={editor?.isActive("code") ? "solid" : "borderless"}
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="链接">
        <Button
          disabled={disabled}
          icon={<IconLink />}
          onClick={setLink}
          size="small"
          theme={editor?.isActive("link") ? "solid" : "borderless"}
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="取消链接">
        <Button
          disabled={disabled || !editor?.isActive("link")}
          icon={<IconUnlink />}
          onClick={() => editor?.chain().focus().extendMarkRange("link").unsetLink().run()}
          size="small"
          theme="borderless"
          type="tertiary"
        />
      </Tooltip>
      <Divider layout="vertical" margin="4px" />
      <Tooltip content="一级标题">
        <Button
          disabled={disabled}
          icon={<IconH1 />}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          size="small"
          theme={editor?.isActive("heading", { level: 1 }) ? "solid" : "borderless"}
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="二级标题">
        <Button
          disabled={disabled}
          icon={<IconH2 />}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          size="small"
          theme={editor?.isActive("heading", { level: 2 }) ? "solid" : "borderless"}
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="无序列表">
        <Button
          disabled={disabled}
          icon={<IconList />}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          size="small"
          theme={editor?.isActive("bulletList") ? "solid" : "borderless"}
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="有序列表">
        <Button
          disabled={disabled}
          icon={<IconOrderedList />}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          size="small"
          theme={editor?.isActive("orderedList") ? "solid" : "borderless"}
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="引用">
        <Button
          disabled={disabled}
          icon={<IconQuote />}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          size="small"
          theme={editor?.isActive("blockquote") ? "solid" : "borderless"}
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="代码块">
        <Button
          disabled={disabled}
          icon={<IconCode />}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          size="small"
          theme={editor?.isActive("codeBlock") ? "solid" : "borderless"}
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="左对齐">
        <Button
          disabled={disabled}
          icon={<IconAlignLeft />}
          onClick={() => editor?.chain().focus().setTextAlign("left").run()}
          size="small"
          theme={editor?.isActive({ textAlign: "left" }) ? "solid" : "borderless"}
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="居中">
        <Button
          disabled={disabled}
          icon={<IconAlignCenter />}
          onClick={() => editor?.chain().focus().setTextAlign("center").run()}
          size="small"
          theme={editor?.isActive({ textAlign: "center" }) ? "solid" : "borderless"}
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="右对齐">
        <Button
          disabled={disabled}
          icon={<IconAlignRight />}
          onClick={() => editor?.chain().focus().setTextAlign("right").run()}
          size="small"
          theme={editor?.isActive({ textAlign: "right" }) ? "solid" : "borderless"}
          type="tertiary"
        />
      </Tooltip>
      <Button
        disabled={disabled}
        onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        size="small"
        theme="borderless"
        type="tertiary"
      >
        分割线
      </Button>
      <Button
        disabled={disabled}
        onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
        size="small"
        theme="borderless"
        type="tertiary"
      >
        清除格式
      </Button>
      <Divider layout="vertical" margin="4px" />
      <TableSizePicker disabled={disabled} editor={editor} />
      <Tooltip content="前插入列">
        <Button
          disabled={tableDisabled}
          icon={<IconColumnsStroked />}
          onClick={() => editor?.chain().focus().addColumnBefore().run()}
          size="small"
          theme="borderless"
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="后插入列">
        <Button
          disabled={tableDisabled}
          icon={<IconColumnsStroked />}
          onClick={() => editor?.chain().focus().addColumnAfter().run()}
          size="small"
          theme="borderless"
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="删除列">
        <Button
          disabled={tableDisabled}
          icon={<IconColumnsStroked />}
          onClick={() => editor?.chain().focus().deleteColumn().run()}
          size="small"
          theme="borderless"
          type="danger"
        />
      </Tooltip>
      <Tooltip content="前插入行">
        <Button
          disabled={tableDisabled}
          icon={<IconRowsStroked />}
          onClick={() => editor?.chain().focus().addRowBefore().run()}
          size="small"
          theme="borderless"
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="后插入行">
        <Button
          disabled={tableDisabled}
          icon={<IconRowsStroked />}
          onClick={() => editor?.chain().focus().addRowAfter().run()}
          size="small"
          theme="borderless"
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="删除行">
        <Button
          disabled={tableDisabled}
          icon={<IconRowsStroked />}
          onClick={() => editor?.chain().focus().deleteRow().run()}
          size="small"
          theme="borderless"
          type="danger"
        />
      </Tooltip>
      <Button
        disabled={tableDisabled}
        onClick={() => editor?.chain().focus().toggleHeaderRow().run()}
        size="small"
        theme="borderless"
        type="tertiary"
      >
        表头行
      </Button>
      <Button
        disabled={tableDisabled}
        onClick={() => editor?.chain().focus().toggleHeaderColumn().run()}
        size="small"
        theme="borderless"
        type="tertiary"
      >
        表头列
      </Button>
      <Button
        disabled={tableDisabled}
        onClick={() => editor?.chain().focus().toggleHeaderCell().run()}
        size="small"
        theme="borderless"
        type="tertiary"
      >
        表头格
      </Button>
      <Button
        disabled={tableDisabled}
        onClick={() => editor?.chain().focus().mergeOrSplit().run()}
        size="small"
        theme="borderless"
        type="tertiary"
      >
        合并/拆分
      </Button>
      <Button
        disabled={tableDisabled}
        onClick={() => editor?.chain().focus().mergeCells().run()}
        size="small"
        theme="borderless"
        type="tertiary"
      >
        合并
      </Button>
      <Button
        disabled={tableDisabled}
        onClick={() => editor?.chain().focus().splitCell().run()}
        size="small"
        theme="borderless"
        type="tertiary"
      >
        拆分
      </Button>
      <Tooltip content="上一单元格">
        <Button
          disabled={tableDisabled}
          icon={<IconBackward />}
          onClick={() => editor?.chain().focus().goToPreviousCell().run()}
          size="small"
          theme="borderless"
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="下一单元格">
        <Button
          disabled={tableDisabled}
          icon={<IconForward />}
          onClick={() => editor?.chain().focus().goToNextCell().run()}
          size="small"
          theme="borderless"
          type="tertiary"
        />
      </Tooltip>
      <Tooltip content="修复表格结构">
        <Button
          disabled={tableDisabled}
          icon={<IconGridSquare />}
          onClick={() => editor?.chain().focus().fixTables().run()}
          size="small"
          theme="borderless"
          type="tertiary"
        />
      </Tooltip>
      <Button
        disabled={tableDisabled}
        onClick={() => editor?.chain().focus().deleteTable().run()}
        size="small"
        theme="borderless"
        type="danger"
      >
        删除表格
      </Button>
      <Divider layout="vertical" margin="4px" />
      <Button
        disabled={disabled}
        icon={<IconRefresh />}
        onClick={props.onApplyMarkdown}
        size="small"
        theme="borderless"
        type="tertiary"
      >
        应用源码
      </Button>
    </div>
  );
}

function TableSizePicker(props: {
  disabled: boolean;
  editor: NonNullable<ReturnType<typeof useEditor>> | null;
}) {
  const [hoveredSize, setHoveredSize] = useState({ cols: 4, rows: 3 });
  const [withHeaderRow, setWithHeaderRow] = useState(true);
  const [visible, setVisible] = useState(false);
  const maxCols = 10;
  const maxRows = 8;
  const cells = Array.from({ length: maxCols * maxRows }, (_, index) => {
    const row = Math.floor(index / maxCols) + 1;
    const col = (index % maxCols) + 1;
    const active = row <= hoveredSize.rows && col <= hoveredSize.cols;
    return (
      <button
        aria-label={`插入 ${row} 行 ${col} 列表格`}
        className={["tablePickerCell", active ? "active" : ""].join(" ")}
        key={`${row}-${col}`}
        onClick={() => {
          props.editor?.chain().focus().insertTable({ cols: col, rows: row, withHeaderRow }).run();
          setVisible(false);
        }}
        onMouseEnter={() => setHoveredSize({ cols: col, rows: row })}
        role="gridcell"
        type="button"
      />
    );
  });

  return (
    <Popover
      clickToHide={false}
      condition={!props.disabled}
      content={
        <div className="tablePicker">
          <div className="tablePickerHeader">
            <Text strong>
              {hoveredSize.rows} 行 x {hoveredSize.cols} 列
            </Text>
            <span>
              <Text size="small" type="tertiary">
                表头行
              </Text>
              <Switch checked={withHeaderRow} onChange={setWithHeaderRow} size="small" />
            </span>
          </div>
          <div
            aria-label="选择表格行列"
            className="tablePickerGrid"
            onMouseLeave={() => setHoveredSize({ cols: 4, rows: 3 })}
            role="grid"
            tabIndex={-1}
          >
            {cells}
          </div>
          <div className="tablePickerFooter">
            <Button
              onClick={() => {
                props.editor
                  ?.chain()
                  .focus()
                  .insertTable({ cols: 3, rows: 3, withHeaderRow })
                  .run();
                setVisible(false);
              }}
              size="small"
              theme="borderless"
              type="tertiary"
            >
              3 x 3
            </Button>
            <Button
              onClick={() => {
                props.editor
                  ?.chain()
                  .focus()
                  .insertTable({ cols: 5, rows: 4, withHeaderRow })
                  .run();
                setVisible(false);
              }}
              size="small"
              theme="borderless"
              type="tertiary"
            >
              4 x 5
            </Button>
            <Text size="small" type="tertiary">
              插入后可拖拽列宽、增删行列、合并单元格。
            </Text>
          </div>
        </div>
      }
      onVisibleChange={setVisible}
      position="bottomLeft"
      showArrow
      trigger="click"
      visible={visible}
    >
      <Button
        disabled={props.disabled}
        icon={<IconGridSquare />}
        size="small"
        theme="borderless"
        type="tertiary"
      >
        插入表格
      </Button>
    </Popover>
  );
}

function ToolPanel(props: { activeTabId: string; files: WorkspaceFile[] }) {
  const [selected, setSelected] = useState("apply_patch");
  const activeFile = props.activeTabId.startsWith("file:")
    ? props.files.find((file) => props.activeTabId === `file:${file.id}`)
    : undefined;

  return (
    <div className="panelScroll">
      <div className="inspectorHeader">
        <div>
          <Text strong>检查器</Text>
          <Text size="small" type="tertiary">
            {props.activeTabId}
          </Text>
        </div>
      </div>
      {activeFile ? (
        <section className="fileInspector">
          <SectionTitle
            icon={activeFile.kind === "markdown" ? <IconArticle /> : <IconFile />}
            title={activeFile.kind === "markdown" ? "Markdown 文件" : "只读文件"}
          />
          <Descriptions
            className="panelDescriptions"
            data={[
              { key: "路径", value: activeFile.path },
              {
                key: "角色",
                value: activeFile.kind === "markdown" ? "可编辑上下文" : "可读预览上下文",
              },
              {
                key: "渲染",
                value: activeFile.kind === "markdown" ? "Tiptap Markdown" : activeFile.viewerType,
              },
            ]}
            size="small"
          />
          <Text size="small" type="tertiary">
            {activeFile.kind === "markdown"
              ? "文件编辑器不显示 agent 或工具执行授权。会话可以引用此文件，但编辑本身保持为普通文档工作流。"
              : activeFile.description}
          </Text>
        </section>
      ) : null}
      <Tabs className="toolTabs" size="small" type="button">
        <TabPane itemKey="calls" tab="调用">
          {activeFile ? (
            <Empty
              className="quietNotice"
              description="工具调用属于 AI 会话标签页。打开会话标签页后可检查待处理调用。"
              image={<IconWrench />}
              title="无待处理调用"
            />
          ) : (
            <div className="toolCallList">
              {toolCalls.map((tool) => (
                <Card
                  bodyStyle={{ padding: 12 }}
                  className={["toolCall", selected === tool.name ? "selected" : ""].join(" ")}
                  key={tool.name}
                  shadows="hover"
                >
                  <div className="toolCallHead">
                    <span>
                      <IconWrench />
                      <Text strong>{tool.name}</Text>
                    </span>
                    <Tag
                      color={
                        tool.status === "done"
                          ? "green"
                          : tool.status === "queued"
                            ? "amber"
                            : "blue"
                      }
                      size="small"
                    >
                      {tool.status}
                    </Tag>
                  </div>
                  <code>{tool.args}</code>
                  <div className="toolCallFooter">
                    <Text size="small" type="tertiary">
                      {tool.time}
                    </Text>
                    <span>
                      <Button
                        icon={<IconPlay />}
                        onClick={() => {
                          setSelected(tool.name);
                          Toast.info(`已确认 ${tool.name}`);
                        }}
                        size="small"
                        theme="borderless"
                        type="primary"
                      />
                      <Button
                        icon={<IconStop />}
                        onClick={() => Toast.warning(`已拒绝 ${tool.name}`)}
                        size="small"
                        theme="borderless"
                        type="danger"
                      />
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabPane>
        <TabPane itemKey="skills" tab="技能">
          <List className="skillList" size="small" split={false}>
            <Skill name="工作区编辑" progress={72} />
            <Skill name="Markdown 规划" progress={88} />
            <Skill name="命令验证" progress={46} />
          </List>
        </TabPane>
      </Tabs>
    </div>
  );
}

function SettingsPanel(props: {
  onThemeChange(theme: ThemeMode): void;
  onToolsPartChange(part: WorkbenchPart): void;
  theme: ThemeMode;
  toolsPart: WorkbenchPart;
}) {
  return (
    <div className="panelScroll settingsPanel">
      <Tabs size="small" type="line">
        <TabPane itemKey="appearance" tab="外观">
          <section className="settingsSection">
            <SectionTitle icon={<IconSetting />} title="主题" />
            <List className="settingsList" size="small" split={false}>
              <SettingItem
                description="应用于工作台、Semi 控件、编辑器和预览。"
                extra={
                  <div className="themeControl">
                    <IconSun />
                    <Switch
                      checked={props.theme === "dark"}
                      checkedText={<IconMoon />}
                      onChange={(checked) => props.onThemeChange(checked ? "dark" : "light")}
                      uncheckedText={<IconSun />}
                    />
                    <IconMoon />
                  </div>
                }
                title="颜色模式"
              />
            </List>
          </section>
        </TabPane>
        <TabPane itemKey="runtime" tab="运行">
          <section className="settingsSection">
            <SectionTitle icon={<IconWrench />} title="Agent 运行时" />
            <List className="settingsList" size="small" split={false}>
              <SettingItem
                description="在实现拖拽停靠前，用显式选择模拟 VS Code 的视图移动。"
                extra={
                  <Select
                    onChange={(value) => props.onToolsPartChange(value as WorkbenchPart)}
                    optionList={[
                      { label: "底部面板", value: "panel" },
                      { label: "左侧栏", value: "primary" },
                      { label: "右侧栏", value: "secondary" },
                    ]}
                    size="small"
                    style={{ width: 150 }}
                    value={props.toolsPart}
                  />
                }
                title="工具停靠位置"
              />
              <SettingItem
                description="工具调用需要在检查器中显式确认。"
                extra={
                  <Select
                    defaultValue="gated"
                    optionList={[
                      { label: "确认后执行", value: "gated" },
                      { label: "只读自动", value: "read" },
                      { label: "仅手动", value: "manual" },
                    ]}
                    size="small"
                    style={{ width: 140 }}
                  />
                }
                title="确认模式"
              />
              <SettingItem
                description="事件面板默认隐藏，需要时从活动栏打开。"
                extra={
                  <Tag color="grey" size="small">
                    隐藏
                  </Tag>
                }
                title="默认面板"
              />
            </List>
          </section>
        </TabPane>
        <TabPane itemKey="connection" tab="连接">
          <section className="settingsSection">
            <SectionTitle icon={<IconServer />} title="Pi Bridge" />
            <Descriptions
              className="panelDescriptions"
              data={[
                { key: "Provider", value: "pi-compatible endpoint" },
                { key: "传输", value: "SSE stream" },
                { key: "补丁格式", value: "unified diff" },
              ]}
              size="small"
            />
          </section>
        </TabPane>
      </Tabs>
    </div>
  );
}

function EventPanel(props: { activeTabId: string }) {
  return (
    <div className="eventPanel">
      <Timeline mode="left">
        <Timeline.Item time="09:42:11" type="ongoing">
          <span className="eventLine">
            <IconPlay /> 聚焦标签 {props.activeTabId}
          </span>
        </Timeline.Item>
        <Timeline.Item time="09:42:13">
          <span className="eventLine">
            <IconWrench /> tool.read_file 已完成，用时 128 ms
          </span>
        </Timeline.Item>
        <Timeline.Item time="09:42:18">
          <span className="eventLine">
            <IconEdit /> Markdown 缓冲区已本地更新
          </span>
        </Timeline.Item>
      </Timeline>
      <pre className="eventLog">
        {`> active_tab: ${props.activeTabId}
> workspace: /workspace/pluxel
> next: approval gated tool call`}
      </pre>
    </div>
  );
}

function Skill(props: { name: string; progress: number }) {
  return (
    <List.Item
      className="skillListItem"
      extra={
        <Progress
          percent={props.progress}
          showInfo={false}
          size="small"
          stroke="var(--app-accent)"
          style={{ width: 96 }}
        />
      }
      main={
        <Space spacing={2} vertical>
          <Text strong>{props.name}</Text>
          <Text size="small" type="tertiary">
            前端模拟
          </Text>
        </Space>
      }
    />
  );
}

function SettingItem(props: { description: string; extra: ReactNode; title: string }) {
  return (
    <List.Item
      className="settingListItem"
      extra={props.extra}
      main={
        <Space spacing={2} vertical>
          <Text strong>{props.title}</Text>
          <Text size="small" type="tertiary">
            {props.description}
          </Text>
        </Space>
      }
    />
  );
}

function SectionTitle(props: { icon: ReactNode; title: string }) {
  return (
    <div className="sectionTitle">
      {props.icon}
      <Text strong>{props.title}</Text>
    </div>
  );
}

function PanelHeader(props: {
  icon: ReactNode;
  onClose(): void;
  part: WorkbenchPart;
  view: WorkbenchView;
}) {
  return (
    <header className="panelHeader">
      <span>
        {props.icon}
        {props.view.title ?? props.view.id}
      </span>
      <Button
        aria-label={`Collapse ${props.view.title ?? props.view.id}`}
        className="panelIconButton"
        icon={<IconClose />}
        onClick={props.onClose}
        size="small"
        theme="borderless"
        type="tertiary"
      />
    </header>
  );
}

function createPolishedDraft(text: string) {
  const polished = text
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replaceAll("可以", "可")
    .replaceAll("噪音", "干扰信息")
    .replaceAll("后续", "下一步")
    .replaceAll("当前", "目前")
    .replaceAll("需要", "需");

  if (polished !== text) {
    return polished;
  }

  return text.includes("。") || text.includes(".") ? text : `${text}。`;
}

function createTabId(resource: TabResource) {
  return `${resource.kind}:${resource.id}`;
}

function extractAiInputText(content: MessageContent) {
  return (
    content.inputContents
      ?.map((item) => {
        if (typeof item.text === "string") {
          return item.text;
        }
        if (typeof item.content === "string") {
          return item.content;
        }
        return "";
      })
      .join(" ")
      .trim() ?? ""
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
