<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { StepNodeData } from '../graph/mapper'
import { resolveStepIcon } from '../icons/stepIcons'

const props = defineProps<{ data: StepNodeData }>()

const icon = computed(() => resolveStepIcon({ type: props.data.type, kind: props.data.kind }))
const isSpecial = computed(() => props.data.kind === 'entry' && props.data.type === 'SPECIAL')
</script>

<template>
  <div class="step-node" :class="[`kind-${data.kind}`, { 'is-special': isSpecial }]">
    <Handle type="target" :position="Position.Left" />
    <img class="step-icon" :src="icon" :alt="data.type" />
    <span class="step-name">{{ data.name }}</span>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.step-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  min-width: 120px;
  min-height: 36px;
  background: #ffffff;
  border: 1px solid #94a3b8;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.18);
  font-size: 12px;
  color: #0f172a;
  white-space: nowrap;
}
.step-node.kind-entry {
  border-color: #64748b;
  background: #f8fafc;
}
.step-node.is-special {
  border-color: #16a34a;
  background: #f0fdf4;
}
.step-icon {
  width: 20px;
  height: 20px;
  flex: none;
  object-fit: contain;
}
.step-name {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}
</style>
