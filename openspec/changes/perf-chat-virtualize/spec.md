# Spec: 优化聊天消息列表渲染性能

## 背景

Issue #645：聊天记录多了之后 UI 非常卡，建议加入聊天记录的局部按需渲染。

经过代码分析，确认以下根本原因：

1. `AssistantTurnBlock` 组件没有 `React.memo`，导致流式输出时所有历史 turn 全量重渲染
2. `buildConversationTurns` 每次 messages 变化都重建全部 turn 对象引用，破坏潜在的 memo 效果
3. 没有列表虚拟化，大量消息时 DOM 节点数量线性增长，浏览器 layout/paint 越来越慢

## 功能需求（EARS 格式）

### REQ-1：AssistantTurnBlock 记忆化

WHEN messages 数组发生变化时，
THE SYSTEM SHALL 仅重新渲染内容实际发生变化的 `AssistantTurnBlock`，
已渲染的历史 turn 不应重新渲染（除非其内容确实变化）。

### REQ-2：稳定化 turn 对象引用

WHEN 流式消息更新到最后一条消息时，
THE SYSTEM SHALL 保持前序 turn 的对象引用不变，
仅替换发生变化的 turn 对象引用，
使 React.memo 能有效拦截不必要的重渲染。

### REQ-3：消息列表虚拟化

WHEN 会话的 turn 数量超过阈值时，
THE SYSTEM SHALL 仅渲染当前视口内可见的 turn 节点，
不可见的 turn 在 DOM 中不挂载（或卸载），
滚动体验保持流畅。

WHILE 虚拟化处于活跃状态，
THE SYSTEM SHALL 保持以下现有行为不变：

- 自动滚动到底部（新消息到达时）
- 导航快捷键（turn index 跳转）
- 导出功能（截图/文本导出）

### REQ-4：流式输出时性能目标

WHEN 会话处于流式输出状态（isStreaming=true）时，
THE SYSTEM SHALL 将每次 Redux 状态更新触发的重渲染范围
限制在最后一个 turn 的相关组件内，
历史 turn 的组件不参与重渲染。

## 非功能需求

- 不引入破坏性 UI 变化，用户视觉体验保持一致
- 导出（截图、文本）功能需要在虚拟化模式下继续工作
- 虚拟化仅在 turn 数量超过阈值（建议 30）时启用，避免小会话引入不必要复杂度

## 范围

**本次变更包含**：

- `CoworkSessionDetail.tsx` 的渲染性能优化
- turn 引用稳定化逻辑

**本次变更不包含**：

- 分页加载历史消息（数据层面的懒加载）
- SQLite 查询优化
- 其他页面的性能优化
