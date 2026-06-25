<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

interface ConsoleLogEntry {
  level: string
  message: string
  source: string
  line: number
  timestamp: number
}

const props = defineProps<{ label: string }>()

const logs = ref<ConsoleLogEntry[]>([])
const filter = ref<'all' | 'error' | 'warn' | 'info' | 'log'>('all')
let pollInterval: ReturnType<typeof setInterval> | null = null

const levelColors: Record<string, string> = {
  error: '#f48771',
  warn: '#cca700',
  info: '#75beff',
  log: '#d4d4d4',
  debug: '#888',
}

const filteredLogs = () => {
  if (filter.value === 'all') return logs.value
  return logs.value.filter((l) => l.level === filter.value)
}

async function pollLogs() {
  try {
    const newLogs = await invoke<ConsoleLogEntry[]>('get_webview_console_logs', {
      label: props.label,
    })
    if (newLogs && newLogs.length > 0) {
      logs.value.push(...newLogs)
      if (logs.value.length > 500) {
        logs.value = logs.value.slice(-500)
      }
    }
  } catch (e) {
    // Webview might not be ready yet
  }
}

function clearLogs() {
  logs.value = []
}

onMounted(() => {
  pollInterval = setInterval(pollLogs, 1000)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})
</script>

<template>
  <div class="console-panel">
    <div class="toolbar">
      <div class="filters">
        <button
          v-for="f in (['all', 'error', 'warn', 'info', 'log'] as const)"
          :key="f"
          :class="{ active: filter === f }"
          @click="filter = f"
        >
          {{ f }}
        </button>
      </div>
      <button class="clear-btn" @click="clearLogs">Clear</button>
    </div>

    <div class="log-list">
      <div
        v-for="(log, i) in filteredLogs()"
        :key="i"
        class="log-entry"
        :style="{ borderLeftColor: levelColors[log.level] || '#666' }"
      >
        <span class="log-level" :style="{ color: levelColors[log.level] || '#666' }">
          [{{ log.level }}]
        </span>
        <span class="log-message">{{ log.message }}</span>
        <span v-if="log.source" class="log-source">
          {{ log.source }}{{ log.line ? ':' + log.line : '' }}
        </span>
      </div>
      <div v-if="filteredLogs().length === 0" class="empty">
        No console messages
      </div>
    </div>
  </div>
</template>

<style scoped>
.console-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 12px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-bottom: 1px solid #3e3e42;
  background: #2d2d30;
}

.filters {
  display: flex;
  gap: 2px;
}

.filters button {
  padding: 2px 6px;
  border: none;
  background: transparent;
  color: #969696;
  font-size: 11px;
  cursor: pointer;
  border-radius: 3px;
  text-transform: capitalize;
}

.filters button:hover {
  background: #3e3e42;
  color: #ccc;
}

.filters button.active {
  background: #007acc;
  color: #fff;
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

.log-list {
  flex: 1;
  overflow-y: auto;
  padding: 2px 0;
}

.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 2px 8px;
  border-left: 3px solid #666;
  word-break: break-all;
}

.log-entry:hover {
  background: #2a2d2e;
}

.log-level {
  flex-shrink: 0;
  font-weight: 600;
  min-width: 50px;
}

.log-message {
  flex: 1;
  color: #d4d4d4;
  white-space: pre-wrap;
}

.log-source {
  flex-shrink: 0;
  color: #858585;
  font-size: 11px;
}

.empty {
  padding: 16px;
  color: #666;
  text-align: center;
}
</style>
