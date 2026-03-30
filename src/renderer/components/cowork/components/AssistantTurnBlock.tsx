import React, { useState, useEffect } from 'react'
import { InformationCircleIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { i18nService } from '../../../services/i18n'
import { getScheduledReminderDisplayText } from '../../../../common/scheduledReminderText'
import type { CoworkMessage, ConversationTurn, AssistantTurnItem } from '../CoworkSessionDetail.types'
import {
  getToolResultDisplay,
  getToolResultLineCount,
  getVisibleAssistantItems,
  hasText,
} from '../CoworkSessionDetail.utils'
import MarkdownContent from '../../MarkdownContent'
import ToolCallGroup from './ToolCallGroup'
import CopyButton from './CopyButton'
import { TypingDots } from './StreamingActivityBar'

// ─── AssistantMessageItem ──────────────────────────────────────────────────────

interface AssistantMessageItemProps {
  message: CoworkMessage
  resolveLocalFilePath?: (href: string, text: string) => string | null
  mapDisplayText?: (value: string) => string
  showCopyButton?: boolean
}

const AssistantMessageItem: React.FC<AssistantMessageItemProps> = React.memo(
  ({ message, resolveLocalFilePath, mapDisplayText, showCopyButton = false }) => {
    const [isHovered, setIsHovered] = useState(false)
    const displayContent = mapDisplayText ? mapDisplayText(message.content) : message.content

    return (
      <div className="relative" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <div className="dark:text-claude-darkText text-claude-text">
          <MarkdownContent
            content={displayContent}
            className="prose dark:prose-invert max-w-none"
            resolveLocalFilePath={resolveLocalFilePath}
          />
        </div>
        {showCopyButton && (
          <div className="flex items-center gap-1.5 mt-1">
            <CopyButton content={displayContent} visible={isHovered} />
          </div>
        )}
      </div>
    )
  },
)

AssistantMessageItem.displayName = 'AssistantMessageItem'

// ─── ThinkingBlock ─────────────────────────────────────────────────────────────

interface ThinkingBlockProps {
  message: CoworkMessage
  mapDisplayText?: (value: string) => string
}

const ThinkingBlock: React.FC<ThinkingBlockProps> = React.memo(({ message, mapDisplayText }) => {
  const isCurrentlyStreaming = Boolean(message.metadata?.isStreaming)
  const [isExpanded, setIsExpanded] = useState(isCurrentlyStreaming)
  const displayContent = mapDisplayText ? mapDisplayText(message.content) : message.content

  useEffect(() => {
    if (isCurrentlyStreaming) {
      setIsExpanded(true)
    } else {
      setIsExpanded(false)
    }
  }, [isCurrentlyStreaming])

  return (
    <div className="rounded-lg border dark:border-claude-darkBorder/50 border-claude-border/50 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left dark:hover:bg-claude-darkSurfaceHover/50 hover:bg-claude-surfaceHover/50 transition-colors"
      >
        <ChevronRightIcon
          className={`h-3.5 w-3.5 dark:text-claude-darkTextSecondary text-claude-textSecondary flex-shrink-0 transition-transform duration-200 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
        <span className="text-xs font-medium dark:text-claude-darkTextSecondary text-claude-textSecondary">
          {i18nService.t('reasoning')}
        </span>
        {isCurrentlyStreaming && <span className="w-1.5 h-1.5 rounded-full bg-claude-accent animate-pulse" />}
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 max-h-64 overflow-y-auto">
          <div className="text-xs leading-relaxed dark:text-claude-darkTextSecondary/80 text-claude-textSecondary/80 whitespace-pre-wrap">
            {displayContent}
          </div>
        </div>
      )}
    </div>
  )
})

ThinkingBlock.displayName = 'ThinkingBlock'

// ─── AssistantTurnBlock ────────────────────────────────────────────────────────

interface AssistantTurnBlockProps {
  turn: ConversationTurn
  resolveLocalFilePath?: (href: string, text: string) => string | null
  mapDisplayText?: (value: string) => string
  showTypingIndicator?: boolean
  showCopyButtons?: boolean
}

const renderSystemMessage = (message: CoworkMessage, mapDisplayText?: (value: string) => string): React.ReactNode => {
  const rawContent = hasText(message.content)
    ? message.content
    : typeof message.metadata?.error === 'string'
      ? message.metadata.error
      : ''
  const normalizedContent = getScheduledReminderDisplayText(rawContent) ?? rawContent
  const content = mapDisplayText ? mapDisplayText(normalizedContent) : normalizedContent
  if (!content.trim()) return null

  return (
    <div className="rounded-lg border dark:border-claude-darkBorder/70 border-claude-border/70 dark:bg-claude-darkBg/40 bg-claude-bg/60 px-3 py-2">
      <div className="flex items-start gap-2">
        <InformationCircleIcon className="h-4 w-4 mt-0.5 dark:text-claude-darkTextSecondary text-claude-textSecondary flex-shrink-0" />
        <div className="text-xs whitespace-pre-wrap dark:text-claude-darkTextSecondary text-claude-textSecondary">
          {content}
        </div>
      </div>
    </div>
  )
}

const renderOrphanToolResult = (
  message: CoworkMessage,
  mapDisplayText?: (value: string) => string,
): React.ReactNode => {
  const toolResultDisplayRaw = getToolResultDisplay(message)
  const toolResultDisplay = mapDisplayText ? mapDisplayText(toolResultDisplayRaw) : toolResultDisplayRaw
  const isToolError = Boolean(message.metadata?.isError || message.metadata?.error)
  const hasToolResultText = hasText(toolResultDisplay)
  const resultLineCount = hasToolResultText ? getToolResultLineCount(toolResultDisplay) : 0
  const showNoDetailError = isToolError && !hasToolResultText
  const fallbackText = showNoDetailError ? i18nService.t('coworkToolNoErrorDetail') : ''
  const displayText = hasToolResultText ? toolResultDisplay : fallbackText
  return (
    <div className="py-1">
      <div className="flex items-start gap-2">
        <span
          className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
            isToolError ? 'bg-red-500' : 'bg-claude-darkTextSecondary/50'
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium dark:text-claude-darkTextSecondary text-claude-textSecondary">
            {i18nService.t('coworkToolResult')}
          </div>
          {resultLineCount > 0 && (
            <div className="text-xs dark:text-claude-darkTextSecondary/60 text-claude-textSecondary/60 mt-0.5">
              {resultLineCount} {resultLineCount === 1 ? 'line' : 'lines'} of output
            </div>
          )}
          {resultLineCount === 0 && showNoDetailError && (
            <div
              className={`text-xs mt-0.5 ${
                isToolError ? 'text-red-500/80' : 'dark:text-claude-darkTextSecondary/60 text-claude-textSecondary/60'
              }`}
            >
              {fallbackText}
            </div>
          )}
          {(hasToolResultText || showNoDetailError) && (
            <div className="mt-2 px-3 py-2 rounded-lg dark:bg-claude-darkSurface/50 bg-claude-surface/50 max-h-64 overflow-y-auto">
              <pre
                className={`text-xs whitespace-pre-wrap break-words font-mono ${
                  isToolError
                    ? 'text-red-500'
                    : hasToolResultText
                      ? 'dark:text-claude-darkText text-claude-text'
                      : 'dark:text-claude-darkTextSecondary text-claude-textSecondary italic'
                }`}
              >
                {displayText}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const AssistantTurnBlock: React.FC<AssistantTurnBlockProps> = React.memo(
  ({ turn, resolveLocalFilePath, mapDisplayText, showTypingIndicator = false, showCopyButtons = true }) => {
    const visibleAssistantItems = getVisibleAssistantItems(turn.assistantItems)

    return (
      <div className="px-4 py-2">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0 px-4 py-3 space-y-3">
              {visibleAssistantItems.map((item: AssistantTurnItem, index: number) => {
                if (item.type === 'assistant') {
                  if (item.message.metadata?.isThinking) {
                    return (
                      <ThinkingBlock key={item.message.id} message={item.message} mapDisplayText={mapDisplayText} />
                    )
                  }
                  const hasToolGroupAfter = visibleAssistantItems
                    .slice(index + 1)
                    .some((laterItem) => laterItem.type === 'tool_group')

                  return (
                    <AssistantMessageItem
                      key={item.message.id}
                      message={item.message}
                      resolveLocalFilePath={resolveLocalFilePath}
                      mapDisplayText={mapDisplayText}
                      showCopyButton={showCopyButtons && !hasToolGroupAfter}
                    />
                  )
                }

                if (item.type === 'tool_group') {
                  const nextItem = visibleAssistantItems[index + 1]
                  const isLastInSequence = !nextItem || nextItem.type !== 'tool_group'
                  return (
                    <ToolCallGroup
                      key={`tool-${item.group.toolUse.id}`}
                      group={item.group}
                      isLastInSequence={isLastInSequence}
                      mapDisplayText={mapDisplayText}
                    />
                  )
                }

                if (item.type === 'system') {
                  const systemMessage = renderSystemMessage(item.message, mapDisplayText)
                  if (!systemMessage) return null
                  return <div key={item.message.id}>{systemMessage}</div>
                }

                return <div key={item.message.id}>{renderOrphanToolResult(item.message, mapDisplayText)}</div>
              })}
              {showTypingIndicator && <TypingDots />}
            </div>
          </div>
        </div>
      </div>
    )
  },
)

AssistantTurnBlock.displayName = 'AssistantTurnBlock'

export default AssistantTurnBlock
