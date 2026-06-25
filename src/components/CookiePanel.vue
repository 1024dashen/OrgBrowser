<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

interface CookieInfo {
  name: string
  value: string
  domain: string
  path: string
  httpOnly: boolean
  secure: boolean
  sameSite: string
  expires: number | null
}

const props = defineProps<{ label: string }>()

const cookies = ref<CookieInfo[]>([])
const domainFilter = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

const filteredCookies = () => {
  if (!domainFilter.value) return cookies.value
  const filter = domainFilter.value.toLowerCase()
  return cookies.value.filter((c) => c.domain.toLowerCase().includes(filter))
}

async function fetchCookies() {
  loading.value = true
  error.value = null
  try {
    cookies.value = await invoke<CookieInfo[]>('get_webview_cookies', {
      label: props.label,
    })
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

function formatExpiry(expires: number | null): string {
  if (expires === null || expires === 0) return 'Session'
  return new Date(expires * 1000).toLocaleString()
}

onMounted(() => {
  fetchCookies()
})
</script>

<template>
  <div class="cookie-panel">
    <div class="toolbar">
      <input
        v-model="domainFilter"
        class="filter-input"
        type="text"
        placeholder="Filter by domain..."
      />
      <button @click="fetchCookies" :disabled="loading" class="refresh-btn">
        {{ loading ? '...' : '↻' }}
      </button>
    </div>

    <div v-if="error" class="error">{{ error }}</div>

    <div class="cookie-list">
      <div
        v-for="(cookie, i) in filteredCookies()"
        :key="i"
        class="cookie-entry"
      >
        <div class="cookie-header">
          <span class="cookie-name">{{ cookie.name }}</span>
          <span class="cookie-domain">{{ cookie.domain }}</span>
          <div class="cookie-flags">
            <span v-if="cookie.httpOnly" class="flag http-only">HTTP</span>
            <span v-if="cookie.secure" class="flag secure">SEC</span>
            <span v-if="cookie.sameSite" class="flag samesite">{{ cookie.sameSite }}</span>
          </div>
        </div>
        <div class="cookie-value">{{ cookie.value }}</div>
        <div class="cookie-meta">
          <span>Path: {{ cookie.path }}</span>
          <span>Expires: {{ formatExpiry(cookie.expires) }}</span>
        </div>
      </div>

      <div v-if="filteredCookies().length === 0 && !loading" class="empty">
        No cookies found
      </div>
    </div>
  </div>
</template>

<style scoped>
.cookie-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 12px;
}

.toolbar {
  display: flex;
  gap: 4px;
  padding: 4px 8px;
  border-bottom: 1px solid #3e3e42;
  background: #2d2d30;
}

.filter-input {
  flex: 1;
  height: 22px;
  padding: 0 6px;
  border: 1px solid #3e3e42;
  border-radius: 3px;
  background: #1e1e1e;
  color: #ccc;
  font-size: 11px;
  outline: none;
}

.filter-input:focus {
  border-color: #007acc;
}

.refresh-btn {
  width: 24px;
  height: 24px;
  border: 1px solid #3e3e42;
  background: transparent;
  color: #969696;
  cursor: pointer;
  border-radius: 3px;
}

.refresh-btn:hover:not(:disabled) {
  background: #3e3e42;
  color: #ccc;
}

.error {
  padding: 8px;
  color: #f48771;
}

.cookie-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.cookie-entry {
  padding: 6px 8px;
  border-bottom: 1px solid #2a2d2e;
}

.cookie-entry:hover {
  background: #2a2d2e;
}

.cookie-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cookie-name {
  color: #9cdcfe;
  font-weight: 600;
}

.cookie-domain {
  color: #858585;
  font-size: 11px;
  margin-left: auto;
}

.cookie-flags {
  display: flex;
  gap: 2px;
}

.flag {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 2px;
  font-weight: 600;
}

.flag.http-only {
  background: #5a3d2e;
  color: #f48771;
}

.flag.secure {
  background: #2e4a5a;
  color: #4ec9b0;
}

.flag.samesite {
  background: #3a3a5a;
  color: #c586c0;
}

.cookie-value {
  color: #d4d4d4;
  margin: 4px 0;
  word-break: break-all;
  font-family: 'Consolas', monospace;
  font-size: 11px;
}

.cookie-meta {
  display: flex;
  gap: 12px;
  color: #666;
  font-size: 10px;
}

.empty {
  padding: 16px;
  color: #666;
  text-align: center;
}
</style>
