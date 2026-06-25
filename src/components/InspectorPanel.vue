<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

interface ElementInfo {
  tagName: string
  id: string
  className: string
  xpath: string
  attributes: Record<string, string>
  innerHTML: string
  outerHTML: string
  textContent: string
  computedStyles: Record<string, string>
  rect: { x: number; y: number; width: number; height: number }
}

interface DOMTreeNode {
  tagName: string
  nodeType: number
  attributes: Record<string, string>
  childNodes: DOMTreeNode[]
  textContent: string
}

const props = defineProps<{ label: string }>()

const inspectMode = ref(false)
const selectedElement = ref<ElementInfo | null>(null)
const domTree = ref<DOMTreeNode | null>(null)
const showTree = ref(false)
const expandedPaths = ref<Set<string>>(new Set(['html', 'html/body']))

async function toggleInspector() {
  try {
    const newState = await invoke<boolean>('toggle_webview_inspect_mode', {
      label: props.label,
    })
    inspectMode.value = newState
    if (!newState) {
      await fetchSelectedElement()
    }
  } catch (e) {
    console.error('Failed to toggle inspector:', e)
  }
}

async function fetchSelectedElement() {
  try {
    selectedElement.value = await invoke<ElementInfo | null>('get_selected_element_info', {
      label: props.label,
    })
  } catch (e) {
    console.error('Failed to get element info:', e)
  }
}

async function fetchDomTree() {
  try {
    domTree.value = await invoke<DOMTreeNode | null>('get_webview_dom_tree', {
      label: props.label,
      maxDepth: 10,
    })
  } catch (e) {
    console.error('Failed to get DOM tree:', e)
  }
}

async function selectByXpath(xpath: string) {
  try {
    selectedElement.value = await invoke<ElementInfo | null>('select_element_by_xpath', {
      label: props.label,
      xpath,
    })
  } catch (e) {
    console.error('Failed to select element:', e)
  }
}

async function highlightByXpath(xpath: string) {
  try {
    await invoke('highlight_element_by_xpath', {
      label: props.label,
      xpath,
    })
  } catch (e) {
    // Ignore hover errors
  }
}

async function clearHighlight() {
  try {
    await invoke('clear_element_highlight', {
      label: props.label,
    })
  } catch (e) {
    // Ignore
  }
}

function togglePath(path: string) {
  if (expandedPaths.value.has(path)) {
    expandedPaths.value.delete(path)
  } else {
    expandedPaths.value.add(path)
  }
}

function renderTree(node: DOMTreeNode, path: string, depth: number) {
  if (node.nodeType === 3) {
    return `<span class="text-node">${escapeHtml(node.textContent)}</span>`
  }
  if (node.nodeType !== 1) return ''

  const isExpanded = expandedPaths.value.has(path)
  const hasChildren = node.childNodes.some((c) => c.nodeType === 1)

  let html = `<div class="tree-node" style="margin-left:${depth * 16}px">`
  html += `<span class="toggle" onclick="window.__togglePath('${path}')">${isExpanded ? '▼' : '▶'}</span> `
  html += `<span class="tag" onmouseover="window.__hoverPath('${path}')" onmouseout="window.__clearHover()" onclick="window.__selectPath('${path}')">`
  html += `&lt;${node.tagName}`
  for (const [key, val] of Object.entries(node.attributes)) {
    html += ` <span class="attr-name">${key}</span>=<span class="attr-val">"${escapeHtml(val)}"</span>`
  }
  html += `&gt;</span>`

  if (isExpanded && hasChildren) {
    for (const child of node.childNodes) {
      html += renderTree(child, `${path}/${child.tagName || 'text'}`, depth + 1)
    }
  } else if (hasChildren) {
    html += '<span class="collapsed"> ...</span>'
  }

  html += ` <span class="tag">&lt;/${node.tagName}&gt;</span>`
  html += '</div>'
  return html
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function refreshTree() {
  fetchDomTree()
}

onMounted(() => {
  // Set up global callbacks for tree interaction
  ;(window as any).__togglePath = togglePath
  ;(window as any).__hoverPath = (path: string) => {
    const xpath = '/' + path.split('/').slice(1).map((t) => `/${t}`).join('')
    highlightByXpath(xpath)
  }
  ;(window as any).__clearHover = clearHighlight
  ;(window as any).__selectPath = (path: string) => {
    const xpath = '/' + path.split('/').slice(1).map((t) => `/${t}`).join('')
    selectByXpath(xpath)
  }
})
</script>

<template>
  <div class="inspector-panel">
    <div class="toolbar">
      <button
        class="inspect-btn"
        :class="{ active: inspectMode }"
        @click="toggleInspector"
      >
        {{ inspectMode ? 'Stop Inspecting' : 'Inspect Element' }}
      </button>
      <button @click="showTree = !showTree; if (showTree) refreshTree()">
        {{ showTree ? 'Hide Tree' : 'Show Tree' }}
      </button>
      <button @click="fetchSelectedElement" title="Refresh">↻</button>
    </div>

    <div class="content">
      <!-- DOM Tree View -->
      <div v-if="showTree && domTree" class="dom-tree" v-html="renderTree(domTree, 'html', 0)" />

      <!-- Element Info View -->
      <div v-else-if="selectedElement" class="element-info">
        <div class="info-section">
          <h4>Element</h4>
          <div class="info-row">
            <span class="label">Tag:</span>
            <span class="value">&lt;{{ selectedElement.tagName }}&gt;</span>
          </div>
          <div v-if="selectedElement.id" class="info-row">
            <span class="label">ID:</span>
            <span class="value">{{ selectedElement.id }}</span>
          </div>
          <div v-if="selectedElement.className" class="info-row">
            <span class="label">Class:</span>
            <span class="value">{{ selectedElement.className }}</span>
          </div>
          <div class="info-row">
            <span class="label">XPath:</span>
            <span class="value mono">{{ selectedElement.xpath }}</span>
          </div>
        </div>

        <div v-if="Object.keys(selectedElement.attributes).length > 0" class="info-section">
          <h4>Attributes</h4>
          <div v-for="(val, key) in selectedElement.attributes" :key="key" class="info-row">
            <span class="label">{{ key }}:</span>
            <span class="value">{{ val }}</span>
          </div>
        </div>

        <div v-if="selectedElement.computedStyles && Object.keys(selectedElement.computedStyles).length > 0" class="info-section">
          <h4>Computed Styles</h4>
          <div
            v-for="(val, prop) in selectedElement.computedStyles"
            :key="prop"
            class="info-row"
          >
            <span class="label">{{ prop }}:</span>
            <span class="value">{{ val }}</span>
          </div>
        </div>

        <div class="info-section">
          <h4>HTML</h4>
          <pre class="html-preview">{{ selectedElement.outerHTML.substring(0, 1000) }}</pre>
        </div>
      </div>

      <div v-else class="empty">
        <p>Click "Inspect Element" then click on any element in the page</p>
        <p>or use "Show Tree" to browse the DOM</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inspector-panel {
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

.toolbar button {
  padding: 3px 8px;
  border: 1px solid #3e3e42;
  background: transparent;
  color: #969696;
  font-size: 11px;
  cursor: pointer;
  border-radius: 3px;
}

.toolbar button:hover {
  background: #3e3e42;
  color: #ccc;
}

.inspect-btn.active {
  background: #007acc;
  color: #fff;
  border-color: #007acc;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.info-section {
  margin-bottom: 12px;
}

.info-section h4 {
  color: #4ec9b0;
  font-size: 11px;
  text-transform: uppercase;
  margin-bottom: 4px;
  border-bottom: 1px solid #3e3e42;
  padding-bottom: 2px;
}

.info-row {
  display: flex;
  gap: 6px;
  padding: 1px 0;
}

.info-row .label {
  color: #858585;
  min-width: 80px;
}

.info-row .value {
  color: #d4d4d4;
  word-break: break-all;
  flex: 1;
}

.info-row .value.mono {
  font-family: 'Consolas', monospace;
  font-size: 11px;
}

.html-preview {
  color: #d4d4d4;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 11px;
  background: #1e1e1e;
  padding: 4px;
  border-radius: 3px;
  max-height: 200px;
  overflow-y: auto;
}

.dom-tree {
  font-family: 'Consolas', monospace;
  font-size: 11px;
}

:deep(.tree-node) {
  white-space: nowrap;
  padding: 1px 0;
}

:deep(.toggle) {
  cursor: pointer;
  width: 12px;
  display: inline-block;
  color: #858585;
}

:deep(.tag) {
  color: #569cd6;
  cursor: pointer;
}

:deep(.attr-name) {
  color: #9cdcfe;
}

:deep(.attr-val) {
  color: #ce9178;
}

:deep(.text-node) {
  color: #d4d4d4;
  padding: 0 4px;
}

:deep(.collapsed) {
  color: #666;
}

.empty {
  padding: 24px 16px;
  color: #666;
  text-align: center;
}

.empty p {
  margin: 4px 0;
}
</style>
