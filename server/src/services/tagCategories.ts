/** 兼容旧资源丢失显示名的系统分类及历史分类。 */
const defaultLabels: Record<string, string> = {
  xue2_xi2_xi2_guan4: '学习习惯',
  ke4_tang2_biao3_xian4: '课堂表现',
  zuo4_ye4_qing2_kuang4: '作业情况',
  xing2_wei2_xi2_guan4: '行为习惯',
  he2_zuo4_jiao1_wang3: '合作交往',
  qing2_xu4_tai4_du4: '情绪态度',
  te4_chang2_liang4_dian3: '特长亮点',
  cheng2_zhang3_jian4_yi4: '成长建议',
  xue2_xi2_biao3_xian4: '学习表现',
  ke4_tang2_zhuang4_tai4: '课堂状态',
  neng2_li4_te4_zheng1: '能力特征',
  cheng2_zhang3_bian4_hua4: '成长变化',
  zhong4_dian3_guan1_zhu4: '重点关注'
}

/** 优先保留已存中文名称，旧分类回退到页面状态或系统预设，未知分类保留原键。 */
export function resolveTagCategories(
  categories: string[],
  labels: Record<string, string> = {},
  legacyCategories: { prop: string; label: string }[] = []
): { prop: string; label: string }[] {
  return categories.map((prop) => {
    const candidates = [labels[prop], legacyCategories.find((row) => row.prop === prop)?.label]
    const label = candidates.find((value) => value?.trim() && value !== prop)
    return { prop, label: label || (Object.hasOwn(defaultLabels, prop) ? defaultLabels[prop]! : prop) }
  })
}
