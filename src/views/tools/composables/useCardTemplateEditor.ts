import { computed, ref, watch } from 'vue'

import { ElMessage, ElMessageBox } from 'element-plus'

import { useToolsStore } from '@/stores/tools'
import { flushPersistedStores } from '@/plugins/persistDexie'
import { CardLayerKindEnum } from '@/types/PrintTools'
import { createCardLayer, createCardTemplate } from '@/utils/cardTemplateUtil'
import { loadPrintImage } from '@/utils/printCanvasUtil'
import { blobToDataUrl } from '@/utils/fileUtil'
import { embedCardTemplateAssets } from '@/utils/print-template/cardTemplateAssetsUtil'

import type { CardTemplateType } from '@/types/PrintTools'
import type { AttachmentRecordType } from '@/types/Tools'

/** 管理模板副本、素材、图层与显式保存，编辑期间不直接修改持久化模板。 */
export function useCardTemplateEditor(preset: 'certificate' | 'card' | 'blank' = 'certificate') {
  const tools = useToolsStore()
  const template = ref(createCardTemplate(preset))
  const selectedLayerId = ref(template.value.layers[0]?.id || '')
  const selectedLayer = computed(() =>
    template.value.layers.find((layer) => layer.id === selectedLayerId.value)
  )
  const saving = ref(false)
  const dirty = ref(false)
  watch(
    template,
    () => {
      dirty.value = true
    },
    { deep: true, flush: 'sync' }
  )
  const fileInput = ref<HTMLInputElement>()
  const uploadMode = ref<'background' | 'image' | 'replace'>('background')
  const libraryVisible = ref(false)
  /** 切换模板前处理未保存的编辑。 */
  async function replaceTemplate(next: CardTemplateType): Promise<boolean> {
    if (dirty.value) {
      try {
        await ElMessageBox.confirm('当前修改尚未保存，是否放弃并切换模板？', '切换模板', {
          type: 'warning'
        })
      } catch {
        return false
      }
    }
    template.value = JSON.parse(JSON.stringify(next)) as CardTemplateType
    dirty.value = false
    selectedLayerId.value =
      template.value.layers.find((layer) => layer.kind === CardLayerKindEnum.Text)?.id ||
      template.value.layers[0]?.id ||
      ''
    return true
  }

  /** 模板和内嵌素材一起进入全局工具存储与完整备份。 */
  async function saveTemplate(copy = false, defaultFields?: Record<string, string>): Promise<void> {
    if (saving.value) return
    if (!template.value.name.trim()) {
      ElMessage.warning('请输入模板名称')
      return
    }
    saving.value = true
    try {
      const record = JSON.parse(JSON.stringify(template.value)) as CardTemplateType
      await embedCardTemplateAssets(record)
      if (defaultFields) record.defaultFields = { ...defaultFields }
      if (copy) {
        record.id = crypto.randomUUID()
        record.name += ' 副本'
      }
      const index = tools.cardTemplates.findIndex((item) => item.id === record.id)
      if (index >= 0) tools.cardTemplates.splice(index, 1, record)
      else tools.cardTemplates.push(record)
      await flushPersistedStores()
      template.value = JSON.parse(JSON.stringify(record)) as CardTemplateType
      dirty.value = false
      ElMessage.success('模板已保存，可在其他班级复用')
    } catch (error) {
      console.error(error)
      ElMessage.error('模板保存失败，请重试')
    } finally {
      saving.value = false
    }
  }

  /** 删除保存模板，不影响本次仍打开的编辑副本。 */
  async function deleteTemplate(): Promise<void> {
    try {
      await ElMessageBox.confirm('删除这个已保存模板？', '删除模板', { type: 'warning' })
    } catch {
      return
    }
    try {
      tools.cardTemplates = tools.cardTemplates.filter((item) => item.id !== template.value.id)
      await flushPersistedStores()
      ElMessage.success('已删除保存模板')
    } catch (error) {
      console.error(error)
      ElMessage.error('删除失败，请重试')
    }
  }

  /** 新建文字层，并将其设为当前编辑对象。 */
  function addText(text = '新文字'): void {
    const layer = createCardLayer(CardLayerKindEnum.Text, text)
    layer.width = Math.min(layer.width, template.value.width - 30)
    template.value.layers.push(layer)
    selectedLayerId.value = layer.id
  }

  /** 素材以独立快照存入模板，素材库删除不会破坏已保存模板。 */
  async function addImage(blob: Blob, name: string): Promise<void> {
    const source = await blobToDataUrl(blob)
    const image = await loadPrintImage(source)
    if (uploadMode.value === 'replace' && selectedLayer.value?.kind === CardLayerKindEnum.Image) {
      selectedLayer.value.image = source
      selectedLayer.value.label = name
    } else if (uploadMode.value === 'background') template.value.background = source
    else {
      const layer = createCardLayer(CardLayerKindEnum.Image)
      layer.label = name
      layer.image = source
      layer.width = Math.min(45, template.value.width / 3)
      layer.height = Math.min(
        template.value.height / 2,
        (layer.width * image.naturalHeight) / image.naturalWidth
      )
      template.value.layers.push(layer)
      selectedLayerId.value = layer.id
    }
  }

  /** 接收本地素材上传，解析失败时保留已有模板。 */
  async function upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      ElMessage.warning('请上传 PNG、JPG 或 WebP 图片')
      return
    }
    try {
      await addImage(file, file.name)
    } catch (error) {
      console.error(error)
      ElMessage.error('图片读取失败')
    }
  }

  /** 从已有素材库复制背景或装饰图片。 */
  async function useAttachments(records: AttachmentRecordType[]): Promise<void> {
    try {
      for (const record of uploadMode.value !== 'image' ? records.slice(0, 1) : records)
        await addImage(record.blob, record.name)
    } catch (error) {
      console.error(error)
      ElMessage.error('素材读取失败')
    }
  }

  /** 调整当前图层绘制顺序。 */
  function reorderLayer(offset: number): void {
    const index = template.value.layers.findIndex((layer) => layer.id === selectedLayerId.value)
    const target = index + offset
    if (index < 0 || target < 0 || target >= template.value.layers.length) return
    const [layer] = template.value.layers.splice(index, 1)
    template.value.layers.splice(target, 0, layer)
  }

  return {
    tools,
    template,
    selectedLayerId,
    selectedLayer,
    saving,
    dirty,
    fileInput,
    uploadMode,
    libraryVisible,
    replaceTemplate,
    saveTemplate,
    deleteTemplate,
    addText,
    upload,
    useAttachments,
    reorderLayer
  }
}
