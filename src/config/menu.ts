/**
 * 左侧导航菜单配置
 * disabled 仅为默认值，实际是否可用由 LeftMenu 根据是否已有学生数据重算。
 */
import { featureFlags } from '@/config/features'

const menu = [
  {
    name: '总览',
    icon: 'chart-line',
    path: '/overview',
    disabled: false
  },
  {
    name: '成绩',
    icon: 'graduation-cap',
    path: '/score',
    disabled: false
  },
  {
    name: '学生',
    icon: 'user',
    path: '/student-info',
    disabled: false
  },
  {
    name: '错题本',
    icon: 'clipboard-list',
    path: '/wrong-book',
    disabled: false,
    hidden: !featureFlags.wrongBook
  },
  {
    name: '工具',
    icon: 'toolbox',
    path: '/tools',
    disabled: false
  },
  {
    name: '设置',
    icon: 'gear',
    path: '/setting',
    disabled: false
  }
]

export default menu
