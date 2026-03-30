import type { CoworkMessage, CoworkImageAttachment } from '../../types/cowork'
import type { Skill } from '../../types/skill'

export type { CoworkMessage, CoworkImageAttachment, Skill }

export type CaptureRect = { x: number; y: number; width: number; height: number }

export type TodoStatus = 'completed' | 'in_progress' | 'pending' | 'unknown'

export type ParsedTodoItem = {
  primaryText: string
  secondaryText: string | null
  status: TodoStatus
}

export type ToolGroupItem = {
  type: 'tool_group'
  toolUse: CoworkMessage
  toolResult?: CoworkMessage | null
}

export type DisplayItem = { type: 'message'; message: CoworkMessage } | ToolGroupItem

export type AssistantTurnItem =
  | { type: 'assistant'; message: CoworkMessage }
  | { type: 'system'; message: CoworkMessage }
  | { type: 'tool_group'; group: ToolGroupItem }
  | { type: 'tool_result'; message: CoworkMessage }

export type ConversationTurn = {
  id: string
  userMessage: CoworkMessage | null
  assistantItems: AssistantTurnItem[]
}

export interface CoworkSessionDetailProps {
  onManageSkills?: () => void
  onContinue: (
    prompt: string,
    skillPrompt?: string,
    imageAttachments?: CoworkImageAttachment[],
  ) => boolean | void | Promise<boolean | void>
  onStop: () => void
  onNavigateHome?: () => void
  isSidebarCollapsed?: boolean
  onToggleSidebar?: () => void
  onNewChat?: () => void
  updateBadge?: React.ReactNode
}
