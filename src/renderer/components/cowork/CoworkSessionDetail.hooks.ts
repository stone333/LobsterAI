import { useState, useRef, useEffect, useCallback, RefObject } from 'react'
import type { ConversationTurn } from './CoworkSessionDetail.types'
import type { CoworkSession as FullCoworkSession } from '../../types/cowork'
import {
  AUTO_SCROLL_THRESHOLD,
  NAV_HIDE_DELAY,
  NAV_SCROLL_LOCK_DURATION,
  NAV_BOTTOM_SNAP_THRESHOLD,
  MAX_EXPORT_CANVAS_HEIGHT,
  MAX_EXPORT_SEGMENTS,
  sanitizeExportFileName,
  formatExportTimestamp,
  waitForNextFrame,
  loadImageFromBase64,
  domRectToCaptureRect,
  parseRootRelativePath,
  normalizeLocalPath,
  toAbsolutePathFromCwd,
} from './CoworkSessionDetail.utils'
import { coworkService } from '../../services/cowork'
import { i18nService } from '../../services/i18n'
import { getCompactFolderName } from '../../utils/path'

// ─── useScrollBehavior ─────────────────────────────────────────────────────────

export interface UseScrollBehaviorResult {
  shouldAutoScroll: boolean
  setShouldAutoScroll: React.Dispatch<React.SetStateAction<boolean>>
  isScrollable: boolean
  handleMessagesScroll: () => void
  turnElsCacheRef: RefObject<HTMLElement[]>
  currentTurnIndex: number
  setCurrentTurnIndex: React.Dispatch<React.SetStateAction<number>>
  currentTurnIndexRef: React.MutableRefObject<number>
  showTurnNav: boolean
  isNavigatingRef: RefObject<boolean>
  navigateToTurn: (direction: 'prev' | 'next') => void
}

export function useScrollBehavior(
  scrollContainerRef: RefObject<HTMLDivElement>,
  turns: ConversationTurn[],
): UseScrollBehaviorResult {
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const currentTurnIndexRef = useRef(0)
  const [showTurnNav, setShowTurnNav] = useState(false)
  const [isScrollable, setIsScrollable] = useState(false)
  const hideNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isNavigatingRef = useRef(false)
  const navigatingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const turnElsCacheRef = useRef<HTMLElement[]>([])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (hideNavTimerRef.current) clearTimeout(hideNavTimerRef.current)
      if (navigatingTimerRef.current) clearTimeout(navigatingTimerRef.current)
    }
  }, [])

  // Cache turn DOM elements when turns change
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) {
      turnElsCacheRef.current = []
      return
    }
    turnElsCacheRef.current = Array.from(container.querySelectorAll<HTMLElement>('[data-turn-index]'))
  }, [turns, scrollContainerRef])

  const handleMessagesScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    const isNearBottom = distanceToBottom <= AUTO_SCROLL_THRESHOLD
    setShouldAutoScroll((prev) => (prev === isNearBottom ? prev : isNearBottom))

    const scrollable = container.scrollHeight > container.clientHeight
    setIsScrollable((prev) => (prev === scrollable ? prev : scrollable))
    if (!scrollable) return

    setShowTurnNav((prev) => (prev ? prev : true))
    if (hideNavTimerRef.current) clearTimeout(hideNavTimerRef.current)
    hideNavTimerRef.current = setTimeout(() => setShowTurnNav(false), NAV_HIDE_DELAY)

    if (isNavigatingRef.current) return

    const turnEls = turnElsCacheRef.current
    if (turnEls.length === 0) return

    if (distanceToBottom <= NAV_BOTTOM_SNAP_THRESHOLD) {
      const lastIndex = turnEls.length - 1
      currentTurnIndexRef.current = lastIndex
      setCurrentTurnIndex(lastIndex)
      return
    }

    const scrollTop = container.scrollTop
    let visibleIndex = 0
    for (let i = 0; i < turnEls.length; i++) {
      if (turnEls[i].offsetTop <= scrollTop + 80) {
        visibleIndex = i
      } else {
        break
      }
    }
    currentTurnIndexRef.current = visibleIndex
    setCurrentTurnIndex(visibleIndex)
  }, [scrollContainerRef])

  const navigateToTurn = useCallback((direction: 'prev' | 'next') => {
    const turnEls = turnElsCacheRef.current
    if (turnEls.length === 0) return
    const idx = currentTurnIndexRef.current
    const targetIndex = direction === 'prev' ? idx - 1 : idx + 1
    if (targetIndex < 0 || targetIndex >= turnEls.length) return

    isNavigatingRef.current = true
    if (navigatingTimerRef.current) clearTimeout(navigatingTimerRef.current)
    navigatingTimerRef.current = setTimeout(() => {
      isNavigatingRef.current = false
    }, NAV_SCROLL_LOCK_DURATION)

    turnEls[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'start' })
    currentTurnIndexRef.current = targetIndex
    setCurrentTurnIndex(targetIndex)
    setShowTurnNav(true)
    if (hideNavTimerRef.current) clearTimeout(hideNavTimerRef.current)
    hideNavTimerRef.current = setTimeout(() => setShowTurnNav(false), NAV_HIDE_DELAY)
  }, [])

  return {
    shouldAutoScroll,
    setShouldAutoScroll,
    isScrollable,
    handleMessagesScroll,
    turnElsCacheRef,
    currentTurnIndex,
    setCurrentTurnIndex,
    currentTurnIndexRef,
    showTurnNav,
    isNavigatingRef,
    navigateToTurn,
  }
}

// ─── useSessionMenu ────────────────────────────────────────────────────────────

export interface UseSessionMenuResult {
  menuPosition: { x: number; y: number } | null
  menuRef: RefObject<HTMLDivElement>
  showConfirmDelete: boolean
  setShowConfirmDelete: React.Dispatch<React.SetStateAction<boolean>>
  openMenu: (e: React.MouseEvent) => void
  closeMenu: () => void
}

export function useSessionMenu(
  actionButtonRef: RefObject<HTMLButtonElement>,
  isRenaming: boolean,
): UseSessionMenuResult {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  const closeMenu = useCallback(() => {
    setMenuPosition(null)
    setShowConfirmDelete(false)
  }, [])

  useEffect(() => {
    if (!menuPosition) return
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !actionButtonRef.current?.contains(target)) {
        closeMenu()
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    const handleScroll = () => closeMenu()
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [menuPosition, actionButtonRef, closeMenu])

  const openMenu = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isRenaming) return
      if (menuPosition) {
        closeMenu()
        return
      }
      const menuHeight = 160
      const rect = actionButtonRef.current?.getBoundingClientRect()
      if (!rect) return
      const menuWidth = 180
      const padding = 8
      const x = Math.min(Math.max(padding, rect.right - menuWidth), window.innerWidth - menuWidth - padding)
      const y = Math.min(rect.bottom + 8, window.innerHeight - menuHeight - padding)
      setMenuPosition({ x, y })
      setShowConfirmDelete(false)
    },
    [isRenaming, menuPosition, actionButtonRef, closeMenu],
  )

  return { menuPosition, menuRef, showConfirmDelete, setShowConfirmDelete, openMenu, closeMenu }
}

// ─── useRenameSession ──────────────────────────────────────────────────────────

export interface UseRenameSessionResult {
  isRenaming: boolean
  renameValue: string
  setRenameValue: React.Dispatch<React.SetStateAction<string>>
  renameInputRef: RefObject<HTMLInputElement>
  handleRenameClick: (e: React.MouseEvent, closeMenuFn: () => void) => void
  handleRenameSave: (e?: React.SyntheticEvent) => Promise<void>
  handleRenameCancel: (e?: React.MouseEvent | React.KeyboardEvent) => void
  handleRenameBlur: (event: React.FocusEvent<HTMLInputElement>) => void
}

export function useRenameSession(session: FullCoworkSession | null): UseRenameSessionResult {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const ignoreNextBlurRef = useRef(false)

  useEffect(() => {
    if (!isRenaming && session) {
      setRenameValue(session.title)
      ignoreNextBlurRef.current = false
    }
  }, [isRenaming, session?.title])

  useEffect(() => {
    if (!isRenaming) return
    requestAnimationFrame(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    })
  }, [isRenaming])

  const handleRenameClick = useCallback(
    (e: React.MouseEvent, closeMenuFn: () => void) => {
      e.stopPropagation()
      if (!session) return
      ignoreNextBlurRef.current = false
      setIsRenaming(true)
      setRenameValue(session.title)
      closeMenuFn()
    },
    [session],
  )

  const handleRenameSave = useCallback(
    async (e?: React.SyntheticEvent) => {
      e?.stopPropagation()
      if (!session) return
      ignoreNextBlurRef.current = true
      const nextTitle = renameValue.trim()
      if (nextTitle && nextTitle !== session.title) {
        await coworkService.renameSession(session.id, nextTitle)
      }
      setIsRenaming(false)
    },
    [session, renameValue],
  )

  const handleRenameCancel = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent) => {
      e?.stopPropagation()
      ignoreNextBlurRef.current = true
      if (session) {
        setRenameValue(session.title)
      }
      setIsRenaming(false)
    },
    [session],
  )

  const handleRenameBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      if (ignoreNextBlurRef.current) {
        ignoreNextBlurRef.current = false
        return
      }
      handleRenameSave(event)
    },
    [handleRenameSave],
  )

  return {
    isRenaming,
    renameValue,
    setRenameValue,
    renameInputRef,
    handleRenameClick,
    handleRenameSave,
    handleRenameCancel,
    handleRenameBlur,
  }
}

// ─── useExportImage ────────────────────────────────────────────────────────────

export interface UseExportImageResult {
  isExportingImage: boolean
  handleShareClick: (e: React.MouseEvent, closeMenuFn: () => void) => void
}

export function useExportImage(
  session: FullCoworkSession | null,
  scrollContainerRef: RefObject<HTMLDivElement>,
): UseExportImageResult {
  const [isExportingImage, setIsExportingImage] = useState(false)

  const handleShareClick = useCallback(
    (e: React.MouseEvent, closeMenuFn: () => void) => {
      e.stopPropagation()
      if (!session || isExportingImage) return
      closeMenuFn()
      setIsExportingImage(true)

      window.requestAnimationFrame(() => {
        void (async () => {
          try {
            const scrollContainer = scrollContainerRef.current
            if (!scrollContainer) throw new Error('Capture target not found')

            const initialScrollTop = scrollContainer.scrollTop
            try {
              const scrollRect = domRectToCaptureRect(scrollContainer.getBoundingClientRect())
              if (scrollRect.width <= 0 || scrollRect.height <= 0) throw new Error('Invalid capture area')

              const scrollContentHeight = Math.max(scrollContainer.scrollHeight, scrollContainer.clientHeight)
              if (scrollContentHeight <= 0) throw new Error('Invalid content height')

              const toContentY = (viewportY: number): number => {
                const y = scrollContainer.scrollTop + (viewportY - scrollRect.y)
                return Math.max(0, Math.min(scrollContentHeight, y))
              }

              const userAnchors = scrollContainer.querySelectorAll<HTMLElement>('[data-export-role="user-message"]')
              const assistantAnchors = scrollContainer.querySelectorAll<HTMLElement>(
                '[data-export-role="assistant-block"]',
              )

              let contentStart = 0
              let contentEnd = scrollContentHeight

              if (userAnchors.length > 0) {
                contentStart = toContentY(userAnchors[0].getBoundingClientRect().top)
              } else if (assistantAnchors.length > 0) {
                contentStart = toContentY(assistantAnchors[0].getBoundingClientRect().top)
              }

              if (assistantAnchors.length > 0) {
                const lastAssistant = assistantAnchors[assistantAnchors.length - 1]
                contentEnd = toContentY(lastAssistant.getBoundingClientRect().bottom)
              } else if (userAnchors.length > 0) {
                const lastUser = userAnchors[userAnchors.length - 1]
                contentEnd = toContentY(lastUser.getBoundingClientRect().bottom)
              }

              const maxStart = Math.max(0, scrollContentHeight - 1)
              contentStart = Math.max(0, Math.min(maxStart, Math.round(contentStart)))
              contentEnd = Math.max(contentStart + 1, Math.min(scrollContentHeight, Math.round(contentEnd)))

              const outputHeight = contentEnd - contentStart
              if (outputHeight > MAX_EXPORT_CANVAS_HEIGHT)
                throw new Error(`Export image is too tall (${outputHeight}px)`)

              const segmentsEstimate = Math.ceil(outputHeight / Math.max(1, scrollRect.height)) + 1
              if (segmentsEstimate > MAX_EXPORT_SEGMENTS) throw new Error('Export image is too long')

              const canvas = document.createElement('canvas')
              canvas.width = scrollRect.width
              canvas.height = outputHeight
              const context = canvas.getContext('2d')
              if (!context) throw new Error('Canvas context unavailable')

              const captureAndLoad = async (rect: typeof scrollRect): Promise<HTMLImageElement> => {
                const chunk = await coworkService.captureSessionImageChunk({ rect })
                if (!chunk.success || !chunk.pngBase64) throw new Error(chunk.error || 'Failed to capture image chunk')
                return loadImageFromBase64(chunk.pngBase64)
              }

              scrollContainer.scrollTop = Math.min(
                contentStart,
                Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight),
              )
              await waitForNextFrame()
              await waitForNextFrame()

              const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight)
              let contentOffset = contentStart
              while (contentOffset < contentEnd) {
                const targetScrollTop = Math.min(contentOffset, maxScrollTop)
                scrollContainer.scrollTop = targetScrollTop
                await waitForNextFrame()
                await waitForNextFrame()

                const chunkImage = await captureAndLoad(scrollRect)
                const sourceYOffset = Math.max(0, contentOffset - targetScrollTop)
                const drawableHeight = Math.min(scrollRect.height - sourceYOffset, contentEnd - contentOffset)
                if (drawableHeight <= 0) throw new Error('Failed to stitch export image')

                const scaleY = chunkImage.naturalHeight / scrollRect.height
                const sourceYInImage = Math.max(0, Math.round(sourceYOffset * scaleY))
                const sourceHeightInImage = Math.max(
                  1,
                  Math.min(chunkImage.naturalHeight - sourceYInImage, Math.round(drawableHeight * scaleY)),
                )

                context.drawImage(
                  chunkImage,
                  0,
                  sourceYInImage,
                  chunkImage.naturalWidth,
                  sourceHeightInImage,
                  0,
                  contentOffset - contentStart,
                  scrollRect.width,
                  drawableHeight,
                )
                contentOffset += drawableHeight
              }

              const pngDataUrl = canvas.toDataURL('image/png')
              const base64Index = pngDataUrl.indexOf(',')
              if (base64Index < 0) throw new Error('Failed to encode export image')

              const timestamp = formatExportTimestamp(new Date())
              const saveResult = await coworkService.saveSessionResultImage({
                pngBase64: pngDataUrl.slice(base64Index + 1),
                defaultFileName: sanitizeExportFileName(`${session.title}-${timestamp}.png`),
              })

              if (saveResult.success && !saveResult.canceled) {
                window.dispatchEvent(
                  new CustomEvent('app:showToast', { detail: i18nService.t('coworkExportImageSuccess') }),
                )
                return
              }
              if (!saveResult.success) throw new Error(saveResult.error || 'Failed to export image')
            } finally {
              scrollContainer.scrollTop = initialScrollTop
            }
          } catch (error) {
            console.error('Failed to export session image:', error)
            window.dispatchEvent(new CustomEvent('app:showToast', { detail: i18nService.t('coworkExportImageFailed') }))
          } finally {
            setIsExportingImage(false)
          }
        })()
      })
    },
    [session, isExportingImage, scrollContainerRef],
  )

  return { isExportingImage, handleShareClick }
}

// ─── useResolveLocalFilePath ───────────────────────────────────────────────────

export function useResolveLocalFilePath(cwd: string | undefined): (href: string, text: string) => string | null {
  return useCallback(
    (href: string, text: string) => {
      const hrefValue = typeof href === 'string' ? href.trim() : ''
      const textValue = typeof text === 'string' ? text.trim() : ''
      if (!hrefValue && !textValue) return null

      const hrefRootRelative = hrefValue ? parseRootRelativePath(hrefValue) : null
      if (hrefRootRelative) return hrefRootRelative

      const hrefPath = hrefValue ? normalizeLocalPath(hrefValue) : null
      if (hrefPath) {
        if (hrefPath.isRelative && cwd) return toAbsolutePathFromCwd(hrefPath.path, cwd)
        if (hrefPath.isAbsolute) return hrefPath.path
      }

      const textRootRelative = textValue ? parseRootRelativePath(textValue) : null
      if (textRootRelative) return textRootRelative

      const textPath = textValue ? normalizeLocalPath(textValue) : null
      if (textPath) {
        if (textPath.isRelative && cwd) return toAbsolutePathFromCwd(textPath.path, cwd)
        if (textPath.isAbsolute) return textPath.path
      }

      return null
    },
    [cwd],
  )
}

// ─── useTruncatePath ──────────────────────────────────────────────────────────

export function useTruncatePath(): (path: string, maxLength?: number) => string {
  return useCallback((path: string, maxLength = 20): string => {
    if (!path) return i18nService.t('noFolderSelected')
    return getCompactFolderName(path, maxLength) || i18nService.t('noFolderSelected')
  }, [])
}
