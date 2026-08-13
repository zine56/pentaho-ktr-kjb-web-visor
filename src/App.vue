<script setup lang="ts">
import { ref } from 'vue'
import GraphCanvas from './components/GraphCanvas.vue'
import { parseKettleFile, KettleParseError } from './parser/parseKettleXml'
import type { KettleGraph } from './model/graph'

const graph = ref<KettleGraph | null>(null)
const error = ref<string | null>(null)
const fileName = ref<string | null>(null)
const isDragging = ref(false)

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

function onDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void loadFile(file)
}
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
      <GraphCanvas :graph="graph" />
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
