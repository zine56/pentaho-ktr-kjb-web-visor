<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Panel, useVueFlow, VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { ControlButton, Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import type { KettleGraph } from '../model/graph'
import { toVueFlow } from '../graph/mapper'
import type { FlowNodeData, StepNodeData } from '../graph/mapper'
import { exportDiagramImage, type DiagramImageFormat } from '../export/diagramImage'
import NoteNode from './NoteNode.vue'
import StepNode from './StepNode.vue'

const props = defineProps<{
  graph: KettleGraph | null
  highlightedNodeIds?: string[]
}>()

const vueFlow = useVueFlow()
const { fitView, setCenter, setNodes, viewport } = vueFlow
const exportingFormat = ref<DiagramImageFormat | null>(null)
const exportFeedback = ref('')
const exportFailed = ref(false)

function onMiniMapClick(payload: { event: MouseEvent; position: { x: number; y: number } }) {
  if (payload.event.button !== 0) return
  void setCenter(payload.position.x, payload.position.y, {
    zoom: viewport.value.zoom,
    duration: 280,
  })
}

async function exportDiagram(format: DiagramImageFormat) {
  if (exportingFormat.value) return

  const pane = vueFlow.viewportRef.value?.querySelector<HTMLElement>('.vue-flow__transformationpane')
  if (!pane || !props.graph) {
    exportFailed.value = true
    exportFeedback.value = 'El diagrama aun no esta listo para exportar.'
    return
  }

  exportingFormat.value = format
  exportFeedback.value = ''
  exportFailed.value = false

  try {
    const filename = await exportDiagramImage({
      pane,
      nodes: vueFlow.nodes.value,
      name: props.graph.name,
      format,
    })
    exportFeedback.value = `${filename} descargado`
  } catch (error) {
    exportFailed.value = true
    exportFeedback.value = error instanceof Error ? error.message : 'No se pudo exportar el diagrama.'
  } finally {
    exportingFormat.value = null
  }
}

const model = computed(() => {
  if (!props.graph) return { nodes: [], edges: [] }

  const baseModel = toVueFlow(props.graph)
  const highlightedSet = new Set((props.highlightedNodeIds ?? []).map((id) => id.trim()))

  const nodes = baseModel.nodes.map((node) => {
    const data = node.data as FlowNodeData
    if (data.kind === 'note') return node
    return {
      ...node,
      data: {
        ...data,
        highlighted: highlightedSet.has(node.id) || (typeof data.uid === 'string' && highlightedSet.has(data.uid)),
      },
    }
  })

  return { ...baseModel, nodes }
})

const selectedNode = ref<(StepNodeData & { id: string }) | null>(null)
const activeTab = ref<'details' | 'config' | 'configRaw'>('config')
const copyFeedback = ref('')

async function resetDiagram() {
  if (!props.graph) return

  setNodes(
    model.value.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      selected: false,
    })),
  )

  await nextTick()
  await fitView({ padding: 0.12, duration: 320 })
}

function onNodeClick(payload: {
  event?: MouseEvent
  node?: {
    id: string
    data: FlowNodeData
  }
}) {
  if (payload.event && payload.event.button !== 0) return
  if (!payload.node) return
  if (payload.node.data.kind === 'note') return
  selectedNode.value = {
    id: payload.node.id,
    ...payload.node.data,
    highlighted: payload.node.data.highlighted ?? false,
  }
  activeTab.value = 'config'
  copyFeedback.value = ''
}

function closeNodeConfig() {
  selectedNode.value = null
  copyFeedback.value = ''
}

function setActiveTab(tab: 'details' | 'config' | 'configRaw') {
  activeTab.value = tab
}

const configText = computed(() => selectedNode.value?.configXml ?? '')

type ConfigField = {
  key: string
  value: string
  depth: number
}

function toNodeText(node: Node): string {
  const value = node.textContent ?? ''
  return value
    .trim()
    .replaceAll('\n', ' ')
    .replace(/\s+/g, ' ')
}

type ConfigDisplayState = 'empty' | 'ready' | 'error'

const configDisplayState = computed(() => {
  const text = configText.value
  if (!text.trim()) {
    return { state: 'empty', rows: [] as ConfigField[] }
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<node-config>${text}</node-config>`, 'application/xml')
  const parserError = doc.getElementsByTagName('parsererror')[0]
  if (parserError) {
    return { state: 'error', rows: [] as ConfigField[] }
  }

  const rows: ConfigField[] = []
  const root = doc.documentElement

  const walk = (node: Element, depth = 0, pathPrefix = '') => {
    const name = node.localName ?? node.nodeName
    const normalizedName = name.toLowerCase()
    const isConfigurationNode = normalizedName === 'configuration'
    const label = pathPrefix ? `${pathPrefix} · ${name}` : name
    const elementChildren = Array.from(node.children)
    const textValue = toNodeText(node)
    const attrValue = Array.from(node.attributes)
      .map((a) => `${a.name}: ${a.value}`)
      .join(', ')

    if (elementChildren.length === 0) {
      if (isConfigurationNode) return
      const value = textValue || attrValue || '(sin valor)'
      rows.push({ key: label, value, depth })
      return
    }

    if (!isConfigurationNode && attrValue) {
      rows.push({
        key: `${label} (atributos)`,
        value: attrValue,
        depth,
      })
    }

    if (!isConfigurationNode && textValue) {
      rows.push({
        key: `${label} (valor)`,
        value: textValue,
        depth: depth + 1,
      })
    }

    for (const child of elementChildren) {
      walk(child as Element, isConfigurationNode ? depth : depth + 1, isConfigurationNode ? pathPrefix : label)
    }
  }

  for (const node of Array.from(root.children)) {
    walk(node as Element, 0, '')
  }

  return { state: 'ready', rows }
})

const configDisplayRows = computed<ConfigField[]>(() => configDisplayState.value.rows)

async function copyConfig() {
  if (!configText.value) return
  try {
    await navigator.clipboard.writeText(configText.value)
    copyFeedback.value = '¡Copiado al portapapeles!'
  } catch (e) {
    copyFeedback.value = 'No se pudo copiar automáticamente.'
    void e
  }
  window.setTimeout(() => {
    copyFeedback.value = ''
  }, 1600)
}

function onGlobalKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeNodeConfig()
}

onMounted(() => window.addEventListener('keydown', onGlobalKeyDown))

onUnmounted(() => window.removeEventListener('keydown', onGlobalKeyDown))

watch(selectedNode, () => {
  if (!selectedNode.value) {
    return
  }
  activeTab.value = 'config'
  copyFeedback.value = ''
})
</script>

<template>
  <VueFlow
    v-if="graph"
    class="flow-canvas"
    :nodes="model.nodes"
    :edges="model.edges"
    :min-zoom="0.2"
    :max-zoom="2"
    :fit-view-on-init="true"
    @node-click="onNodeClick"
  >
    <Background />
    <Controls>
      <ControlButton
        title="Restablecer posiciones y vista"
        aria-label="Restablecer posiciones y vista"
        @click="resetDiagram"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 3v5h5" />
        </svg>
      </ControlButton>
    </Controls>
    <Panel position="top-right" class="export-panel nodrag nopan">
      <span class="export-label">Exportar</span>
      <button
        class="export-button"
        type="button"
        :disabled="exportingFormat !== null"
        @click.stop="exportDiagram('png')"
      >
        {{ exportingFormat === 'png' ? 'Generando...' : 'PNG' }}
      </button>
      <button
        class="export-button"
        type="button"
        :disabled="exportingFormat !== null"
        @click.stop="exportDiagram('svg')"
      >
        {{ exportingFormat === 'svg' ? 'Generando...' : 'SVG' }}
      </button>
      <span
        v-if="exportFeedback"
        class="export-feedback"
        :class="{ 'is-error': exportFailed }"
        role="status"
      >
        {{ exportFeedback }}
      </span>
    </Panel>
    <MiniMap
      :pannable="true"
      aria-label="Minimapa del flujo: haz clic para navegar"
      @click="onMiniMapClick"
    />

    <template #node-step="nodeProps">
      <StepNode :data="nodeProps.data" />
    </template>
    <template #node-note="nodeProps">
      <NoteNode :data="nodeProps.data" />
    </template>
  </VueFlow>

  <div v-if="selectedNode" class="node-config-backdrop" @mousedown.self="closeNodeConfig">
    <div class="node-config-modal" role="dialog" aria-modal="true">
      <header class="node-config-header">
        <h2>Configuración de nodo</h2>
        <button class="node-config-close" type="button" @click="closeNodeConfig" aria-label="Cerrar">×</button>
      </header>
      <div class="node-config-tabs" role="tablist">
        <button
          role="tab"
          class="node-config-tab"
          :class="{ 'is-active': activeTab === 'config' }"
          @click="setActiveTab('config')"
        >
          Configuración
        </button>
        <button
          role="tab"
          class="node-config-tab"
          :class="{ 'is-active': activeTab === 'configRaw' }"
          @click="setActiveTab('configRaw')"
        >
          Configuración (XML)
        </button>
        <button
          role="tab"
          class="node-config-tab"
          :class="{ 'is-active': activeTab === 'details' }"
          @click="setActiveTab('details')"
        >
          Detalles
        </button>
      </div>
      <section class="node-config-body">
        <div v-if="activeTab === 'details'" class="node-config-section">
          <p><strong>Id:</strong> {{ selectedNode.id }}</p>
          <p><strong>UID:</strong> {{ selectedNode.uid }}</p>
          <p><strong>Nombre:</strong> {{ selectedNode.name }}</p>
          <p><strong>Tipo:</strong> {{ selectedNode.type }}</p>
          <p><strong>Clase:</strong> {{ selectedNode.kind }}</p>
        </div>
        <div v-else-if="activeTab === 'configRaw'" class="node-config-section">
          <div class="node-config-actions">
            <button
              class="node-config-copy"
              type="button"
              :disabled="!configText"
              @click="copyConfig"
              :title="configText ? 'Copiar configuración del nodo' : 'No hay configuración para copiar'"
            >
              <span aria-hidden="true">📋</span>
              <span>Copiar configuración</span>
            </button>
            <span v-if="copyFeedback" class="node-config-copy-feedback">{{ copyFeedback }}</span>
          </div>
          <pre><code>{{ configText || 'No hay configuración disponible' }}</code></pre>
        </div>
        <div v-else class="node-config-section">
          <div class="node-config-actions">
            <button
              class="node-config-copy"
              type="button"
              :disabled="!configText"
              @click="copyConfig"
              :title="configText ? 'Copiar configuración del nodo' : 'No hay configuración para copiar'"
            >
            <span aria-hidden="true">📋</span>
              <span>Copiar configuración</span>
            </button>
            <span v-if="copyFeedback" class="node-config-copy-feedback">{{ copyFeedback }}</span>
          </div>
          <p v-if="configDisplayState.state === 'empty'" class="config-form-empty">No hay configuración disponible</p>
          <p v-else-if="configDisplayState.state === 'error'" class="config-form-empty">
            No se pudo generar la vista HTML de configuración. Revisa la pestaña
            <strong>Configuración (XML)</strong>.
          </p>
          <div v-else class="config-form">
            <div
              v-for="(item, index) in configDisplayRows"
              :key="`${item.key}-${item.depth}-${index}`"
              class="config-form-row"
              :style="{ paddingLeft: `${item.depth * 14}px` }"
            >
              <label class="config-form-key">{{ item.key }}</label>
              <input class="config-form-value" type="text" :value="item.value" readonly />
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>

  <div v-else class="empty-state">
    <p class="empty-title">No flow loaded</p>
    <p class="empty-hint">Open a <code>.ktr</code> or <code>.kjb</code> file to visualize it.</p>
  </div>
</template>

<style scoped>
.flow-canvas {
  width: 100%;
  height: 100%;
}
.export-panel {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: min(520px, calc(100vw - 56px));
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid #bfdbfe;
  border-radius: 9px;
  box-shadow: 0 5px 14px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(6px);
}
.export-label {
  color: #334155;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.export-button {
  border: 1px solid #1d4ed8;
  border-radius: 6px;
  padding: 5px 9px;
  background: #2563eb;
  color: #f8fafc;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.export-button:hover:not(:disabled) {
  background: #1d4ed8;
}
.export-button:disabled {
  border-color: #94a3b8;
  background: #94a3b8;
  cursor: wait;
}
.export-feedback {
  overflow: hidden;
  max-width: 210px;
  color: #166534;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.export-feedback.is-error {
  color: #b91c1c;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  color: #475569;
}
.empty-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}
.empty-hint {
  font-size: 14px;
  margin: 0;
}
.empty-hint code {
  background: #e2e8f0;
  padding: 1px 5px;
  border-radius: 4px;
}
.node-config-backdrop {
  position: absolute;
  inset: 16px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  pointer-events: auto;
}

.node-config-modal {
  width: min(470px, 92vw);
  max-height: min(82vh, 650px);
  overflow: auto;
  background: #ffffff;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.25);
  padding: 12px 14px;
  pointer-events: auto;
}

.node-config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.node-config-close {
  border: none;
  background: #0f172a;
  color: #f8fafc;
  width: 26px;
  height: 26px;
  border-radius: 100px;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.node-config-body {
  color: #0f172a;
  font-size: 13px;
}

.node-config-tabs {
  display: flex;
  gap: 6px;
  margin: 4px 0 12px;
}

.node-config-tab {
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #0f172a;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}

.node-config-tab.is-active {
  background: #2563eb;
  color: #f8fafc;
  border-color: #2563eb;
}

.node-config-section {
  margin-top: 2px;
}

.node-config-body h3 {
  margin: 8px 0;
  font-size: 14px;
}

.node-config-body p {
  margin: 4px 0;
}

.node-config-body pre {
  margin: 0;
  padding: 8px;
  max-height: min(56vh, 420px);
  overflow: auto;
  background: #0f172a;
  color: #f8fafc;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.3;
  white-space: pre-wrap;
}

.config-form {
  display: grid;
  gap: 8px;
  max-height: min(56vh, 420px);
  overflow: auto;
}

.config-form-row {
  display: grid;
  gap: 4px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 7px 9px;
  background: #f8fafc;
}

.config-form-key {
  font-size: 11px;
  color: #334155;
  font-weight: 600;
  word-break: break-word;
}

.config-form-value {
  width: 100%;
  margin: 0;
  color: #0f172a;
  font-size: 12px;
  line-height: 1.25;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  padding: 5px 7px;
  word-break: break-word;
}

.config-form-empty {
  margin: 6px 0;
  color: #475569;
}

.node-config-body input.config-form-value {
  appearance: none;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #0f172a;
  font-size: 12px;
  line-height: 1.25;
  border-radius: 5px;
  padding: 6px 7px;
  width: 100%;
  box-sizing: border-box;
  outline: none;
  cursor: default;
  min-height: 32px;
}

.node-config-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.node-config-copy {
  border: 1px solid #1e40af;
  background: #1d4ed8;
  color: #f8fafc;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}

.node-config-copy span {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

.node-config-copy span:first-child {
  margin-right: 6px;
  font-size: 13px;
}

.node-config-copy:disabled {
  cursor: default;
  background: #94a3b8;
  border-color: #94a3b8;
}

.node-config-copy-feedback {
  color: #1d4ed8;
  font-size: 12px;
  white-space: nowrap;
}

:deep(.vue-flow__edge.error-handler-edge .vue-flow__edge-path),
:deep(.vue-flow__edge.error-handler-edge .vue-flow__edge-interaction),
:deep(.vue-flow__edge.error-handler-edge .vue-flow__connection-path) {
  stroke: #b91c1c !important;
  stroke-width: 2px !important;
}

:deep(.vue-flow__node-note) {
  border: 0;
  padding: 0;
  background: transparent;
  box-shadow: none;
  pointer-events: none;
}

</style>
