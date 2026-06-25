<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

interface NetworkLogEntry {
  method: string
  url: string
  status: number
  statusText: string
  duration: number
  requestHeaders: Record<string, string>
  responseHeaders: Record<string, string>
  requestBody: string | null
  responseBody: string | null
  resourceType: string
  timestamp: number
}

const props = defineProps<{ label: string }>()

const logs = ref<NetworkLogEntry[]>([])
const selectedLog = ref<NetworkLogEntry | null>(null)
let pollInterval: ReturnType<typeof setInterval> | null = null

const statusColor = (status: number): string => {
  if (status === 0) return '#888'
  if (status < 300) return '#4ec9b0'
  if (status < 400) return '#dcdcaa'
  if (status < 500) return '#f48771'
  return '#f48771'
}

const truncate = (s: string, max: number): string => {
  return s.length > max ? s.substring(0, max) + '...' : s
}

async function pollLogs() {
  try {
    const newLogs = await invoke<NetworkLogEntry[]>('get_webview_network_logs', {
      label: props.label,
    })
    if (newLogs && newLogs.length > 0) {
      logs.value.push(...newLogs)
      if (logs.value.length > 200) {
        logs.value = logs.value.slice(-200)
      }
    }
  } catch (e) {
    // Webview might not be ready yet
  }
}

function clearLogs() {
  logs.value = []
  selectedLog.value = null
}

onMounted(() => {
  pollInterval = setInterval(pollLogs, 1000)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})
</script>

<template>
  <div class="network-panel">
    <div class="toolbar">
      <span class="count">{{ logs.length }} requests</span>
      <button class="clear-btn" @click="clearLogs">Clear</button>
    </div>

    <div class="split">
      <div class="log-list">
        <div
          v-for="(log, i) in logs"
          :key="i"
          class="log-row"
          :class="{ selected: selectedLog === log }"
          @click="selectedLog = log"
        >
          <span class="method" :class="log.method.toLowerCase()">{{ log.method }}</span>
          <span class="status" :style="{ color: statusColor(log.status) }">
            {{ log.status || '...' }}
          </span>
          <span class="url" :title="log.url">{{ truncate(log.url, 60) }}</span>
          <span class="duration">{{ log.duration ? log.duration + 'ms' : '' }}</span>
        </div>
        <div v-if="logs.length === 0" class="empty">
          No network requests captured
        </div>
      </div>

      <div v-if="selectedLog" class="detail">
        <div class="detail-section">
          <h4>General</h4>
          <div class="detail-row">
            <span class="label">URL:</span>
            <span class="value">{{ selectedLog.url }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Method:</span>
            <span class="value">{{ selectedLog.method }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Status:</span>
            <span class="value">{{ selectedLog.status }} {{ selectedLog.statusText }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Type:</span>
            <span class="value">{{ selectedLog.resourceType }}</span>
          </div>
        </div>

        <div v-if="selectedLog.responseBody" class="detail-section">
          <h4>Response Body</h4>
          <pre class="body-content">{{ truncate(selectedLog.responseBody, 2000) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.network-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 12px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-bottom: 1px solid #3e3e42;
  background: #2d2d30;
}

.count {
  color: #969696;
  font-size: 11px;
}

.clear-btn {
  margin-left: auto;
  padding: 2px 8px;
  border: 1px solid #3e3e42;
  background: transparent;
  color: #969696;
  font-size: 11px;
  cursor: pointer;
  border-radius: 3px;
}

.clear-btn:hover {
  background: #3e3e42;
  color: #ccc;
}

.split {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.log-list {
  flex: 1;
  overflow-y: auto;
}

.log-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  cursor: pointer;
  border-bottom: 1px solid #2a2d2e;
}

.log-row:hover {
  background: #2a2d2e;
}

.log-row.selected {
  background: #37373d;
}

.method {
  font-weight: 600;
  font-size: 10px;
  min-width: 36px;
}

.method.get { color: #4ec9b0; }
.method.post { color: #dcdcaa; }
.method.put { color: #c586c0; }
.method.delete { color: #f48771; }
.method.patch { color: #c586c0; }

.status {
  min-width: 30px;
  font-weight: 600;
}

.url {
  flex: 1;
  color: #d4d4d4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.duration {
  color: #858585;
  font-size: 11px;
  min-width: 50px;
  text-align: right;
}

.detail {
  width: 50%;
  border-left: 1px solid #3e3e42;
  overflow-y: auto;
  padding: 8px;
}

.detail-section {
  margin-bottom: 12px;
}

.detail-section h4 {
  color: #4ec9b0;
  font-size: 11px;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.detail-row {
  display: flex;
  gap: 6px;
  padding: 2px 0;
}

.detail-row .label {
  color: #858585;
  min-width: 60px;
}

.detail-row .value {
  color: #d4d4d4;
  word-break: break-all;
}

.body-content {
  color: #d4d4d4;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 11px;
  max-height: 300px;
  overflow-y: auto;
}

.empty {
  padding: 16px;
  color: #666;
  text-align: center;
}
</style>
