<script setup lang="ts">
import { onMounted, ref } from 'vue'
import GraphCanvas from './components/GraphCanvas.vue'
import { parseKettleFile, KettleParseError } from './parser/parseKettleXml'
import type { KettleGraph } from './model/graph'

const graph = ref<KettleGraph | null>(null)
const error = ref<string | null>(null)
const fileName = ref<string | null>(null)
const isDragging = ref(false)
const highlightedNodeIds = ref<string[]>([])

const fileRegistry: Record<string, string> = {
  tableInput: '/samples/table-input.ktr',
  basicJob: '/samples/basic-job.kjb',
}

function parseNodeIds(value: string | null): string[] {
  if (!value) return []
  return value
    .split(/[,;|\s]+/)
    .map((id) => id.trim())
    .filter(Boolean)
}

function parseDeeplink() {
  const params = new URLSearchParams(window.location.search)
  const fileUrl = params.get('fileUrl')
  const fileId = params.get('fileId')
  const nodeIds = parseNodeIds(params.get('nodeId') || params.get('nodeIds') || params.get('nodes'))

  return {
    fileUrl: fileUrl ?? null,
    fileId: fileId ?? null,
    nodeIds,
  }
}

function resolveFileNameFromUrl(fileUrl: string): string {
  const last = fileUrl.split('/').pop() ?? ''
  return last.split('?')[0] || fileUrl
}

async function loadFromUrl(fileUrl: string, fileLabel: string) {
  error.value = null
  try {
    const response = await fetch(fileUrl)
    if (!response.ok) throw new Error(`Unable to fetch "${fileUrl}": ${response.status} ${response.statusText}`)
    const text = await response.text()
    graph.value = parseKettleFile(text, fileLabel)
    fileName.value = fileLabel
  } catch (e) {
    graph.value = null
    fileName.value = null
    error.value =
      e instanceof KettleParseError
        ? e.message
        : 'Failed to load file from URL: ' + (e instanceof Error ? e.message : String(e))
  }
}

async function loadFile(file: File) {
  error.value = null
  try {
    const text = await file.text()
    graph.value = parseKettleFile(text, file.name)
    fileName.value = file.name
  } catch (e) {
    graph.value = null
    fileName.value = null
    error.value =
      e instanceof KettleParseError
        ? e.message
        : 'Failed to load file: ' + (e instanceof Error ? e.message : String(e))
  }
}

function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void loadFile(file)
  input.value = ''
}

function initFromDeeplink() {
  const { fileUrl, fileId, nodeIds } = parseDeeplink()
  highlightedNodeIds.value = nodeIds

  const urlToLoad = fileUrl ?? (fileId ? fileRegistry[fileId] : null)
  if (urlToLoad) {
    void loadFromUrl(urlToLoad, fileId ?? resolveFileNameFromUrl(urlToLoad))
  }
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void loadFile(file)
}

onMounted(() => {
  initFromDeeplink()
})
</script>

<template>
  <div
    class="app"
    :class="{ dragging: isDragging }"
    @dragenter.prevent="isDragging = true"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
  >
    <header class="toolbar">
      <h1 class="title">Pentaho KTR/KJB Web Visor</h1>
      <div class="toolbar-right">
        <span v-if="fileName" class="file-name">{{ fileName }}</span>
        <label class="open-button">
          Open file
          <input type="file" accept=".ktr,.kjb,application/xml,text/xml" @change="onFileInput" />
        </label>
      </div>
    </header>

    <div v-if="error" class="error-banner" role="alert">
      <span>{{ error }}</span>
      <button class="error-dismiss" aria-label="Dismiss" @click="error = null">×</button>
    </div>

    <main class="canvas-wrap">
      <GraphCanvas :graph="graph" :highlighted-node-ids="highlightedNodeIds" />
    </main>

    <div v-if="isDragging" class="drop-overlay">
      <p>Drop a <code>.ktr</code> or <code>.kjb</code> file to open</p>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f1f5f9;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 16px;
  background: #0f172a;
  color: #f8fafc;
}
.title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.file-name {
  font-size: 13px;
  color: #cbd5e1;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.open-button {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  background: #2563eb;
  color: #fff;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.open-button input {
  display: none;
}
.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 13px;
  border-bottom: 1px solid #fecaca;
}
.error-dismiss {
  border: none;
  background: transparent;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  color: #991b1b;
}
.canvas-wrap {
  flex: 1;
  position: relative;
  min-height: 0;
}
.drop-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(37, 99, 235, 0.85);
  color: #fff;
  font-size: 18px;
  pointer-events: none;
}
.drop-overlay code {
  background: rgba(255, 255, 255, 0.25);
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
