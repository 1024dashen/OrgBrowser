<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  url: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
}>()

const emit = defineEmits<{
  navigate: [url: string]
  reload: []
  toggleSidebar: []
  back: []
  forward: []
  screenshot: []
}>()

const urlInput = ref(props.url)

watch(() => props.url, (newUrl) => {
  urlInput.value = newUrl
})

function onNavigate() {
  if (urlInput.value) {
    emit('navigate', urlInput.value)
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    onNavigate()
  }
}
</script>

<template>
  <div class="browser-bar">
    <div class="nav-buttons">
      <button
        class="nav-btn"
        :disabled="!canGoBack"
        @click="$emit('back')"
        title="Back"
      >
        &#8592;
      </button>
      <button
        class="nav-btn"
        :disabled="!canGoForward"
        @click="$emit('forward')"
        title="Forward"
      >
        &#8594;
      </button>
      <button
        class="nav-btn"
        @click="$emit('reload')"
        :class="{ spinning: loading }"
        title="Reload"
      >
        &#8635;
      </button>
    </div>

    <input
      v-model="urlInput"
      class="url-input"
      type="text"
      placeholder="Enter URL or search..."
      @keydown="onKeydown"
    />

    <button class="nav-btn screenshot-btn" @click="$emit('screenshot')" title="Screenshot">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
    </button>

    <button class="nav-btn" @click="$emit('toggleSidebar')" title="Toggle DevTools">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="15" y1="3" x2="15" y2="21"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.browser-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background: #2d2d30;
  border-bottom: 1px solid #3e3e42;
}

.nav-buttons {
  display: flex;
  gap: 2px;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #ccc;
  font-size: 16px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s;
}

.nav-btn:hover:not(:disabled) {
  background: #3e3e42;
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.nav-btn.spinning {
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.url-input {
  flex: 1;
  height: 28px;
  padding: 0 8px;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  background: #1e1e1e;
  color: #ccc;
  font-size: 13px;
  outline: none;
}

.url-input:focus {
  border-color: #007acc;
}

.screenshot-btn {
  margin-left: auto;
}
</style>
