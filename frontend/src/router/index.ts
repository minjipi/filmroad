import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import { hasOnboarded } from '@/composables/useOnboarding';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: () => (hasOnboarded() ? '/home' : '/onboarding'),
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
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to) => {
  if (to.path === '/onboarding' && hasOnboarded()) {
    return { path: '/home' };
  }
  return true;
});

export default router;
