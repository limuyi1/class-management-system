<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { createCardPaperDom, getCardPaperWarnings } from '@/utils/print-template/cardPaperDomUtil'
import { waitForPrintReady } from '@/utils/printDomUtil'

import type { PrintPaperExposeType } from '@/types/PrintPaper'
import type { CardTemplateType } from '@/types/PrintTools'

const props = defineProps<{ template: CardTemplateType; fields: Record<string, string> }>()
const emit = defineEmits<{ warnings: [values: string[]]; error: [message: string] }>()
const host = ref<HTMLElement>()
let paper: ReturnType<typeof createCardPaperDom> | undefined
let scene: CardTemplateType['scene']
let templateId = ''
let revision = 0
let timer: ReturnType<typeof setTimeout> | undefined
let disposed = false

/** 即时更新 DOM；昂贵的布局就绪检查只处理最后一次编辑。 */
async function update(): Promise<void> {
  await nextTick()
  if (!host.value || disposed) return
  const version = ++revision
  try {
    if (!paper || templateId !== props.template.id || scene !== props.template.scene) {
      paper = createCardPaperDom(props.template, props.fields)
      host.value.replaceChildren(paper.root)
      templateId = props.template.id
      scene = props.template.scene
    } else paper.update(props.template, props.fields)
    clearTimeout(timer)
    timer = setTimeout(async () => {
      try {
        if (!paper) return
        await waitForPrintReady(paper.root)
        if (!disposed && version === revision) {
          emit('warnings', getCardPaperWarnings(paper.root, props.template, props.fields))
          emit('error', '')
        }
      } catch (error) {
        if (!disposed && version === revision)
          emit('error', error instanceof Error ? error.message : '素材读取失败')
      }
    }, 120)
  } catch (error) {
    console.error(error)
    emit('error', error instanceof Error ? error.message : '模板读取失败')
  }
}
watch(() => [props.template, props.fields], update, { deep: true, immediate: true })
onBeforeUnmount(() => {
  disposed = true
  revision++
  clearTimeout(timer)
})
defineExpose<PrintPaperExposeType>({
  getSize: () => ({ width: props.template.width, height: props.template.height }),
  getElement: () => paper?.root,
  ready: async () => {
    if (paper) await waitForPrintReady(paper.root)
  }
})
</script>
<template><div ref="host" class="card-paper" aria-label="DOM 卡片纸张" /></template>
<style scoped lang="scss">
.card-paper {
  width: max-content;
  user-select: text;
}
</style>
