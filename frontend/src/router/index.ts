import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';

// Anonymous browsing is the default — first-time visitors land on /home and
// are prompted to sign in only when they trigger a login-required action.
// /onboarding is still reachable from the login prompt modal or deep links.
const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/onboarding',
    name: 'Onboarding',
    component: () => import('../views/OnboardingPage.vue'),
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/HomePage.vue'),
  },
  {
    path: '/map',
    name: 'Map',
    component: () => import('../views/MapPage.vue'),
  },
  {
    path: '/place/:id',
    name: 'PlaceDetail',
    component: () => import('../views/PlaceDetailPage.vue'),
    props: true,
  },
  {
    path: '/saved',
    name: 'Saved',
    component: () => import('../views/SavedPage.vue'),
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/ProfilePage.vue'),
  },
  {
    path: '/camera',
    name: 'Camera',
    component: () => import('../views/CameraPage.vue'),
  },
  {
    path: '/upload',
    name: 'Upload',
    component: () => import('../views/UploadPage.vue'),
  },
  {
    path: '/stampbook',
    name: 'Stampbook',
    component: () => import('../views/StampbookPage.vue'),
  },
  {
    path: '/reward/:placeId',
    name: 'Reward',
    component: () => import('../views/RewardPage.vue'),
    props: true,
  },
  {
    path: '/gallery/:placeId',
    name: 'Gallery',
    component: () => import('../views/GalleryPage.vue'),
    props: true,
  },
  {
    path: '/work/:id',
    name: 'WorkDetail',
    component: () => import('../views/WorkDetailPage.vue'),
    props: true,
  },
  {
    path: '/feed',
    name: 'Feed',
    component: () => import('../views/FeedPage.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
