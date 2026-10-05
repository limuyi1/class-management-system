<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { ElAlert } from 'element-plus'

import { waitForPrintReady } from '@/utils/printDomUtil'

import type { PrintPaperExposeType } from '@/types/PrintPaper'

const paper = ref<HTMLElement>()
const warning = ref('')
let observer: ResizeObserver | undefined
/** 超出标题或正文预算时明确提示，导出端读取同一警告并拒绝截断。 */
function measure(): void {
  if (!paper.value) return
  const header = paper.value.querySelector('header')!
  const subtitle = header.querySelector('p')!
  const content = paper.value.querySelector('.print-paper-frame__content')!
  const footer = paper.value.querySelector('footer')!
  const headerBox = header.getBoundingClientRect()
  const scale = headerBox.width / (paper.value.offsetWidth - 144)
  warning.value =
    subtitle.getBoundingClientRect().bottom > headerBox.bottom + scale ||
    content.getBoundingClientRect().bottom > footer.getBoundingClientRect().top - 12 * scale
      ? '内容超出版式预算，请缩短标题、列名或姓名，或调整行高与方向后再导出'
      : ''
}
onMounted(() => {
  observer = new ResizeObserver(measure)
  if (paper.value) {
    observer.observe(paper.value)
    for (const node of paper.value.querySelectorAll('h1, p, .print-paper-frame__content'))
      observer.observe(node)
  }
  measure()
})
onBeforeUnmount(() => observer?.disconnect())
const props = withDefaults(
  defineProps<{
    width?: number
    height?: number
    title: string
    subtitle: string
    footer: string
  }>(),
  { width: 210, height: 297 }
)
defineExpose<PrintPaperExposeType>({
  getElement: () => paper.value,
  getSize: () => ({ width: props.width, height: props.height }),
  ready: async () => {
    if (paper.value) await waitForPrintReady(paper.value)
  }
})
</script>
<template>
  <article
    ref="paper"
    :data-print-warning="warning || undefined"
    class="print-paper-frame"
    :style="{ width: `${width * 6}px`, height: `${height * 6}px` }"
    data-print-paper
  >
    <header class="print-paper-frame__header">
      <h1>{{ title }}</h1>
      <p>{{ subtitle }}</p>
    </header>
    <div class="print-paper-frame__content"><slot /></div>
    <footer>{{ footer }}</footer>
  </article>
  <el-alert v-if="warning" :title="warning" type="warning" :closable="false" />
</template>
<style scoped lang="scss">
.print-paper-frame {
  position: relative;
  box-sizing: border-box;
  padding: 72px;
  background: #fff;
  color: #222;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  user-select: text;
  font-size: 21px;
}
.print-paper-frame__header {
  height: 204px;
  box-sizing: border-box;
}
h1 {
  font-size: 39px;
  line-height: 1.25;
  font-weight: 700;
  margin: 0 0 30px;
  overflow-wrap: anywhere;
}
p {
  margin: 0;
  font-size: 21px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
footer {
  position: absolute;
  bottom: 42px;
  left: 72px;
  right: 72px;
  font-size: 16px;
  text-align: right;
}
</style>
