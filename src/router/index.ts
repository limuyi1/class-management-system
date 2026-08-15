/**
 * Vue Router 路由配置
 * 使用 hash 模式，支持 /overview, /score, /evaluation, /setting 等主要路由
 */
import { createRouter, createWebHashHistory } from 'vue-router'

import MainPage from '@/views/main/MainPage.vue'
import RootRedirectPage from '@/views/root/RootRedirectPage.vue'

import { useDataSourceStore } from '@/stores/data-source'
import type { NavigationGuardWithThis, RouteLocationNormalized } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'RootRedirect',
      component: RootRedirectPage
    },
    {
      path: '/main',
      name: 'Main',
      component: MainPage,
      children: [
        {
          path: '/overview',
          name: 'Overview',
          component: () => import('@/views/overview/OverviewPage.vue')
        },
        {
          path: '/math',
          name: 'Math',
          component: () => import('@/views/score/ScorePage.vue')
        },
        {
          path: '/comment',
          name: 'Comment',
          redirect: '/tools/comments'
        },
        {
          path: '/student-info',
          name: 'StudentInfo',
          component: () => import('@/views/student-info/StudentInfoPage.vue')
        },
        {
          path: '/wrong-book',
          name: 'WrongBook',
          component: () => import('@/views/wrong-book/WrongBookPage.vue')
        },
        {
          path: '/tools',
          name: 'Tools',
          component: () => import('@/views/tools/ToolsPage.vue')
        },
        {
          path: '/tools/comments',
          name: 'CommentTool',
          component: () => import('@/views/evaluation/EvaluationPage.vue')
        },
        {
          path: '/tools/name-list-compare',
          name: 'NameListCompare',
          component: () => import('@/views/tools/NameListComparePage.vue')
        },
        {
          path: '/tools/attachments',
          name: 'AttachmentLibrary',
          component: () => import('@/views/tools/AttachmentLibraryPage.vue')
        },
        {
          path: '/tools/paper-layout',
          name: 'PaperLayout',
          component: () => import('@/views/tools/PaperLayoutPage.vue')
        },
        {
          path: '/tools/score-notice',
          name: 'ScoreNotice',
          component: () => import('@/views/score-notice/ScoreNoticePage.vue')
        },
        {
          path: '/tools/seating-chart',
          name: 'SeatingChart',
          component: () => import('@/views/seating-chart/SeatingChartPage.vue')
        },
        {
          path: '/tools/duty-roster',
          name: 'DutyRoster',
          component: () => import('@/views/duty-roster/DutyRosterPage.vue')
        },
        {
          path: '/setting',
          name: 'Setting',
          component: () => import('@/views/setting/SettingPage.vue')
        }
      ]
    }
  ]
})

/**
 * 创建数据就绪路由守卫
 * 等待学生数据加载完成后校验数据状态，数据为空时限制进入成绩等页面
 * @param getStore - 获取数据源 store 的函数（默认使用 useDataSourceStore）
 * @returns Vue Router 导航守卫
 */
export function createDataGuard(
  getStore: () => Pick<
    ReturnType<typeof useDataSourceStore>,
    'waitForInitReady' | 'enabledData'
  > = useDataSourceStore
): NavigationGuardWithThis<undefined> {
  return async (
    to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
    next: (to?: string | false | void) => void
  ) => {
    const allowedPaths = [
      '/tools',
      '/tools/comments',
      '/tools/name-list-compare',
      '/tools/attachments',
      '/tools/paper-layout',
      '/tools/score-notice',
      '/tools/seating-chart',
      '/tools/duty-roster',
      '/setting'
    ]

    if (allowedPaths.includes(to.path)) {
      next()
      return
    }

    const store = getStore()
    await store.waitForInitReady()

    if (store.enabledData.length === 0) {
      next('/tools')
      return
    }

    next()
  }
}

router.beforeEach(createDataGuard())

export default router
