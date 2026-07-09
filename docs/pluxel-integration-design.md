# Pluxel Worksplit 集成设计

## 目标

这份文档记录 Pluxel 接入 `split-like-vscode` 的推荐方式，避免把 GQLens 的 Vite codegen
模式误套到一个纯 UI layout 包上。

`split-like-vscode` 的职责是提供 VS Code-like split/workbench 行为：

- pane 尺寸约束、拖拽、折叠、恢复、比例 resize；
- React 组件和 CSS；
- 可序列化的 layout/value snapshot；
- demo/app 用 Vite 验证交互和业务场景。

Pluxel 只需要消费 `@worksplit/react`。不需要额外的 `@worksplit/vite` 包，不需要
codegen 包，也不需要生成 TS 文件。

## 与 GQLens Vite Codegen 的区别

GQLens 的 Vite 插件存在，是因为它有一个真实的生成链路：

- schema/source 变化需要转成 generated accessor；
- generated 文件要参与 TypeScript、IDE 跳转和前端 HMR；
- Vite dev server 要负责 schema reload、content-diff 写盘和 build 前校验；
- `@gqlens/codegen` 是可复用的纯生成边界，`@gqlens/vite` 是构建工具适配层。

`split-like-vscode` 没有这类生成物。它的输入是 React props，输出是 DOM 行为和回调事件。
Vite 对它只是一种 demo/app 构建环境，不是产品 API 边界。

因此拆出 `@worksplit/vite` 或 `@worksplit/codegen` 会制造错误抽象：

- 没有 schema 或 DSL 需要编译；
- 没有 generated 文件需要写盘；
- 没有 HMR artifact 需要 content-diff；
- 没有 build hook 必须介入应用代码；
- 类型、样式和行为都能通过普通 package export 解决。

## Pluxel 集成边界

Pluxel 应该把 worksplit 细节收敛在自己的 workbench split adapter 中：

```txt
packages/components/src/app/workbench/split/
  view.tsx       # 唯一直接 import @worksplit/react 的地方
  storage.ts     # Pluxel layout 持久化和恢复
  tabState.ts    # active-tab scoped state
  plugin.ts      # plugin workbench pane defaults and sanitizers
  index.ts       # Pluxel 内部 barrel
```

业务组件应从 Pluxel 的 adapter import，而不是散落 import `@worksplit/react`：

```ts
import { WorkbenchSplitView } from "../../../workbench/split";
```

adapter 内部负责：

1. 把 Pluxel 的百分比 layout 转成 worksplit 的 pixel sizes。
2. 把 worksplit 的 resize event 转回百分比 layout。
3. 统一 pane visibility、snap、min/default size。
4. 引入 `@worksplit/react/style.css`。
5. 隔离未来替换 split library 的影响面。

## 主链路

```txt
Pluxel route/plugin screen renders
        ↓
workbench/split adapter resolves active tab layout
        ↓
adapter renders @worksplit/react SplitView + Pane
        ↓
ResizeObserver reads host axis size
        ↓
percent layout -> pixel sizes
        ↓
user drags sash / toggles pane
        ↓
@worksplit/react emits layout/visibility event
        ↓
adapter converts pixel sizes -> percent layout
        ↓
Pluxel stores scoped layout state
```

这个链路全在运行时完成。没有生成文件，没有 Vite plugin hook，没有虚拟模块。

## Package 设计

库包边界保持简单：

- `@worksplit/core`：DOM-free layout/state math。
- `@worksplit/react`：React components、DOM event、ResizeObserver、CSS。
- `packages/demo`：Vite demo，用来验证库 API。
- `app`：业务 frontend sandbox，不作为库 API。

库包构建使用 `tsdown` 产出 ESM、dts、sourcemap 和 React CSS artifact：

```txt
packages/core/dist/index.js
packages/core/dist/index.d.ts
packages/react/dist/index.js
packages/react/dist/index.d.ts
packages/react/dist/style.css
```

Vitest 直接测试 core math 和 React DOM 行为。Vite 只服务 demo/app，不服务库发布。

## 不做

- 不新增 `@worksplit/vite`。
- 不新增 `@worksplit/codegen`。
- 不设计 virtual module 用户 API。
- 不把 Pluxel 的百分比持久化规则放进 library core。
- 不让业务组件直接依赖 worksplit 的低层事件 shape。
- 不把 demo/app 的 Vite 配置当成 library build contract。

## LLM 接入提示

当 LLM 需要在 Pluxel 里改 split/workbench 行为时，优先阅读：

1. `packages/components/src/app/workbench/split/README.md`
2. `packages/components/src/app/workbench/split/view.tsx`
3. `vendor/split-like-vscode/docs/pluxel-integration-design.md`
4. `vendor/split-like-vscode/docs/vscode-workbench-behavior.md`

如果任务是 Pluxel 集成，改 Pluxel adapter 和状态层；如果任务是通用 split 行为缺陷，再改
`vendor/split-like-vscode/packages/core` 或 `vendor/split-like-vscode/packages/react`。
