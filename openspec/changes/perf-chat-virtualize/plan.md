# Plan: 优化聊天消息列表渲染性能

## 技术方案总览

```
优化层次（从易到难，按顺序实施）：

┌─────────────────────────────────────────────────────┐
│  Phase 1: React.memo + 引用稳定化（低风险，高收益）    │
│                                                     │
│  AssistantTurnBlock → React.memo                    │
│  useMemo(turns) → 稳定化引用（只替换变化的 turn）     │
└───────────────────────┬─────────────────────────────┘
                        │ 解决流式输出时的重渲染问题
                        ▼
┌─────────────────────────────────────────────────────┐
│  Phase 2: 虚拟化列表（中等风险，解决大数据量卡顿）     │
│                                                     │
│  @tanstack/react-virtual（动态高度虚拟化）            │
│  导出功能适配（暂时展开全量 DOM）                      │
└─────────────────────────────────────────────────────┘
```

## Phase 1 详细设计

### 1.1 给 AssistantTurnBlock 加 React.memo

```tsx
export const AssistantTurnBlock = React.memo(
  (props) => { ... },
  (prev, next) =>
    prev.turn === next.turn &&
    prev.showTypingIndicator === next.showTypingIndicator &&
    prev.showCopyButtons === next.showCopyButtons &&
    prev.resolveLocalFilePath === next.resolveLocalFilePath &&
    prev.mapDisplayText === next.mapDisplayText
);
```

关键：只有当 `turn` 对象引用相同时才跳过渲染，因此需要配合 Phase 1.2。

### 1.2 稳定化 turn 对象引用

当前问题：每次 `buildConversationTurns(displayItems)` 都返回全新的数组和对象。

解决方案：用 `useRef` 缓存上一次的 turns，对比变化，只替换真正变化的 turn：

```
新 turns 构建完成后：
  for i in range(turns.length):
    if turns[i] 内容与 prevTurns[i] 内容相同（通过 id + assistantItems 长度 + 最后一条消息内容判断）:
      reuse prevTurns[i]  ← 保持引用稳定，React.memo 可拦截
    else:
      use turns[i]         ← 新对象，触发重渲染
```

判断 turn 是否变化的指标（轻量比较，避免深比较）：

- `turn.id` 相同
- `turn.assistantItems.length` 相同
- 最后一个 `assistantItem` 的内容 token（message id + content 长度）相同

流式场景下，通常只有最后一个 turn 的最后一条 assistantItem 在变化，
前序 turn 全部命中缓存，跳过重渲染。

### 1.3 mapDisplayText 已有 useCallback，保持不变

## Phase 2 详细设计

### 2.1 引入 @tanstack/react-virtual

```bash
npm install @tanstack/react-virtual
```

使用 `useVirtualizer`，动态高度模式：

```tsx
const virtualizer = useVirtualizer({
  count: turns.length,
  getScrollElement: () => scrollContainerRef.current,
  estimateSize: () => 200, // 初始估算高度
  measureElement: true, // 实测真实高度
  overscan: 5, // 视口外多渲染 5 个，避免滚动白屏
})
```

### 2.2 渲染结构变更

```tsx
// 当前（全量渲染）
turns.map((turn, index) => <div key={turn.id} ...>...</div>)

// 虚拟化后
<div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
  {virtualizer.getVirtualItems().map((virtualItem) => {
    const turn = turns[virtualItem.index];
    return (
      <div
        key={turn.id}
        data-index={virtualItem.index}
        ref={virtualizer.measureElement}
        style={{
          position: 'absolute',
          top: virtualItem.start,
          width: '100%',
        }}
      >
        <ConversationTurnRow turn={turn} ... />
      </div>
    );
  })}
</div>
```

### 2.3 自动滚动到底部适配

`virtualizer` 提供 `scrollToIndex` API：

```tsx
virtualizer.scrollToIndex(turns.length - 1, { align: 'end' })
```

替换当前的 `container.scrollTop = container.scrollHeight`。

### 2.4 turn index 导航适配

当前导航逻辑依赖 DOM 查询 `[data-turn-index]`，虚拟化后不可见的 turn 没有 DOM 节点。

适配方案：改用 `virtualizer.scrollToIndex(targetIndex)` 先滚动到目标位置，再查找 DOM。

### 2.5 导出功能适配

导出（截图/文本）需要完整 DOM。

策略：导出前临时设置 `virtualizer` 的 `overscan` 为 `Infinity` 或直接 fallback 到非虚拟化渲染（通过 `isExporting` 状态切换），导出完成后恢复。

### 2.6 虚拟化启用阈值

```tsx
const VIRTUALIZE_THRESHOLD = 30 // turns 数量超过 30 时启用虚拟化
const useVirtualize = turns.length > VIRTUALIZE_THRESHOLD
```

小会话直接用原始 `turns.map`，避免引入不必要复杂度。

## 技术选型理由

| 方案                      | 优点                       | 缺点                                              |
| ------------------------- | -------------------------- | ------------------------------------------------- |
| `@tanstack/react-virtual` | 成熟、无依赖、支持动态高度 | 需要适配现有滚动/导出逻辑                         |
| `react-window`            | 轻量                       | 不支持动态高度（需 react-window-infinite-loader） |
| 手写虚拟化                | 零依赖                     | 工作量大，难以维护                                |

选择 `@tanstack/react-virtual`。

## 风险评估

| 风险                               | 可能性 | 影响 | 缓解措施                                |
| ---------------------------------- | ------ | ---- | --------------------------------------- |
| 虚拟化后导出截图不完整             | 中     | 高   | 导出前临时展开全量 DOM                  |
| 动态高度计算不准导致跳动           | 中     | 中   | 设置合理 estimateSize，加 smooth scroll |
| turn 引用比较逻辑有 bug 导致不更新 | 低     | 高   | 充分测试流式场景，保守比较策略          |
| 虚拟化后 data-turn-index 导航失效  | 高     | 中   | 改用 scrollToIndex API                  |

## 实施顺序

Phase 1 先于 Phase 2，因为：

1. Phase 1 风险低，可以立即上线
2. Phase 1 的收益在流式场景下已经非常显著
3. Phase 2 如果出现兼容问题，不影响 Phase 1 的收益
