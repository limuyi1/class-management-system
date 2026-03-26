import { createRouter, createWebHashHistory } from 'vue-router'

import HomePage from '@/views/home/HomePage.vue'
import MainPage from '@/views/main/MainPage.vue'
import Math from '@/views/score/ScorePage.vue'
import Comment from '@/views/evaluation/EvaluationPage.vue'
import Setting from '@/views/setting/SettingPage.vue'
import EmptyPage from '@/views/empty/EmptyPage.vue'

import { useDataSourceStore } from '@/stores/data-source'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/empty',
      name: 'Empty',
      component: EmptyPage
    },
    {
      path: '/',
      redirect: '/home'
    },
    {
      path: '/main',
      name: 'Main',
      component: MainPage,
      children: [
        {
          path: '/home',
          name: 'Home',
          component: HomePage
        },
        {
          path: '/math',
          name: 'Math',
          component: Math
        },
        {
          path: '/comment',
          name: 'Comment',
          component: Comment
        },
        {
          path: '/setting',
          name: 'Setting',
          component: Setting
        }
      ]
    }
  ]
})

router.beforeEach((to, _from, next) => {
  const store = useDataSourceStore()
  const hasData = store.data?.length > 0

  if (to.path === '/empty') {
    next()
    return
  }

  if (!hasData) {
    next('/empty')
    return
  }

  next()
})

export default router
