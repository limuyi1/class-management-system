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
          component: () => import('@/views/evaluation/EvaluationPage.vue')
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
          path: '/setting',
          name: 'Setting',
          component: () => import('@/views/setting/SettingPage.vue')
        }
      ]
    }
  ]
})

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
      '/tools/name-list-compare',
      '/tools/attachments',
      '/tools/paper-layout',
      '/tools/score-notice',
      '/tools/seating-chart',
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
