import React, { useRef, useEffect, useCallback, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { i18nService } from '../../services/i18n'
import CoworkPromptInput from './CoworkPromptInput'
import SidebarToggleIcon from '../icons/SidebarToggleIcon'
import ComposeIcon from '../icons/ComposeIcon'
import EllipsisHorizontalIcon from '../icons/EllipsisHorizontalIcon'
import PencilSquareIcon from '../icons/PencilSquareIcon'
import TrashIcon from '../icons/TrashIcon'
import WindowTitleBar from '../window/WindowTitleBar'
import { FolderIcon } from '@heroicons/react/24/solid'
import { ShareIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { coworkService } from '../../services/cowork'
import { buildDisplayItems, buildConversationTurns, hasRenderableAssistantContent } from './CoworkSessionDetail.utils'
import {
  useScrollBehavior,
  useSessionMenu,
  useRenameSession,
  useExportImage,
  useResolveLocalFilePath,
  useTruncatePath,
} from './CoworkSessionDetail.hooks'
import { UserMessageItem } from './components/UserMessageItem'
import { AssistantTurnBlock } from './components/AssistantTurnBlock'
import { StreamingActivityBar } from './components/StreamingActivityBar'
import { PushPinIcon } from './components/ToolCallGroup'

// Re-export all public types and functions so existing import paths remain valid
export type {
  ToolGroupItem,
  DisplayItem,
  AssistantTurnItem,
  ConversationTurn,
  CoworkSessionDetailProps,
} from './CoworkSessionDetail.types'
export { buildDisplayItems, buildConversationTurns, hasRenderableAssistantContent } from './CoworkSessionDetail.utils'
export { UserMessageItem } from './components/UserMessageItem'
export { AssistantTurnBlock } from './components/AssistantTurnBlock'

import type { CoworkSessionDetailProps } from './CoworkSessionDetail.types'

const CoworkSessionDetail: React.FC<CoworkSessionDetailProps> = ({
  onManageSkills,
  onContinue,
  onStop,
  onNavigateHome,
  isSidebarCollapsed,
  onToggleSidebar,
  onNewChat,
  updateBadge,
}) => {
  const isMac = window.electron.platform === 'darwin'
  const currentSession = useSelector((state: RootState) => state.cowork.currentSession)
  const isStreaming = useSelector((state: RootState) => state.cowork.isStreaming)
  const skills = useSelector((state: RootState) => state.skill.skills)
  const detailRootRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const actionButtonRef = useRef<HTMLButtonElement>(null)

  const messages = currentSession?.messages
  const displayItems = useMemo(() => (messages ? buildDisplayItems(messages) : []), [messages])
  const turns = useMemo(() => buildConversationTurns(displayItems), [displayItems])

  const {
    shouldAutoScroll,
    setShouldAutoScroll,
    isScrollable,
    handleMessagesScroll,
    currentTurnIndex,
    setCurrentTurnIndex,
    currentTurnIndexRef,
    showTurnNav,
    navigateToTurn,
  } = useScrollBehavior(scrollContainerRef, turns)

  const {
    isRenaming,
    renameValue,
    setRenameValue,
    renameInputRef,
    handleRenameClick,
    handleRenameSave,
    handleRenameCancel,
    handleRenameBlur,
  } = useRenameSession(currentSession)

  const { menuPosition, menuRef, showConfirmDelete, setShowConfirmDelete, openMenu, closeMenu } = useSessionMenu(
    actionButtonRef,
    isRenaming,
  )

  const { isExportingImage, handleShareClick } = useExportImage(currentSession, scrollContainerRef)

  const resolveLocalFilePath = useResolveLocalFilePath(currentSession?.cwd)
  const truncatePath = useTruncatePath()

  const mapDisplayText = useCallback((value: string): string => value, [])

  useEffect(() => {
    setShouldAutoScroll(true)
  }, [currentSession?.id, setShouldAutoScroll])

  const lastMessage = currentSession?.messages?.[currentSession.messages.length - 1]
  const lastMessageContent = lastMessage?.content

  useEffect(() => {
    if (!shouldAutoScroll) return
    const container = scrollContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
    if (turns.length > 0) {
      const lastIndex = turns.length - 1
      currentTurnIndexRef.current = lastIndex
      setCurrentTurnIndex(lastIndex)
    }
  }, [
    currentSession?.messages?.length,
    lastMessageContent,
    isStreaming,
    shouldAutoScroll,
    turns.length,
    currentTurnIndexRef,
    setCurrentTurnIndex,
  ])

  const handleOpenFolder = useCallback(async () => {
    if (!currentSession?.cwd) return
    try {
      await window.electron.shell.openPath(currentSession.cwd)
    } catch (error) {
      console.error('Failed to open folder:', error)
    }
  }, [currentSession?.cwd])

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!currentSession) return
    await coworkService.setSessionPinned(currentSession.id, !currentSession.pinned)
    closeMenu()
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowConfirmDelete(true)
    closeMenu()
  }

  const handleConfirmDelete = async () => {
    if (!currentSession) return
    await coworkService.deleteSession(currentSession.id)
    setShowConfirmDelete(false)
    if (onNavigateHome) onNavigateHome()
  }

  const handleCancelDelete = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setShowConfirmDelete(false)
  }

  const renderConversationTurns = () => {
    if (turns.length === 0) {
      if (!isStreaming) return null
      return (
        <div data-export-role="assistant-block">
          <AssistantTurnBlock
            turn={{ id: 'streaming-only', userMessage: null, assistantItems: [] }}
            resolveLocalFilePath={resolveLocalFilePath}
            showTypingIndicator
            showCopyButtons={false}
          />
        </div>
      )
    }

    return turns.map((turn, index) => {
      const isLastTurn = index === turns.length - 1
      const showTypingIndicator = isStreaming && isLastTurn && !hasRenderableAssistantContent(turn)
      const showAssistantBlock = turn.assistantItems.length > 0 || showTypingIndicator

      return (
        <div key={turn.id} data-turn-index={index}>
          {turn.userMessage && (
            <div data-export-role="user-message">
              <UserMessageItem message={turn.userMessage} skills={skills} />
            </div>
          )}
          {showAssistantBlock && (
            <div data-export-role="assistant-block">
              <AssistantTurnBlock
                turn={turn}
                resolveLocalFilePath={resolveLocalFilePath}
                mapDisplayText={mapDisplayText}
                showTypingIndicator={showTypingIndicator}
                showCopyButtons={!isStreaming}
              />
            </div>
          )}
        </div>
      )
    })
  }

  if (!currentSession) return null

  return (
    <div ref={detailRootRef} className="flex-1 flex flex-col dark:bg-claude-darkBg bg-claude-bg h-full">
      <div className="draggable flex h-12 items-center justify-between px-4 border-b dark:border-claude-darkBorder border-claude-border dark:bg-claude-darkSurface/50 bg-claude-surface/50 shrink-0">
        <div className="flex h-full items-center gap-2 min-w-0">
          {isSidebarCollapsed && (
            <div className={`non-draggable flex items-center gap-1 ${isMac ? 'pl-[68px]' : ''}`}>
              <button
                type="button"
                onClick={onToggleSidebar}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg dark:text-claude-darkTextSecondary text-claude-textSecondary hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover transition-colors"
              >
                <SidebarToggleIcon className="h-4 w-4" isCollapsed={true} />
              </button>
              <button
                type="button"
                onClick={onNewChat}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg dark:text-claude-darkTextSecondary text-claude-textSecondary hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover transition-colors"
              >
                <ComposeIcon className="h-4 w-4" />
              </button>
              {updateBadge}
            </div>
          )}
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSave(e)
                if (e.key === 'Escape') handleRenameCancel(e)
              }}
              onBlur={handleRenameBlur}
              className="non-draggable min-w-0 max-w-[300px] rounded-lg border dark:border-claude-darkBorder border-claude-border dark:bg-claude-darkBg bg-claude-bg px-2 py-1 text-sm font-medium dark:text-claude-darkText text-claude-text focus:outline-none focus:ring-2 focus:ring-claude-accent"
            />
          ) : (
            <h1 className="text-sm leading-none font-medium dark:text-claude-darkText text-claude-text truncate max-w-[360px]">
              {currentSession.title || i18nService.t('coworkNewSession')}
            </h1>
          )}
        </div>

        <div className="non-draggable flex items-center gap-1">
          <button
            type="button"
            onClick={handleOpenFolder}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm dark:text-claude-darkTextSecondary text-claude-textSecondary dark:hover:bg-claude-darkSurfaceHover hover:bg-claude-surfaceHover dark:hover:text-claude-darkText hover:text-claude-text transition-colors"
            aria-label={i18nService.t('coworkOpenFolder')}
          >
            <FolderIcon className="h-4 w-4" />
            <span className="max-w-[120px] truncate text-xs">{truncatePath(currentSession.cwd)}</span>
          </button>
          <button
            ref={actionButtonRef}
            type="button"
            onClick={openMenu}
            className="p-1.5 rounded-lg dark:text-claude-darkTextSecondary text-claude-textSecondary dark:hover:bg-claude-darkSurfaceHover hover:bg-claude-surfaceHover transition-colors"
            aria-label={i18nService.t('coworkSessionActions')}
          >
            <EllipsisHorizontalIcon className="h-5 w-5" />
          </button>
          <WindowTitleBar inline className="ml-1" />
        </div>
      </div>

      {menuPosition && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[180px] rounded-xl border dark:border-claude-darkBorder border-claude-border dark:bg-claude-darkSurface bg-claude-surface shadow-popover popover-enter overflow-hidden"
          style={{ top: menuPosition.y, left: menuPosition.x }}
          role="menu"
        >
          <button
            type="button"
            onClick={(e) => handleRenameClick(e, closeMenu)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm dark:text-claude-darkText text-claude-text hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
            {i18nService.t('renameConversation')}
          </button>
          <button
            type="button"
            onClick={handleTogglePin}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm dark:text-claude-darkText text-claude-text hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover transition-colors"
          >
            <PushPinIcon
              slashed={currentSession.pinned}
              className={`h-4 w-4 ${currentSession.pinned ? 'opacity-60' : ''}`}
            />
            {currentSession.pinned ? i18nService.t('coworkUnpinSession') : i18nService.t('coworkPinSession')}
          </button>
          <button
            type="button"
            onClick={(e) => handleShareClick(e, closeMenu)}
            disabled={isExportingImage}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm dark:text-claude-darkText text-claude-text hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShareIcon className="h-4 w-4" />
            {i18nService.t('coworkShareSession')}
          </button>
          <button
            type="button"
            onClick={handleDeleteClick}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <TrashIcon className="h-4 w-4" />
            {i18nService.t('deleteSession')}
          </button>
        </div>
      )}

      {showConfirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
          onClick={handleCancelDelete}
        >
          <div
            className="w-full max-w-sm mx-4 dark:bg-claude-darkSurface bg-claude-surface rounded-2xl shadow-modal overflow-hidden modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
              </div>
              <h2 className="text-base font-semibold dark:text-claude-darkText text-claude-text">
                {i18nService.t('deleteTaskConfirmTitle')}
              </h2>
            </div>
            <div className="px-5 pb-4">
              <p className="text-sm dark:text-claude-darkTextSecondary text-claude-textSecondary">
                {i18nService.t('deleteTaskConfirmMessage')}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t dark:border-claude-darkBorder border-claude-border">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 text-sm font-medium rounded-lg dark:text-claude-darkTextSecondary text-claude-textSecondary dark:hover:bg-claude-darkSurfaceHover hover:bg-claude-surfaceHover transition-colors"
              >
                {i18nService.t('cancel')}
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                {i18nService.t('deleteSession')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative flex-1 min-h-0">
        <div ref={scrollContainerRef} onScroll={handleMessagesScroll} className="h-full min-h-0 overflow-y-auto pt-3">
          {renderConversationTurns()}
          <div className="h-20" />
        </div>

        {turns.length > 1 && isScrollable && (
          <div
            className={`absolute right-6 top-1/2 -translate-y-1/2 flex flex-col rounded-lg overflow-hidden shadow-lg transition-opacity duration-300 z-10 dark:bg-claude-darkSurface/90 bg-claude-surface/90 backdrop-blur-sm border dark:border-claude-darkBorder border-claude-border ${showTurnNav ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          >
            <button
              type="button"
              onClick={() => currentTurnIndex > 0 && navigateToTurn('prev')}
              className={`px-1.5 py-3 transition-colors dark:text-claude-darkText text-claude-text ${currentTurnIndex <= 0 ? 'opacity-30 cursor-default' : 'dark:hover:bg-claude-darkSurfaceHover hover:bg-claude-surfaceHover cursor-pointer'}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
            </button>
            <div className="dark:border-claude-darkBorder border-claude-border border-t" />
            <button
              type="button"
              onClick={() => currentTurnIndex < turns.length - 1 && navigateToTurn('next')}
              className={`px-1.5 py-3 transition-colors dark:text-claude-darkText text-claude-text ${currentTurnIndex >= turns.length - 1 ? 'opacity-30 cursor-default' : 'dark:hover:bg-claude-darkSurfaceHover hover:bg-claude-surfaceHover cursor-pointer'}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {isStreaming && <StreamingActivityBar messages={currentSession.messages} />}

      <div className="p-4 shrink-0">
        <div className="max-w-3xl mx-auto">
          <CoworkPromptInput
            onSubmit={onContinue}
            onStop={onStop}
            isStreaming={isStreaming}
            placeholder={i18nService.t('coworkContinuePlaceholder')}
            disabled={false}
            onManageSkills={onManageSkills}
            size="large"
            showModelSelector={true}
          />
        </div>
      </div>
    </div>
  )
}

export default CoworkSessionDetail
