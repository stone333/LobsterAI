# Tasks: 优化聊天消息列表渲染性能

## Phase 1: React.memo + 引用稳定化

### TASK-1.1 给 AssistantTurnBlock 包装 React.memo ✅

- **文件**: `src/renderer/components/cowork/CoworkSessionDetail.tsx`
- **操作**: 将 `AssistantTurnBlock` 的 `React.FC` 声明改为 `React.memo(...)` 包裹，加入自定义比较函数
- **比较函数**：对比 `turn`、`showTypingIndicator`、`showCopyButtons`、`resolveLocalFilePath`、`mapDisplayText` 五个 props
- **验收**: React DevTools Profiler 中，历史 turn 在流式输出时不再出现 re-render 高亮

### TASK-1.2 实现 turn 引用稳定化：`prevTurnsRef` ✅

- **文件**: `src/renderer/components/cowork/CoworkSessionDetail.tsx`
- **操作**:
  1. 在 refs 区域声明 `prevTurnsRef = useRef<ConversationTurn[]>([])`
  2. `buildConversationTurns` 结果存入 `rawTurns`，再通过稳定化 useMemo 生成最终 `turns`
  3. 比较策略：`turn.id` 相同 && `assistantItems.length` 相同 && 最后一个 assistantItem 内容指纹相同则复用旧引用
  4. 会话切换时在 useEffect 里重置 `prevTurnsRef.current = []`
- **验收**: 流式场景下前序 turn 的引用保持稳定

### TASK-1.3 确保 mapDisplayText 引用稳定 ✅

- **文件**: `src/renderer/components/cowork/CoworkSessionDetail.tsx`
- **操作**: 已确认 `mapDisplayText` 用 `useCallback(value => value, [])` 包裹，依赖项为空数组
- **验收**: `mapDisplayText` 在父组件重渲染时引用不变

---

## Phase 2: 列表虚拟化

### TASK-2.1 安装 @tanstack/react-virtual

- **操作**: `npm install @tanstack/react-virtual`
- **验收**: `package.json` 中出现该依赖

### TASK-2.2 实现虚拟化渲染逻辑

- **文件**: `src/renderer/components/cowork/CoworkSessionDetail.tsx`
- **操作**:
  1. 在 `renderConversationTurns` 函数中，当 `turns.length > VIRTUALIZE_THRESHOLD`（30）时使用虚拟化路径
  2. 引入 `useVirtualizer`，绑定到现有的 `scrollContainerRef`
  3. 外层容器改为 `position: relative`，高度为 `virtualizer.getTotalSize()`
  4. 每个 virtual item 使用 `position: absolute`，`top: virtualItem.start`
  5. 每个 item 挂载 `ref={virtualizer.measureElement}` 进行动态高度测量
  6. 保留 `data-turn-index` 属性，值为 `virtualItem.index`
- **验收**: 大会话（>30 turns）时，DOM 中实际挂载的 turn 节点数量 ≈ 可见 turn 数 + 10（overscan）

### TASK-2.3 适配自动滚动到底部

- **文件**: `src/renderer/components/cowork/CoworkSessionDetail.tsx`
- **操作**:
  1. 在虚拟化路径下，将 `container.scrollTop = container.scrollHeight` 替换为 `virtualizer.scrollToIndex(turns.length - 1, { align: 'end' })`
  2. 非虚拟化路径保持原逻辑不变
- **验收**: 新消息到达时，虚拟化模式下能正确滚动到底部

### TASK-2.4 适配 turn index 导航

- **文件**: `src/renderer/components/cowork/CoworkSessionDetail.tsx`
- **操作**:
  1. 找到当前使用 `querySelectorAll('[data-turn-index]')` 的导航逻辑（`turnElsCacheRef`）
  2. 在虚拟化模式下，改为先调用 `virtualizer.scrollToIndex(targetIndex)`，再在下一帧查找 DOM
  3. 非虚拟化路径保持原逻辑不变
- **验收**: 导航快捷键在虚拟化模式下仍能跳转到目标 turn

### TASK-2.5 适配导出功能（截图/文本导出）

- **文件**: `src/renderer/components/cowork/CoworkSessionDetail.tsx`
- **操作**:
  1. 添加 `isExporting` ref/state（默认 false）
  2. 导出开始前设为 true，触发 fallback 到全量渲染模式（`useVirtualize = false`）
  3. 等待一个渲染帧（`requestAnimationFrame`）后执行导出
  4. 导出结束后恢复 `isExporting = false`
  5. 找到现有导出入口（截图、Markdown 导出），在对应位置插入此逻辑
- **验收**: 虚拟化模式下执行导出，导出结果包含所有历史消息

---

## 验收标准汇总

| 场景                    | 期望结果                               |
| ----------------------- | -------------------------------------- |
| 流式输出，20 条历史消息 | 只有最后一个 turn 重渲染               |
| 静态会话，100 条消息    | DOM 中 turn 节点数 ≈ 可见数 + overscan |
| 点击"新消息"            | 虚拟化模式下正确滚动到底部             |
| 导出截图                | 包含所有消息，无截断                   |
| 会话切换                | 虚拟化状态重置，不残留上一个会话的状态 |
| 小会话（≤30 turns）     | 走原始 `turns.map` 路径，无虚拟化      |
