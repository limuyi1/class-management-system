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
      // 子路由页面采用懒加载，按需请求对应组件以减小首屏体积
      children: [
        {
          path: '/overview',
          name: 'Overview',
          component: () => import('@/views/overview/OverviewPage.vue')
        },
        {
          path: '/score',
          name: 'Score',
          component: () => import('@/views/score/ScorePage.vue')
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
    // 无学生数据时仍允许访问的页面路径（工具与设置类页面）
    const allowedPaths = [
      '/tools',
      '/tools/comments',
      '/tools/name-list-compare',
      '/tools/attachments',
      '/tools/paper-layout',
      '/tools/score-notice',
      '/tools/seating-chart',
      '/tools/duty-roster',
      '/student-info',
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

// 注册全局前置守卫：等待数据初始化完成，数据为空时重定向到工具页
router.beforeEach(createDataGuard())

export default router
