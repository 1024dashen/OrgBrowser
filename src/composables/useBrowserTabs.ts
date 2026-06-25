import { ref, computed, onUnmounted, type Ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface Tab {
  id: string
  label: string
  url: string
  title: string
  isActive: boolean
  isCreated: boolean
}

let tabIdCounter = 0

function nextTabId(): string {
  tabIdCounter++
  return `tab-${tabIdCounter}`
}

function nextWebviewLabel(): string {
  return `browser-session-${tabIdCounter}`
}

export function useBrowserTabs(containerRef: Ref<HTMLElement | null>) {
  const tabs = ref<Tab[]>([])
  const activeTabId = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  let resizeObserver: ResizeObserver | null = null
  let unlisteners: UnlistenFn[] = []

  const activeTab = computed(() =>
    tabs.value.find((t) => t.id === activeTabId.value) ?? null
  )

  const activeLabel = computed(() => activeTab.value?.label ?? null)

  // ── Reposition the active webview to match container bounds ──
  async function syncActiveWebviewPosition() {
    const container = containerRef.value
    const tab = activeTab.value
    if (!container || !tab) return

    const rect = container.getBoundingClientRect()
    try {
      await invoke('reposition_and_show_webview', {
        label: tab.label,
        x: rect.x,
        y: rect.y,
        a: null,
        b: null,
        width: rect.width,
        height: rect.height,
      })
    } catch {
      // webview may not exist yet
    }
  }

  // ── Hide a tab's webview ──
  async function hideTabWebview(tab: Tab) {
    try {
      await invoke('set_inline_webview_visibility', {
        label: tab.label,
        visible: false,
      })
    } catch {
      // ignore
    }
  }

  // ── Show a tab's webview ──
  async function showTabWebview(tab: Tab) {
    try {
      await invoke('set_inline_webview_visibility', {
        label: tab.label,
        visible: true,
      })
      await syncActiveWebviewPosition()
    } catch {
      // ignore
    }
  }

  // ── Create a new tab and switch to it ──
  async function createTab(url?: string): Promise<void> {
    const targetUrl = url ?? 'about:blank'
    const tab: Tab = {
      id: nextTabId(),
      label: nextWebviewLabel(),
      url: targetUrl,
      title: targetUrl === 'about:blank' ? 'New Tab' : hostnameOf(targetUrl),
      isActive: true,
      isCreated: false,
    }

    // Hide current tab's webview
    if (activeTab.value) {
      await hideTabWebview(activeTab.value)
      activeTab.value.isActive = false
    }

    tabs.value.push(tab)
    activeTabId.value = tab.id

    // Wait for DOM to update (container ref must be available)
    await nextTickAsync()

    const container = containerRef.value
    if (!container) {
      error.value = 'Container element not found'
      return
    }

    const rect = container.getBoundingClientRect()

    try {
      isLoading.value = true
      error.value = null

      // Create offscreen first, then reposition
      await invoke('create_inline_webview', {
        parentWindow: 'main',
        label: tab.label,
        url: targetUrl,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        userAgent: null,
        incognito: false,
        generation: null,
        visible: true,
      })

      tab.isCreated = true
      setupResizeObserver()
    } catch (e) {
      error.value = String(e)
      console.error('Failed to create webview:', e)
    } finally {
      isLoading.value = false
    }
  }

  // ── Switch to a different tab ──
  async function switchTab(tabId: string): Promise<void> {
    if (tabId === activeTabId.value) return

    const oldTab = activeTab.value
    const newTab = tabs.value.find((t) => t.id === tabId)
    if (!newTab) return

    // Hide old tab's webview
    if (oldTab) {
      await hideTabWebview(oldTab)
      oldTab.isActive = false
    }

    // Activate new tab
    newTab.isActive = true
    activeTabId.value = tabId

    // Show and reposition the new tab's webview
    await showTabWebview(newTab)
  }

  // ── Close a tab ──
  async function closeTab(tabId: string): Promise<void> {
    const idx = tabs.value.findIndex((t) => t.id === tabId)
    if (idx === -1) return

    const tab = tabs.value[idx]

    // Close the native webview
    try {
      await invoke('close_inline_webview', {
        label: tab.label,
        generation: null,
      })
    } catch (e) {
      console.error('Failed to close webview:', e)
    }

    tabs.value.splice(idx, 1)

    // If we closed the active tab, switch to neighbor
    if (activeTabId.value === tabId) {
      if (tabs.value.length === 0) {
        activeTabId.value = null
      } else {
        const nextIdx = Math.min(idx, tabs.value.length - 1)
        const nextTab = tabs.value[nextIdx]
        nextTab.isActive = true
        activeTabId.value = nextTab.id
        await showTabWebview(nextTab)
      }
    }
  }

  // ── Navigate the active tab ──
  async function navigate(url: string): Promise<void> {
    if (!url) return
    let fullUrl = url
    if (!url.startsWith('http://') && !url.startsWith('https://') && url !== 'about:blank') {
      fullUrl = 'https://' + url
    }

    const tab = activeTab.value
    if (!tab) {
      // No tabs exist — create one
      await createTab(fullUrl)
      return
    }

    if (tab.isCreated) {
      try {
        await invoke('navigate_inline_webview', {
          label: tab.label,
          url: fullUrl,
        })
        tab.url = fullUrl
        tab.title = hostnameOf(fullUrl)
      } catch (e) {
        error.value = String(e)
      }
    } else {
      // Tab exists but webview not yet created — create it now
      await createTab(fullUrl)
    }
  }

  // ── Reload active tab ──
  async function reload(): Promise<void> {
    const tab = activeTab.value
    if (!tab) return
    try {
      await invoke('reload_inline_webview', { label: tab.label })
    } catch (e) {
      error.value = String(e)
    }
  }

  // ── Capture screenshot of active tab ──
  async function captureScreenshot(): Promise<string | null> {
    const tab = activeTab.value
    if (!tab) return null
    try {
      return await invoke<string>('browser_inline_capture', {
        label: tab.label,
      })
    } catch (e) {
      console.error('Screenshot failed:', e)
      return null
    }
  }

  // ── ResizeObserver setup ──
  function setupResizeObserver() {
    if (resizeObserver) return
    const container = containerRef.value
    if (!container) return

    resizeObserver = new ResizeObserver(() => {
      syncActiveWebviewPosition()
    })
    resizeObserver.observe(container)
  }

  // ── Cleanup ──
  async function closeAll() {
    for (const tab of tabs.value) {
      try {
        await invoke('close_inline_webview', {
          label: tab.label,
          generation: null,
        })
      } catch {
        // ignore
      }
    }
    tabs.value = []
    activeTabId.value = null
    cleanup()
  }

  function cleanup() {
    resizeObserver?.disconnect()
    resizeObserver = null
    unlisteners.forEach((fn) => fn())
    unlisteners = []
  }

  onUnmounted(() => {
    closeAll()
  })

  return {
    tabs,
    activeTab,
    activeTabId,
    activeLabel,
    isLoading,
    error,
    createTab,
    switchTab,
    closeTab,
    navigate,
    reload,
    captureScreenshot,
    closeAll,
  }
}

// ── helpers ──

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname || url
  } catch {
    return url
  }
}

function nextTickAsync(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}
