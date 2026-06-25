<script setup lang="ts">
import type { Tab } from '../composables/useBrowserTabs'

defineProps<{
  tabs: Tab[]
  activeTabId: string | null
}>()

const emit = defineEmits<{
  select: [tabId: string]
  close: [tabId: string]
  new: []
}>()

function truncateTitle(title: string, max = 24): string {
  return title.length > max ? title.substring(0, max) + '...' : title
}
</script>

<template>
  <div class="tab-bar">
    <div class="tabs-scroll">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        class="tab"
        :class="{ active: tab.id === activeTabId }"
        @click="$emit('select', tab.id)"
        @mousedown.middle.prevent="$emit('close', tab.id)"
      >
        <span
          v-if="!tab.isCreated"
          class="tab-loading-icon"
        >⟳</span>
        <span v-else class="tab-dot" />
        <span class="tab-title">{{ truncateTitle(tab.title) }}</span>
        <button
          class="tab-close"
          @click.stop="$emit('close', tab.id)"
          title="Close tab"
        >
          ×
        </button>
      </div>
    </div>

    <button class="new-tab-btn" @click="$emit('new')" title="New tab">
      +
    </button>
  </div>
</template>

<style scoped>
.tab-bar {
  display: flex;
  align-items: stretch;
  background: #2d2d30;
  border-bottom: 1px solid #1e1e1e;
  height: 32px;
  min-height: 32px;
  user-select: none;
}

.tabs-scroll {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  flex: 1;
}

.tabs-scroll::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  min-width: 100px;
  max-width: 200px;
  height: 32px;
  border-right: 1px solid #1e1e1e;
  cursor: pointer;
  color: #969696;
  font-size: 12px;
  white-space: nowrap;
  position: relative;
  transition: background 0.1s;
}

.tab:hover {
  background: #37373d;
  color: #ccc;
}

.tab.active {
  background: #1e1e1e;
  color: #fff;
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: #007acc;
}

.tab-loading-icon {
  font-size: 11px;
  animation: spin 1s linear infinite;
  color: #007acc;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ec9b0;
  flex-shrink: 0;
}

.tab-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: #969696;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  border-radius: 3px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.1s, background 0.1s;
}

.tab:hover .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: #4e4e52;
  color: #fff;
}

.new-tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #969696;
  font-size: 18px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.1s, color 0.1s;
}

.new-tab-btn:hover {
  background: #37373d;
  color: #fff;
}
</style>
