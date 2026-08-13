<script setup lang="ts">
import { computed } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import type { KettleGraph } from '../model/graph'
import { toVueFlow } from '../graph/mapper'
import StepNode from './StepNode.vue'

const props = defineProps<{ graph: KettleGraph | null }>()

const model = computed(() => (props.graph ? toVueFlow(props.graph) : { nodes: [], edges: [] }))
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
  >
    <Background />
    <Controls />
    <MiniMap />

    <template #node-step="nodeProps">
      <StepNode :data="nodeProps.data" />
    </template>
  </VueFlow>

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
</style>
