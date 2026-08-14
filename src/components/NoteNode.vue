<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
import type { NoteNodeData } from '../graph/mapper'

const props = defineProps<{ data: NoteNodeData }>()

const noteStyle = computed<CSSProperties>(() => ({
  color: props.data.fontColor ?? '#1f2937',
  backgroundColor: props.data.backgroundColor ?? '#fff9b5',
  borderColor: props.data.borderColor ?? '#b8aa68',
  fontFamily: props.data.fontName || 'Georgia, serif',
  fontSize: `${props.data.fontSize ?? 12}px`,
  fontWeight: props.data.fontBold ? 700 : 400,
  fontStyle: props.data.fontItalic ? 'italic' : 'normal',
  boxShadow: props.data.drawShadow === false ? 'none' : '4px 5px 0 rgba(71, 85, 105, 0.2)',
}))
</script>

<template>
  <article class="kettle-note" :style="noteStyle" :aria-label="`Nota: ${data.text}`">
    {{ data.text }}
  </article>
</template>

<style scoped>
.kettle-note {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  padding: 8px 10px;
  border: 1px solid;
  border-radius: 2px;
  line-height: 1.35;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  user-select: text;
}
</style>
