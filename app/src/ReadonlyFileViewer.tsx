import {
  IconClose,
  IconDownload,
  IconFullScreenStroked,
  IconMinus,
  IconPlus,
  IconPrint,
  IconRefresh,
  IconSearch,
  IconUpload,
} from "@douyinfe/semi-icons";
import { Button, Input, Select, Tag, Tooltip, Typography } from "@douyinfe/semi-ui";
import officeViewerPreset from "@file-viewer/preset-office";
import {
  FileViewer,
  type FileViewerHandle,
  type ViewerOptions,
  type ViewerState,
} from "@file-viewer/react";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

const { Text, Title } = Typography;

type ThemeMode = "light" | "dark";
type ViewerStatus = "error" | "idle" | "loading" | "ready";

interface ReadonlyPreviewFile {
  id: string;
  name: string;
  path: string;
  sourceUrl: string;
  viewerType: string;
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export default function ReadonlyFileViewer(props: {
  file: ReadonlyPreviewFile;
  onOpenFile(id: string): void;
  relatedFiles: ReadonlyPreviewFile[];
  theme: ThemeMode;
}) {
  const viewerRef = useRef<FileViewerHandle>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [errorText, setErrorText] = useState("");
  const [searchText, setSearchText] = useState("");
  const activeName = localFile?.name ?? props.file.name;
  const activeType = localFile ? getFileExtension(localFile.name) : props.file.viewerType;
  const sourceKey = localFile
    ? `local:${localFile.name}:${localFile.lastModified}`
    : `sample:${props.file.id}`;
  const viewerOptions = useMemo<ViewerOptions>(
    () => ({
      fit: { mode: "width", padding: 0, resize: "until-interaction" },
      locale: "zh-CN",
      pdf: {
        defaultNavigationVisible: false,
        navigation: false,
        toolbar: false,
      },
      preset: officeViewerPreset,
      rendererMode: "replace",
      search: { enabled: true, maxMatches: 200 },
      styleIsolation: "shadow",
      theme: props.theme,
      toolbar: false,
      ui: { density: "compact" },
    }),
    [props.theme],
  );
  const handleStateChange = useCallback((nextState: ViewerState) => {
    setErrorText(nextState.error ? normalizeViewerError(nextState.error) : "");
    const nextStatus = nextState.error
      ? "error"
      : nextState.ready
        ? "ready"
        : nextState.loading
          ? "loading"
          : "idle";
    setStatus((current) => (current === nextStatus ? current : nextStatus));
  }, []);

  useEffect(() => {
    setLocalFile(null);
    setStatus("idle");
    setErrorText("");
  }, [props.file.id]);
  const handleUploadChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    if (nextFile) {
      setLocalFile(nextFile);
      setStatus("idle");
      setErrorText("");
    }
    event.target.value = "";
  }, []);
  const runSearch = useCallback(() => {
    const query = searchText.trim();
    if (query) {
      void viewerRef.current?.searchDocument(query);
    } else {
      void viewerRef.current?.clearDocumentSearch();
    }
  }, [searchText]);
  const relatedFiles = useMemo(
    () =>
      props.relatedFiles.filter((file) => file.viewerType !== "svg" && file.viewerType !== "eml"),
    [props.relatedFiles],
  );
  const sampleOptions = useMemo(
    () =>
      relatedFiles.map((file) => ({
        label: file.name,
        value: file.id,
      })),
    [relatedFiles],
  );

  return (
    <main className="readonlySurface">
      <div className="readonlyTopbar">
        <div className="readonlyTitle">
          <Title ellipsis={{ showTooltip: true }} heading={5}>
            {activeName}
          </Title>
          <Text ellipsis={{ showTooltip: true }} size="small" type="tertiary">
            {localFile ? "local upload" : props.file.path}
          </Text>
        </div>
        <div className="readonlyActions">
          <Tag color="teal" size="small">
            {activeType || "file"}
          </Tag>
          <Tag
            color={status === "error" ? "red" : status === "ready" ? "green" : "grey"}
            size="small"
          >
            {status}
          </Tag>
          <input
            ref={uploadRef}
            className="readonlyUploadInput"
            onChange={handleUploadChange}
            type="file"
          />
          <Tooltip content="打开本地文件">
            <Button
              icon={<IconUpload />}
              onClick={() => uploadRef.current?.click()}
              size="small"
              theme="borderless"
              type="tertiary"
            />
          </Tooltip>
          {localFile ? (
            <Tooltip content="回到样例文件">
              <Button
                icon={<IconClose />}
                onClick={() => {
                  setLocalFile(null);
                  setStatus("idle");
                  setErrorText("");
                }}
                size="small"
                theme="borderless"
                type="tertiary"
              />
            </Tooltip>
          ) : null}
          <Tooltip content="重新加载">
            <Button
              icon={<IconRefresh />}
              onClick={() => void viewerRef.current?.reload()}
              size="small"
              theme="borderless"
              type="tertiary"
            />
          </Tooltip>
        </div>
      </div>
      <div className="readonlyBody">
        <section className="readonlyPreview">
          <div className="readonlyToolbar">
            <Select
              className="readonlySampleSelect"
              disabled={Boolean(localFile)}
              onChange={(value) => {
                if (typeof value === "string") {
                  props.onOpenFile(value);
                }
              }}
              optionList={sampleOptions}
              size="small"
              value={localFile ? undefined : props.file.id}
            />
            <span className="readonlyToolbarDivider" />
            <Input
              className="readonlySearch"
              onChange={setSearchText}
              onEnterPress={runSearch}
              placeholder="搜索文档"
              prefix={<IconSearch />}
              size="small"
              value={searchText}
            />
            <Button onClick={runSearch} size="small" theme="borderless" type="tertiary">
              搜索
            </Button>
            <span className="readonlyToolbarDivider" />
            <Tooltip content="缩小">
              <Button
                icon={<IconMinus />}
                onClick={() => void viewerRef.current?.zoomOut()}
                size="small"
                theme="borderless"
                type="tertiary"
              />
            </Tooltip>
            <Tooltip content="适应宽度">
              <Button
                icon={<IconFullScreenStroked />}
                onClick={() => void viewerRef.current?.fitToView({ mode: "width", padding: 16 })}
                size="small"
                theme="borderless"
                type="tertiary"
              />
            </Tooltip>
            <Button
              onClick={() => void viewerRef.current?.fitToView({ mode: "contain", padding: 20 })}
              size="small"
              theme="borderless"
              type="tertiary"
            >
              适屏
            </Button>
            <Tooltip content="放大">
              <Button
                icon={<IconPlus />}
                onClick={() => void viewerRef.current?.zoomIn()}
                size="small"
                theme="borderless"
                type="tertiary"
              />
            </Tooltip>
            <span className="readonlyToolbarDivider" />
            <Tooltip content="下载原文件">
              <Button
                icon={<IconDownload />}
                onClick={() => void viewerRef.current?.downloadOriginalFile()}
                size="small"
                theme="borderless"
                type="tertiary"
              />
            </Tooltip>
            <Tooltip content="打印">
              <Button
                icon={<IconPrint />}
                onClick={() => void viewerRef.current?.printRenderedHtml()}
                size="small"
                theme="borderless"
                type="tertiary"
              />
            </Tooltip>
          </div>
          <div className="readonlyStage">
            <FileViewer
              key={sourceKey}
              ref={viewerRef}
              className="readonlyFileViewerFrame file-viewer"
              file={localFile ?? undefined}
              filename={activeName}
              name={activeName}
              onStateChange={handleStateChange}
              options={viewerOptions}
              type={activeType}
              url={localFile ? undefined : props.file.sourceUrl}
            />
          </div>
        </section>
      </div>
      {errorText ? (
        <div className="readonlyError">
          <Text strong>预览加载失败</Text>
          <Text size="small" type="tertiary">
            {errorText}
          </Text>
        </div>
      ) : null}
    </main>
  );
}

function normalizeViewerError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "未知错误";
  }
}
