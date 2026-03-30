import React, { useState } from 'react'
import { CheckIcon } from '@heroicons/react/24/outline'
import { i18nService } from '../../../services/i18n'
import type { ToolGroupItem, ParsedTodoItem, TodoStatus } from '../CoworkSessionDetail.types'
import {
  getToolDisplayName,
  isBashLikeToolName,
  isTodoWriteToolName,
  isCronToolName,
  parseTodoWriteItems,
  formatToolInput,
  getToolInputSummary,
  getToolResultDisplay,
  getToolResultLineCount,
  truncatePreview,
  hasText,
} from '../CoworkSessionDetail.utils'

// ─── PushPinIcon ───────────────────────────────────────────────────────────────

export const PushPinIcon: React.FC<React.SVGProps<SVGSVGElement> & { slashed?: boolean }> = ({ slashed, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <g transform="rotate(45 12 12)">
      <path d="M9 3h6l-1 5 2 2v2H8v-2l2-2-1-5z" />
      <path d="M12 12v9" />
    </g>
    {slashed && <path d="M5 5L19 19" />}
  </svg>
)

// ─── TodoWriteInputView ────────────────────────────────────────────────────────

const getStatusCheckboxClass = (status: TodoStatus): string => {
  switch (status) {
    case 'completed':
      return 'bg-green-500/10 border-green-500 text-green-500'
    case 'in_progress':
      return 'bg-transparent border-blue-500'
    case 'pending':
    case 'unknown':
    default:
      return 'bg-transparent dark:border-claude-darkTextSecondary/60 border-claude-textSecondary/60'
  }
}

const TodoWriteInputView: React.FC<{ items: ParsedTodoItem[] }> = React.memo(({ items }) => (
  <div className="space-y-2">
    {items.map((item, index) => (
      <div key={`todo-item-${index}`} className="flex items-start gap-2">
        <span
          className={`mt-0.5 h-4 w-4 rounded-[4px] border flex-shrink-0 inline-flex items-center justify-center ${getStatusCheckboxClass(item.status)}`}
        >
          {item.status === 'completed' && <CheckIcon className="h-3 w-3 stroke-[2.5]" />}
        </span>
        <div className="min-w-0 flex-1">
          <div
            className={`text-xs whitespace-pre-wrap break-words leading-5 ${
              item.status === 'completed'
                ? 'dark:text-claude-darkTextSecondary/70 text-claude-textSecondary/80'
                : 'dark:text-claude-darkText text-claude-text'
            }`}
          >
            {item.primaryText}
          </div>
        </div>
      </div>
    ))}
  </div>
))

TodoWriteInputView.displayName = 'TodoWriteInputView'

// ─── ToolCallGroup ─────────────────────────────────────────────────────────────

interface ToolCallGroupProps {
  group: ToolGroupItem
  isLastInSequence?: boolean
  mapDisplayText?: (value: string) => string
}

const ToolCallGroup: React.FC<ToolCallGroupProps> = React.memo(({ group, isLastInSequence = true, mapDisplayText }) => {
  const { toolUse, toolResult } = group
  const rawToolName = typeof toolUse.metadata?.toolName === 'string' ? toolUse.metadata.toolName : 'Tool'
  const toolName = getToolDisplayName(rawToolName)
  const toolInput = toolUse.metadata?.toolInput
  const isCronTool = isCronToolName(rawToolName)
  const isTodoWriteTool = isTodoWriteToolName(rawToolName)
  const todoItems = isTodoWriteTool ? parseTodoWriteItems(toolInput) : null
  const mapText = mapDisplayText ?? ((value: string) => value)
  const toolInputDisplayRaw = formatToolInput(rawToolName, toolInput)
  const toolInputDisplay = toolInputDisplayRaw ? mapText(toolInputDisplayRaw) : null
  const toolInputSummaryRaw = getToolInputSummary(rawToolName, toolInput) ?? toolInputDisplayRaw
  const toolInputSummary = toolInputSummaryRaw ? mapText(toolInputSummaryRaw) : null
  const toolResultDisplayRaw = toolResult ? getToolResultDisplay(toolResult) : ''
  const toolResultDisplay = mapText(toolResultDisplayRaw)
  const hasToolResultText = hasText(toolResultDisplay)
  const isToolError = Boolean(toolResult?.metadata?.isError || toolResult?.metadata?.error)
  const showNoDetailError = isToolError && !hasToolResultText
  const toolResultFallback = showNoDetailError ? i18nService.t('coworkToolNoErrorDetail') : ''
  const displayToolResult = hasToolResultText ? toolResultDisplay : toolResultFallback
  const [isExpanded, setIsExpanded] = useState(false)
  const resultLineCount = hasToolResultText ? getToolResultLineCount(toolResultDisplay) : 0
  const toolResultSummary =
    isCronTool && hasToolResultText ? truncatePreview(toolResultDisplay.replace(/\s+/g, ' ')) : null
  const isBashTool = isBashLikeToolName(rawToolName)

  return (
    <div className="relative py-1">
      {/* Vertical connecting line to next tool group */}
      {!isLastInSequence && (
        <div className="absolute left-[3.5px] top-[14px] bottom-[-8px] w-px dark:bg-claude-darkTextSecondary/30 bg-claude-textSecondary/30" />
      )}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start gap-2 text-left group relative z-10"
      >
        <span
          className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
            !toolResult ? 'bg-blue-500 animate-pulse' : isToolError ? 'bg-red-500' : 'bg-green-500'
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium dark:text-claude-darkTextSecondary text-claude-textSecondary">
              {toolName}
            </span>
            {toolInputSummary && (
              <code className="text-xs dark:text-claude-darkTextSecondary/80 text-claude-textSecondary/80 font-mono truncate max-w-[400px]">
                {toolInputSummary}
              </code>
            )}
          </div>
          {toolResult && !isTodoWriteTool && (hasToolResultText || showNoDetailError) && (
            <div
              className={`text-xs mt-0.5 ${
                hasToolResultText
                  ? 'dark:text-claude-darkTextSecondary/60 text-claude-textSecondary/60'
                  : showNoDetailError
                    ? 'text-red-500/80'
                    : 'dark:text-claude-darkTextSecondary/60 text-claude-textSecondary/60'
              }`}
            >
              {hasToolResultText
                ? (toolResultSummary ?? `${resultLineCount} ${resultLineCount === 1 ? 'line' : 'lines'} of output`)
                : toolResultFallback}
            </div>
          )}
          {!toolResult && (
            <div className="text-xs dark:text-claude-darkTextSecondary/60 text-claude-textSecondary/60 mt-0.5">
              {i18nService.t('coworkToolRunning')}
            </div>
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="ml-4 mt-2">
          {isBashTool ? (
            <div className="rounded-lg overflow-hidden border dark:border-claude-darkBorder border-claude-border">
              <div className="flex items-center gap-1.5 px-3 py-1.5 dark:bg-claude-darkSurface bg-claude-surfaceInset">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="ml-2 text-[10px] dark:text-claude-darkTextSecondary text-claude-textSecondary font-medium">
                  Terminal
                </span>
              </div>
              <div className="dark:bg-claude-darkSurfaceInset bg-claude-surfaceInset px-3 py-3 max-h-72 overflow-y-auto font-mono text-xs">
                {toolInputDisplay && (
                  <div className="dark:text-claude-darkText text-claude-text">
                    <span className="text-claude-accent select-none">$ </span>
                    <span className="whitespace-pre-wrap break-words">{toolInputDisplay}</span>
                  </div>
                )}
                {toolResult && (hasToolResultText || showNoDetailError) && (
                  <div
                    className={`mt-1.5 whitespace-pre-wrap break-words ${
                      isToolError
                        ? 'text-red-400'
                        : hasToolResultText
                          ? 'dark:text-claude-darkTextSecondary text-claude-textSecondary'
                          : 'dark:text-claude-darkTextSecondary/70 text-claude-textSecondary/70 italic'
                    }`}
                  >
                    {displayToolResult}
                  </div>
                )}
                {!toolResult && (
                  <div className="dark:text-claude-darkTextSecondary/60 text-claude-textSecondary/60 mt-1.5 italic">
                    {i18nService.t('coworkToolRunning')}
                  </div>
                )}
              </div>
            </div>
          ) : isTodoWriteTool && todoItems ? (
            <TodoWriteInputView items={todoItems} />
          ) : (
            <div className="space-y-2">
              {toolInputDisplay && (
                <div>
                  <div className="text-[10px] font-medium dark:text-claude-darkTextSecondary/70 text-claude-textSecondary/70 uppercase tracking-wider mb-1">
                    {i18nService.t('coworkToolInput')}
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <pre className="text-xs dark:text-claude-darkText text-claude-text whitespace-pre-wrap break-words font-mono">
                      {toolInputDisplay}
                    </pre>
                  </div>
                </div>
              )}
              {toolResult && (hasToolResultText || showNoDetailError) && (
                <div>
                  <div className="text-[10px] font-medium dark:text-claude-darkTextSecondary/70 text-claude-textSecondary/70 uppercase tracking-wider mb-1">
                    {i18nService.t('coworkToolResult')}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <pre
                      className={`text-xs whitespace-pre-wrap break-words font-mono ${
                        isToolError
                          ? 'text-red-500'
                          : hasToolResultText
                            ? 'dark:text-claude-darkText text-claude-text'
                            : 'dark:text-claude-darkTextSecondary text-claude-textSecondary italic'
                      }`}
                    >
                      {displayToolResult}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

ToolCallGroup.displayName = 'ToolCallGroup'

export default ToolCallGroup
