<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useBrowserTabs } from './composables/useBrowserTabs'
import BrowserBar from './components/BrowserBar.vue'
import TabBar from './components/TabBar.vue'
import ConsolePanel from './components/ConsolePanel.vue'
import NetworkPanel from './components/NetworkPanel.vue'
import InspectorPanel from './components/InspectorPanel.vue'
import CookiePanel from './components/CookiePanel.vue'

const webviewContainer = ref<HTMLElement | null>(null)
const devtoolsTab = ref<'console' | 'network' | 'inspector' | 'cookies'>('console')
const sidebarWidth = ref(380)
const sidebarVisible = ref(true)

const {
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
} = useBrowserTabs(webviewContainer)

// URL shown in the address bar — reflects the active tab
const addressUrl = computed(() => activeTab.value?.url ?? '')

// ── Navigation from BrowserBar ──
async function onNavigate(url: string) {
  await navigate(url)
}

// ── New tab button ──
async function onNewTab() {
  await createTab('about:blank')
}

// ── Screenshot ──
async function onScreenshot() {
  const dataUrl = await captureScreenshot()
  if (dataUrl) {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `screenshot-${Date.now()}.png`
    link.click()
  }
}

function toggleSidebar() {
  sidebarVisible.value = !sidebarVisible.value
}

function startResize(e: MouseEvent) {
  e.preventDefault()
  const startX = e.clientX
  const startWidth = sidebarWidth.value

  const onMove = (moveEvent: MouseEvent) => {
    const delta = startX - moveEvent.clientX
    sidebarWidth.value = Math.max(250, Math.min(600, startWidth + delta))
  }

  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// Keyboard shortcuts: Ctrl+T = new tab, Ctrl+W = close tab
function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 't') {
    e.preventDefault()
    onNewTab()
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
    e.preventDefault()
    if (activeTabId.value) {
      closeTab(activeTabId.value)
    }
  }
}

onMounted(() => {
  // Open a default page on launch
  createTab('https://www.bing.com')
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  closeAll()
})
</script>

<template>
  <div class="app">
    <BrowserBar
      :url="addressUrl"
      :loading="isLoading"
      :can-go-back="false"
      :can-go-forward="false"
      @navigate="onNavigate"
      @reload="reload"
      @toggle-sidebar="toggleSidebar"
      @screenshot="onScreenshot"
    />

    <TabBar
      :tabs="tabs"
      :active-tab-id="activeTabId"
      @select="switchTab"
      @close="closeTab"
      @new="onNewTab"
    />

    <div class="main-content">
      <div class="webview-area" ref="webviewContainer">
        <div v-if="tabs.length === 0" class="placeholder">
          <p>Press <kbd>Ctrl+T</kbd> or click + to open a new tab</p>
        </div>
        <div v-if="error" class="error-banner">
          {{ error }}
        </div>
      </div>

      <div
        v-if="sidebarVisible"
        class="sidebar"
        :style="{ width: sidebarWidth + 'px' }"
      >
        <div class="resize-handle" @mousedown="startResize" />

        <div class="devtools-tabs">
          <button
            :class="{ active: devtoolsTab === 'console' }"
            @click="devtoolsTab = 'console'"
          >
            Console
          </button>
          <button
            :class="{ active: devtoolsTab === 'network' }"
            @click="devtoolsTab = 'network'"
          >
            Network
          </button>
          <button
            :class="{ active: devtoolsTab === 'inspector' }"
            @click="devtoolsTab = 'inspector'"
          >
            Inspector
          </button>
          <button
            :class="{ active: devtoolsTab === 'cookies' }"
            @click="devtoolsTab = 'cookies'"
          >
            Cookies
          </button>
        </div>

        <div class="devtools-content">
          <ConsolePanel
            v-if="devtoolsTab === 'console' && activeLabel"
            :label="activeLabel"
          />
          <NetworkPanel
            v-if="devtoolsTab === 'network' && activeLabel"
            :label="activeLabel"
          />
          <InspectorPanel
            v-if="devtoolsTab === 'inspector' && activeLabel"
            :label="activeLabel"
          />
          <CookiePanel
            v-if="devtoolsTab === 'cookies' && activeLabel"
            :label="activeLabel"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #1e1e1e;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.webview-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #fff;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888;
  font-size: 14px;
}

.placeholder kbd {
  padding: 2px 6px;
  border: 1px solid #555;
  border-radius: 3px;
  background: #333;
  color: #ccc;
  font-size: 12px;
  margin: 0 2px;
}

.error-banner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 8px 12px;
  background: #d32f2f;
  color: #fff;
  font-size: 13px;
  z-index: 10;
}

.sidebar {
  display: flex;
  position: relative;
  background: #252526;
  border-left: 1px solid #3e3e42;
  flex-direction: column;
  flex-shrink: 0;
}

.resize-handle {
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 10;
}

.devtools-tabs {
  display: flex;
  border-bottom: 1px solid #3e3e42;
  background: #2d2d30;
}

.devtools-tabs button {
  flex: 1;
  padding: 8px 4px;
  border: none;
  background: transparent;
  color: #969696;
  font-size: 11px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.devtools-tabs button:hover {
  color: #ccc;
}

.devtools-tabs button.active {
  color: #fff;
  border-bottom-color: #007acc;
}

.devtools-content {
  flex: 1;
  overflow: hidden;
}
</style>
