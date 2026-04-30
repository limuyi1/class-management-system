<script setup lang="ts">
import { ref, watch } from 'vue'

import {
  deletePaperLayoutDraft,
  getPaperLayoutDrafts
} from '@/views/tools/services/paperLayoutDraftService'
import type { PaperLayoutDraftRecordType } from '@/types/Tools'

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{
  open: [draft: PaperLayoutDraftRecordType]
}>()

const drafts = ref<PaperLayoutDraftRecordType[]>([])
const loading = ref(false)

watch(
  visible,
  async (nextVisible) => {
    if (!nextVisible) return
    await loadDrafts()
  },
  { immediate: true }
)

async function loadDrafts(): Promise<void> {
  loading.value = true
  try {
    drafts.value = await getPaperLayoutDrafts()
  } finally {
    loading.value = false
  }
}

function handleOpen(draft: PaperLayoutDraftRecordType): void {
  emit('open', draft)
  visible.value = false
}

async function handleDelete(draft: PaperLayoutDraftRecordType): Promise<void> {
  await deletePaperLayoutDraft(draft.id)
  await loadDrafts()
}
</script>

<template>
  <el-dialog v-model="visible" title="打开草稿" width="720px" :close-on-click-modal="false">
    <div v-loading="loading" class="draft-dialog">
      <div v-if="drafts.length === 0" class="draft-empty">
        <font-awesome-icon :icon="['solid', 'floppy-disk']" />
        <span>暂无试卷排版草稿</span>
      </div>

      <div v-else class="draft-list">
        <article v-for="draft in drafts" :key="draft.id" class="draft-item">
          <div class="draft-main">
            <strong>{{ draft.name }}</strong>
            <span>
              {{ draft.settings.pageType }}
              {{ draft.settings.orientation === 'portrait' ? '纵向' : '横向' }} /
              {{ draft.items.length }} 张图片 /
              {{ new Date(draft.updatedAt).toLocaleString() }}
            </span>
          </div>
          <div class="draft-actions">
            <el-button size="small" @click="handleOpen(draft)">打开</el-button>
            <el-button size="small" @click="handleDelete(draft)">删除</el-button>
          </div>
        </article>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.draft-dialog {
  min-height: 280px;
}

.draft-empty {
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  color: #9ca3af;
  border: 1px dashed #e5e7eb;
  border-radius: 8px;
}

.draft-empty svg {
  font-size: 28px;
}

.draft-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 56vh;
  overflow: auto;
}

.draft-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #edf2f7;
  border-radius: 8px;
}

.draft-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.draft-main strong {
  color: #1f2937;
  font-size: 14px;
}

.draft-main span {
  color: #6b7280;
  font-size: 12px;
}

.draft-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
</style>
