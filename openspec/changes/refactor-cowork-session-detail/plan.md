# Plan: Refactor CoworkSessionDetail into Focused Modules

## Technical Approach

逐步抽取子模块，每一步保持可编译，最终用 re-export 确保零破坏性变更。

### Step 1 — 创建 `CoworkSessionDetail.types.ts`

把所有共享 TypeScript 类型和接口提取到独立文件。

- `ToolGroupItem`, `DisplayItem`, `AssistantTurnItem`, `ConversationTurn`, `CoworkSessionDetailProps`, `CaptureRect`
- 以及内部类型 `TodoStatus`, `ParsedTodoItem`

### Step 2 — 创建 `CoworkSessionDetail.utils.ts`

把所有纯工具函数提取到独立文件（无 React 依赖）：

- 格式化函数：`formatUnknown`, `getStringArray`, `formatStructuredText`, `toTrimmedString`, `truncatePreview`
- 路径解析函数：`normalizeLocalPath`, `parseRootRelativePath`, `stripFileProtocol`, `safeDecodeURIComponent` 等
- 工具调用解析：`normalizeToolName`, `getToolDisplayName`, `isBashLikeToolName`, `getToolInputString`, `getToolInputSummary`, `formatToolInput`, `normalizeToolResultText`, `getToolResultDisplay`
- Todo 解析：`parseTodoWriteItems`, `getTodoWriteSummary`, `normalizeTodoStatus`
- Cron 解析：`getCronToolSummary`, `isCronToolName`, `isTodoWriteToolName`
- 会话构建：`buildDisplayItems`, `buildConversationTurns`, `hasRenderableAssistantContent`, `getVisibleAssistantItems` (内部), `isVisibleAssistantTurnItem` (内部)
- 导出辅助：`sanitizeExportFileName`, `formatExportTimestamp`, `waitForNextFrame`, `loadImageFromBase64`, `domRectToCaptureRect`
- 其他：`hasText`, `getToolResultLineCount`

### Step 3 — 创建子组件文件

#### `components/CopyButton.tsx`

- `CopyButton` 组件（加 `React.memo`）

#### `components/ToolCallGroup.tsx`

- `PushPinIcon`（纯 SVG）
- `TodoWriteInputView` (加 `React.memo`)
- `ToolCallGroup` (加 `React.memo`)
- 导入 types/utils

#### `components/UserMessageItem.tsx`

- `UserMessageItem`（已有 `React.memo`，迁移过来即可）

#### `components/StreamingActivityBar.tsx`

- `TypingDots` (加 `React.memo`)
- `StreamingActivityBar` (加 `React.memo`)

#### `components/AssistantTurnBlock.tsx`

- `AssistantMessageItem` (加 `React.memo`)
- `ThinkingBlock` (加 `React.memo`)
- `AssistantTurnBlock`（本身作为 export，加 `React.memo`）

### Step 4 — 创建 `CoworkSessionDetail.hooks.ts`

从主组件抽取自定义 hooks：

- `useScrollBehavior(scrollContainerRef, messages, isStreaming)` — auto-scroll 与 scroll 监听
- `useTurnNavigation(scrollContainerRef, turns)` — turn 导航状态与操作
- `useSessionMenu(actionButtonRef)` — 下拉菜单位置管理
- `useRenameSession(session)` — rename 状态管理
- `useExportImage(session, scrollContainerRef)` — 截图导出逻辑

### Step 5 — 重构 `CoworkSessionDetail.tsx`

- 主组件仅保留 JSX 组织逻辑，使用上述 hooks
- 在文件末尾添加 re-export 语句，确保所有原有导出仍然可用

## File Dependency Graph

```
CoworkSessionDetail.types.ts     ← (no deps in our code)
CoworkSessionDetail.utils.ts     ← types.ts
CopyButton.tsx                   ← (no local deps)
ToolCallGroup.tsx                ← types.ts, utils.ts, CopyButton.tsx
UserMessageItem.tsx              ← types.ts, CopyButton.tsx, MarkdownContent.tsx
StreamingActivityBar.tsx         ← types.ts, utils.ts
AssistantTurnBlock.tsx           ← types.ts, utils.ts, AssistantMessageItem, ThinkingBlock, ToolCallGroup.tsx
CoworkSessionDetail.hooks.ts     ← types.ts, utils.ts, coworkService
CoworkSessionDetail.tsx          ← ALL above + CoworkPromptInput.tsx
```

## Risk & Mitigation

| Risk                 | Mitigation                                                         |
| -------------------- | ------------------------------------------------------------------ |
| 循环依赖             | types.ts 不依赖任何本地模块；utils.ts 只依赖 types.ts              |
| 外部 import 路径变化 | CoworkSessionDetail.tsx 用 `export { ... } from './...'` re-export |
| TypeScript 类型丢失  | 所有 `export type` 也在原文件 re-export                            |
| 拆分后行为不一致     | 逐步拆分，每步后 lint 检查                                         |
