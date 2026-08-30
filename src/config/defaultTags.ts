/** 默认标签分类和标签数据 */
import type { TagCategoryType, TagType } from '@/types/Setting'

/** 默认标签分类列表（含拼音 prop 与中文显示名） */
export const defaultTagCategories: TagCategoryType[] = [
  { prop: 'xue2_xi2_xi2_guan4', label: '学习习惯' },
  { prop: 'ke4_tang2_biao3_xian4', label: '课堂表现' },
  { prop: 'zuo4_ye4_qing2_kuang4', label: '作业情况' },
  { prop: 'xing2_wei2_xi2_guan4', label: '行为习惯' },
  { prop: 'he2_zuo4_jiao1_wang3', label: '合作交往' },
  { prop: 'qing2_xu4_tai4_du4', label: '情绪态度' },
  { prop: 'te4_chang2_liang4_dian3', label: '特长亮点' },
  { prop: 'cheng2_zhang3_jian4_yi4', label: '成长建议' }
]

/** 默认标签映射（分类 prop -> 标签数组） */
export const defaultTags: TagType = {
  xue2_xi2_xi2_guan4: [
    '勤学善思',
    '专注认真',
    '主动探究',
    '预习充分',
    '复习及时',
    '书写规范',
    '目标明确',
    '持之以恒',
    '专注待强',
    '方法待优'
  ],
  ke4_tang2_biao3_xian4: [
    '积极发言',
    '善于倾听',
    '思路清晰',
    '反应敏捷',
    '参与充分',
    '表达完整',
    '勇于提问',
    '互动积极',
    '举手待勤',
    '倾听待进'
  ],
  zuo4_ye4_qing2_kuang4: [
    '按时完成',
    '订正及时',
    '卷面整洁',
    '格式规范',
    '独立完成',
    '质量稳定',
    '检查细致',
    '书写美观',
    '速度待提',
    '细致待进'
  ],
  xing2_wei2_xi2_guan4: [
    '守纪自律',
    '文明有礼',
    '爱护公物',
    '整理有序',
    '遵守规则',
    '安全意识',
    '责任心强',
    '集体观念',
    '自律待强',
    '习惯待稳'
  ],
  he2_zuo4_jiao1_wang3: [
    '乐于助人',
    '团结同伴',
    '友善待人',
    '善于合作',
    '尊重他人',
    '沟通顺畅',
    '分享主动',
    '集体荣誉',
    '协作待进',
    '表达待放'
  ],
  qing2_xu4_tai4_du4: [
    '阳光开朗',
    '自信大方',
    '乐观向上',
    '情绪稳定',
    '勇敢尝试',
    '认真负责',
    '耐心细致',
    '积极进取',
    '自信待增',
    '耐心待养'
  ],
  te4_chang2_liang4_dian3: [
    '朗读出色',
    '绘画灵动',
    '运动积极',
    '音乐敏感',
    '动手能力',
    '想象丰富',
    '组织能力',
    '表达突出',
    '创意十足',
    '观察细致'
  ],
  cheng2_zhang3_jian4_yi4: [
    '坚持阅读',
    '加强积累',
    '提升速度',
    '关注细节',
    '大胆表达',
    '稳定节奏',
    '主动复盘',
    '勤于练习',
    '减少粗心',
    '增强规划'
  ]
}

/** 创建默认标签分类的拷贝，避免多处共享同一引用 */
export const createDefaultTagCategories = (): TagCategoryType[] =>
  defaultTagCategories.map((item) => ({ ...item }))

/** 创建默认标签映射的深拷贝，避免多处共享同一引用 */
export const createDefaultTags = (): TagType =>
  Object.fromEntries(Object.entries(defaultTags).map(([key, values]) => [key, [...values]]))
