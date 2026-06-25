import { ref, onUnmounted, type Ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface WebviewRect {
  x: number
  y: number
  width: number
  height: number
}

export interface BrowserSessionOptions {
  label: string
  url: string
  containerRef: Ref<HTMLElement | null>
  parentWindow?: string
  incognito?: boolean
  userAgent?: string
  visible?: boolean
}

export function useBrowserSession() {
  const webviewLabel = ref<string | null>(null)
  const currentUrl = ref<string>('')
  const isLoading = ref(false)
  const isCreated = ref(false)
  const error = ref<string | null>(null)

  let resizeObserver: ResizeObserver | null = null
  let unlisteners: UnlistenFn[] = []

  async function createWebview(opts: BrowserSessionOptions) {
    const {
      label,
      url,
      containerRef,
      parentWindow = 'main',
      incognito = false,
      userAgent,
      visible = true,
    } = opts

    const container = containerRef.value
    if (!container) {
      error.value = 'Container element not found'
      return
    }

    const rect = container.getBoundingClientRect()

    try {
      isLoading.value = true
      error.value = null

      await invoke('create_inline_webview', {
        parentWindow,
        label,
        url,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        userAgent: userAgent ?? null,
        incognito,
        generation: null,
        visible,
      })

      webviewLabel.value = label
      currentUrl.value = url
      isCreated.value = true

      // Set up ResizeObserver to sync container bounds to native webview
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const r = entry.target.getBoundingClientRect()
          repositionWebview(r)
        }
      })
      resizeObserver.observe(container)

      // Listen for navigation events
      const unlisten = await listen('browser-navigation', (event) => {
        const payload = event.payload as { url: string }
        currentUrl.value = payload.url
      })
      unlisteners.push(unlisten)
    } catch (e) {
      error.value = String(e)
      console.error('Failed to create webview:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function navigateTo(url: string) {
    if (!webviewLabel.value) return
    try {
      await invoke('navigate_inline_webview', {
        label: webviewLabel.value,
        url,
      })
      currentUrl.value = url
    } catch (e) {
      error.value = String(e)
    }
  }

  async function reload() {
    if (!webviewLabel.value) return
    try {
      await invoke('reload_inline_webview', {
        label: webviewLabel.value,
      })
    } catch (e) {
      error.value = String(e)
    }
  }

  async function repositionWebview(rect: WebviewRect | DOMRect) {
    if (!webviewLabel.value) return
    try {
      await invoke('reposition_and_show_webview', {
        label: webviewLabel.value,
        x: rect.x,
        y: rect.y,
        a: null,
        b: null,
        width: rect.width,
        height: rect.height,
      })
    } catch (e) {
      console.error('Failed to reposition webview:', e)
    }
  }

  async function setVisibility(visible: boolean) {
    if (!webviewLabel.value) return
    try {
      await invoke('set_inline_webview_visibility', {
        label: webviewLabel.value,
        visible,
      })
    } catch (e) {
      error.value = String(e)
    }
  }

  async function closeWebview() {
    if (!webviewLabel.value) return
    try {
      await invoke('close_inline_webview', {
        label: webviewLabel.value,
        generation: null,
      })
    } catch (e) {
      error.value = String(e)
    }
    cleanup()
  }

  function cleanup() {
    resizeObserver?.disconnect()
    resizeObserver = null
    unlisteners.forEach((fn) => fn())
    unlisteners = []
    webviewLabel.value = null
    isCreated.value = false
  }

  onUnmounted(cleanup)

  return {
    webviewLabel,
    currentUrl,
    isLoading,
    isCreated,
    error,
    createWebview,
    navigateTo,
    reload,
    repositionWebview,
    setVisibility,
    closeWebview,
  }
}
