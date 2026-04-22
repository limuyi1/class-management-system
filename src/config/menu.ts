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
    path: '/math',
    disabled: true
  },
  {
    name: '评语',
    icon: 'comments',
    path: '/comment',
    disabled: true
  },
  {
    name: '错题本',
    icon: 'clipboard-list',
    path: '/wrong-book',
    disabled: false,
    hidden: !featureFlags.wrongBook
  },
  {
    name: '设置',
    icon: 'gear',
    path: '/setting',
    disabled: false
  }
]

export default menu
