import React from 'react'
import { i18nService } from '../../../services/i18n'
import type { CoworkMessage } from '../CoworkSessionDetail.types'

// ─── TypingDots ────────────────────────────────────────────────────────────────

export const TypingDots: React.FC = React.memo(() => (
  <div className="flex items-center space-x-1.5 py-1">
    <div className="w-2 h-2 rounded-full bg-claude-accent animate-bounce" style={{ animationDelay: '0ms' }} />
    <div className="w-2 h-2 rounded-full bg-claude-accent animate-bounce" style={{ animationDelay: '150ms' }} />
    <div className="w-2 h-2 rounded-full bg-claude-accent animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
))

TypingDots.displayName = 'TypingDots'

// ─── StreamingActivityBar ──────────────────────────────────────────────────────

interface StreamingActivityBarProps {
  messages: CoworkMessage[]
}

export const StreamingActivityBar: React.FC<StreamingActivityBarProps> = React.memo(({ messages }) => {
  const getStatusText = (): string => {
    const toolResultIds = new Set<string>()
    for (const msg of messages) {
      const id = msg.metadata?.toolUseId
      if (typeof id === 'string' && msg.type === 'tool_result') {
        toolResultIds.add(id)
      }
    }
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.type === 'tool_use') {
        const id = msg.metadata?.toolUseId
        if (typeof id === 'string' && !toolResultIds.has(id)) {
          const toolName = typeof msg.metadata?.toolName === 'string' ? msg.metadata.toolName : null
          if (toolName) {
            return `${i18nService.t('coworkToolRunning')} ${toolName}...`
          }
        }
      }
    }
    return `${i18nService.t('coworkToolRunning')}`
  }

  return (
    <div className="shrink-0 animate-fade-in px-4">
      <div className="max-w-3xl mx-auto">
        <div className="streaming-bar" />
        <div className="py-1">
          <span className="text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary">
            {getStatusText()}
          </span>
        </div>
      </div>
    </div>
  )
})

StreamingActivityBar.displayName = 'StreamingActivityBar'

export default StreamingActivityBar
