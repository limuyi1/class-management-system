import { computed } from 'vue'

import { useConfigurationStore } from '@/stores/configuration'
import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { useWorkspaceStore } from '@/stores/workspace'
import { buildWorkspaceScoreProjection } from '@/utils/workspaceScoreUtil'

/** 为成绩表、总览和学习报告提供相同的历史参照及百分制数据。 */
export function useWorkspaceScores() {
  const workspace = useWorkspaceStore()
  const data = useDataSourceStore()
  const setting = useSettingStore()
  const configuration = useConfigurationStore()
  const projection = computed(() =>
    buildWorkspaceScoreProjection(
      workspace.catalog,
      workspace.snapshots,
      data.enabledData,
      setting.enabledScoreColumns,
      configuration.scoreFullMark
    )
  )
  return { projection }
}
