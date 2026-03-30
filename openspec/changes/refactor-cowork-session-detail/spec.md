# Spec: Refactor CoworkSessionDetail into Focused Modules

## Background

`src/renderer/components/cowork/CoworkSessionDetail.tsx` is a monolithic 2100+ line file that contains:

- ~30 pure utility functions
- ~10 sub-components (some already exported, some internal)
- Complex scroll logic, export logic, and menu logic in the main component
- No `React.memo` on several hot-path sub-components

This makes the file hard to maintain and prevents effective tree-shaking or independent testing of sub-components.

## Goals

1. Split the file into focused, single-responsibility modules under `src/renderer/components/cowork/`
2. Apply `React.memo` to all stateless sub-components that render inside message lists (hot render path)
3. Preserve **all existing exports** (`UserMessageItem`, `AssistantTurnBlock`, `buildDisplayItems`, `buildConversationTurns`, `hasRenderableAssistantContent`, type exports) so that any external consumers continue to work without changes
4. Keep `CoworkSessionDetail` as the default export of `CoworkSessionDetail.tsx`; it re-exports everything from the new sub-modules so no import paths in other files change
5. Zero functional/visual regression — no UI or behavior changes

## Non-Goals

- Changing any Redux state shape
- Introducing virtual scrolling (separate change)
- Changing any public API / props interface

## Target File Structure

```
src/renderer/components/cowork/
├── CoworkSessionDetail.tsx          (main component, ~400 lines — orchestration only)
├── CoworkSessionDetail.types.ts     (shared types: DisplayItem, ConversationTurn, etc.)
├── CoworkSessionDetail.utils.ts     (all pure utility functions: buildDisplayItems, buildConversationTurns, formatToolInput, etc.)
├── CoworkSessionDetail.hooks.ts     (custom hooks: useScrollBehavior, useTurnNavigation, useSessionMenu, useRenameSession, useExportImage)
├── components/
│   ├── ToolCallGroup.tsx            (ToolCallGroup component + TodoWriteInputView)
│   ├── UserMessageItem.tsx          (UserMessageItem component, already exported)
│   ├── AssistantTurnBlock.tsx       (AssistantTurnBlock + AssistantMessageItem + ThinkingBlock)
│   ├── StreamingActivityBar.tsx     (StreamingActivityBar + TypingDots)
│   └── CopyButton.tsx               (CopyButton)
```

## Requirements

### WHEN splitting into modules

- THEN each new file must have all necessary imports (no circular deps)
- THEN utility functions must be pure (no side effects, no React hooks)
- THEN hooks must not import from component files (only from types/utils)

### WHEN applying React.memo

- THEN `ToolCallGroup`, `AssistantMessageItem`, `ThinkingBlock`, `StreamingActivityBar`, `TypingDots`, `CopyButton` must be wrapped with `React.memo`
- THEN `UserMessageItem` is already memo'd — preserve that

### WHEN re-exporting from CoworkSessionDetail.tsx

- THEN all previously exported names must remain importable from `CoworkSessionDetail.tsx`
- THEN `CoworkSessionDetail` remains the default export

### WHEN running the app after refactor

- THEN there must be zero TypeScript compilation errors
- THEN the visual output and interaction behavior of CoworkSessionDetail must be identical to before
