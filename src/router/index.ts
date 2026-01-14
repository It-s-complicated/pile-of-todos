import { createRouter, createWebHistory } from 'vue-router'
import ArchivedView from '../views/ArchivedView.vue'
import BacklogView from '../views/BacklogView.vue'
import CurrentWeekView from '../views/CurrentWeekView.vue'
import FinishedView from '../views/FinishedView.vue'
import FutureView from '../views/FutureView.vue'
import UnfinishedView from '../views/UnfinishedView.vue'

const routes = [
  { path: '/', redirect: '/backlog' },
  { path: '/backlog', name: 'backlog', component: BacklogView },
  { path: '/current-week', name: 'current-week', component: CurrentWeekView },
  { path: '/future', name: 'future', component: FutureView },
  { path: '/unfinished', name: 'unfinished', component: UnfinishedView },
  { path: '/archived', name: 'archived', component: ArchivedView },
  { path: '/finished', name: 'finished', component: FinishedView },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
