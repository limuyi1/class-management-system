<script setup lang="ts">
import { computed, ref } from 'vue'

import { ElLoading, ElMessage } from 'element-plus'

import { useWorkspaceStore } from '@/stores/workspace'
import { useWorkspaceScores } from '@/hooks/useWorkspaceScores'
import { setWorkspaceReferences, switchWorkspace } from '@/utils/workspaceUtil'
import { getValidScore } from '@/utils/scoreValueUtil'

const workspace = useWorkspaceStore()
const { projection } = useWorkspaceScores()
const visible = ref(false)
const selected = ref<string[]>([])
const busy = ref(false)
const groups = computed(() =>
  [...workspace.activeClassPeriods]
    .reverse()
    .filter((period) => period.id !== workspace.activePeriod?.id)
    .map((period) => {
      const snapshot = workspace.snapshots.find((item) => item.id === period.id)
      return {
        period,
        options: (snapshot?.setting?.scoreColumns ?? [])
          .filter((column) => column.prop !== 'name')
          .map((column) => ({
            value: JSON.stringify([period.id, column.prop]),
            label: column.label
          }))
      }
    })
    .filter((group) => group.options.length > 0)
)
const readyCount = computed(
  () =>
    projection.value.normalizedStudents.filter(
      (student) =>
        projection.value.normalizedHeaders.filter(
          (column) => getValidScore(student[column.prop]) !== null
        ).length >= 3
    ).length
)

function open(): void {
  selected.value = (workspace.activePeriod?.references ?? []).map((reference) =>
    JSON.stringify([reference.periodId, reference.prop])
  )
  visible.value = true
}

async function apply(): Promise<void> {
  busy.value = true
  try {
    await setWorkspaceReferences(
      selected.value.map((value) => {
        const [periodId, prop] = JSON.parse(value) as [string, string]
        return { periodId, prop }
      })
    )
    await workspace.refresh()
    visible.value = false
  } catch (error) {
    console.error('设置历史参照失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '设置失败')
  } finally {
    busy.value = false
  }
}

async function openSource(periodId: string): Promise<void> {
  const loading = ElLoading.service({ lock: true, text: '正在打开原学期…' })
  try {
    await switchWorkspace(periodId)
    window.location.hash = '#/score'
    window.location.reload()
  } catch (error) {
    console.error('打开历史学期失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '打开失败')
  } finally {
    loading.close()
  }
}
</script>

<template>
  <div class="workspace-reference-bar">
    <span
      >历史参照：{{
        projection.referenceHeaders.length
          ? projection.referenceHeaders.map((column) => column.label).join('、')
          : '未使用'
      }}</span
    >
    <el-button link type="primary" @click="open">更换参照</el-button>
    <span class="workspace-reference-bar__hint"
      >{{ readyCount }} /
      {{ projection.normalizedStudents.length }}
      人已有三次有效成绩。总览按百分制计算，跨学期趋势仅供参考。</span
    >
    <span v-if="projection.missingReferences" class="workspace-reference-bar__warning"
      >{{ projection.missingReferences }} 项参照已失效，请重新选择。</span
    >
    <el-dialog
      v-model="visible"
      title="历史参照"
      width="min(760px, calc(100vw - 32px))"
      class="workspace-reference-dialog"
      append-to-body
      :close-on-click-modal="false"
    >
      <div class="workspace-reference-dialog__intro">
        <p>选择往期成绩，帮助观察学生的连续变化。</p>
        <span>仅用于趋势分析，不计入本期统计；缺考与无成绩保持为空。</span>
      </div>
      <el-scrollbar
        v-if="groups.length"
        class="workspace-reference-dialog__scroll"
        max-height="min(480px, 52vh)"
      >
        <el-checkbox-group v-model="selected" :disabled="busy">
          <section
            v-for="group in groups"
            :key="group.period.id"
            class="workspace-reference-dialog__group"
          >
            <div class="workspace-reference-dialog__group-header">
              <div class="workspace-reference-dialog__group-title">
                <strong>{{ group.period.termName }}</strong>
                <el-tag size="small" effect="plain" type="info">{{
                  group.period.className
                }}</el-tag>
                <span>{{ group.options.length }} 次成绩</span>
              </div>
              <el-button
                link
                type="primary"
                :disabled="busy"
                :aria-label="`打开${group.period.className} ${group.period.termName}`"
                @click="openSource(group.period.id)"
                >打开原学期</el-button
              >
            </div>
            <div class="workspace-reference-dialog__grid">
              <el-checkbox
                v-for="option in group.options"
                :key="option.value"
                :value="option.value"
                class="workspace-reference-dialog__option"
                :class="{ 'is-selected': selected.includes(option.value) }"
                >{{ option.label }}</el-checkbox
              >
            </div>
          </section>
        </el-checkbox-group>
      </el-scrollbar>
      <el-empty v-else :image-size="88" description="暂无可引用的历史成绩" />
      <template #footer>
        <div class="workspace-reference-dialog__footer">
          <span class="workspace-reference-dialog__selection">
            已选 <strong>{{ selected.length }}</strong> 次成绩
            <span v-if="!selected.length"> · 仅使用本期成绩</span>
          </span>
          <div>
            <el-button :disabled="busy" @click="visible = false">取消</el-button>
            <el-button type="primary" :loading="busy" @click="apply">应用参照</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.workspace-reference-bar {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  padding: 8px 12px;
  margin-bottom: 8px;
  font-size: 12px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  &__hint {
    color: var(--el-text-color-secondary);
  }
  &__warning {
    color: var(--el-color-warning);
  }
}

.workspace-reference-dialog {
  &__intro {
    padding: 14px 16px;
    margin-bottom: 20px;
    background: var(--el-fill-color-light);
    border-radius: 10px;
    line-height: 1.6;
    p {
      margin: 0 0 4px;
      font-size: 14px;
      color: var(--el-text-color-primary);
    }
    > span {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
  &__scroll {
    :deep(.el-scrollbar__view) {
      padding-right: 12px;
    }
  }
  &__group {
    padding: 16px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
    & + & {
      margin-top: 14px;
    }
  }
  &__group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }
  &__group-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    strong {
      color: var(--el-text-color-primary);
      font-size: 14px;
      font-weight: 600;
    }
    > span {
      color: var(--el-text-color-secondary);
      font-size: 12px;
    }
  }
  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  &__option.el-checkbox {
    height: auto;
    min-height: 42px;
    margin: 0;
    padding: 10px 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 7px;
    transition:
      background-color 0.15s,
      border-color 0.15s;
    &:hover {
      border-color: var(--el-color-primary-light-5);
      background: var(--el-fill-color-light);
    }
    &.is-selected {
      border-color: var(--el-color-primary-light-5);
      background: var(--el-color-primary-light-9);
    }
    :deep(.el-checkbox__label) {
      min-width: 0;
      white-space: normal;
      overflow-wrap: anywhere;
      line-height: 1.5;
    }
  }
  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 8px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
  &__selection {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    text-align: left;
    strong {
      color: var(--el-color-primary);
    }
  }
}
@media (max-width: 600px) {
  .workspace-reference-dialog {
    &__grid {
      grid-template-columns: minmax(0, 1fr);
    }
    &__group-header,
    &__footer {
      align-items: flex-start;
      flex-wrap: wrap;
    }
  }
}
</style>
