# Tasks: Refactor CoworkSessionDetail

## Status: apply-ready

---

## Task 1 — 创建 `CoworkSessionDetail.types.ts`

- [ ] 新建 `src/renderer/components/cowork/CoworkSessionDetail.types.ts`
- [ ] 迁移类型：`CaptureRect`, `TodoStatus`, `ParsedTodoItem`, `ToolGroupItem`, `DisplayItem`, `AssistantTurnItem`, `ConversationTurn`, `CoworkSessionDetailProps`

## Task 2 — 创建 `CoworkSessionDetail.utils.ts`

- [ ] 新建 `src/renderer/components/cowork/CoworkSessionDetail.utils.ts`
- [ ] 迁移所有纯工具函数（约 30 个函数）
- [ ] 导出需外部使用的：`buildDisplayItems`, `buildConversationTurns`, `hasRenderableAssistantContent`

## Task 3 — 创建 `components/CopyButton.tsx`

- [ ] 新建 `src/renderer/components/cowork/components/CopyButton.tsx`
- [ ] 迁移 `CopyButton` 并添加 `React.memo`

## Task 4 — 创建 `components/ToolCallGroup.tsx`

- [ ] 新建 `src/renderer/components/cowork/components/ToolCallGroup.tsx`
- [ ] 迁移 `PushPinIcon`, `TodoWriteInputView`（加 memo）, `ToolCallGroup`（加 memo）

## Task 5 — 创建 `components/UserMessageItem.tsx`

- [ ] 新建 `src/renderer/components/cowork/components/UserMessageItem.tsx`
- [ ] 迁移 `UserMessageItem`（已有 memo）

## Task 6 — 创建 `components/StreamingActivityBar.tsx`

- [ ] 新建 `src/renderer/components/cowork/components/StreamingActivityBar.tsx`
- [ ] 迁移 `TypingDots`（加 memo）, `StreamingActivityBar`（加 memo）

## Task 7 — 创建 `components/AssistantTurnBlock.tsx`

- [ ] 新建 `src/renderer/components/cowork/components/AssistantTurnBlock.tsx`
- [ ] 迁移 `AssistantMessageItem`（加 memo）, `ThinkingBlock`（加 memo）, `AssistantTurnBlock`（加 memo）

## Task 8 — 创建 `CoworkSessionDetail.hooks.ts`

- [ ] 新建 `src/renderer/components/cowork/CoworkSessionDetail.hooks.ts`
- [ ] 实现 `useScrollBehavior`
- [ ] 实现 `useTurnNavigation`
- [ ] 实现 `useSessionMenu`
- [ ] 实现 `useRenameSession`
- [ ] 实现 `useExportImage`

## Task 9 — 重写 `CoworkSessionDetail.tsx`

- [ ] 主组件使用上述 hooks 和子组件重写，保留 JSX 逻辑
- [ ] 在文件末尾添加所有需要 re-export 的名称
- [ ] 确保原有 export：`UserMessageItem`, `AssistantTurnBlock`, `buildDisplayItems`, `buildConversationTurns`, `hasRenderableAssistantContent`, type `ToolGroupItem`, type `DisplayItem`, type `AssistantTurnItem`, type `ConversationTurn`

## Task 10 — 验证

- [ ] `npm run lint` 通过，无新增 error
- [ ] `npm run build`（或 `compile:electron`）通过，无 TypeScript 报错
- [ ] 启动 `npm run electron:dev` 手动验证会话详情页功能完整
