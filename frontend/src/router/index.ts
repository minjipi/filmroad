import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

// Anonymous browsing is the default — first-time visitors land on /home and
// are prompted to sign in only when they trigger a login-required action.
// Routes with `meta.requiresAuth: true` force a redirect to /onboarding
// (carrying the original path as ?redirect=… so we can return after login).
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
    path: '/email-auth',
    name: 'EmailAuth',
    component: () => import('../views/EmailAuthPage.vue'),
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
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/ProfilePage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile/edit',
    name: 'ProfileEdit',
    component: () => import('../views/ProfileEditPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/camera',
    name: 'Camera',
    component: () => import('../views/CameraPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/upload',
    name: 'Upload',
    component: () => import('../views/UploadPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/stampbook',
    name: 'Stampbook',
    component: () => import('../views/StampbookPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/reward/:placeId',
    name: 'Reward',
    component: () => import('../views/RewardPage.vue'),
    props: true,
    meta: { requiresAuth: true },
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
    path: '/shot/:id',
    name: 'ShotDetail',
    component: () => import('../views/ShotDetailPage.vue'),
    props: true,
  },
  {
    path: '/collection/:id',
    name: 'CollectionDetail',
    component: () => import('../views/CollectionDetailPage.vue'),
    props: true,
    // Collections are private to the owner — anonymous visitors get bounced
    // to /onboarding before the page mounts.
    meta: { requiresAuth: true },
  },
  {
    // Explore grid (task #40, per design/pages/13-feed.html).
    path: '/feed',
    name: 'Feed',
    component: () => import('../views/FeedPage.vue'),
  },
  {
    // Instagram-style full-card scroll (task #40, per
    // design/pages/13-feed-detail.html). Reached via "전체보기 ›" in the
    // Explore grid or deep-linked for the legacy full-scroll view.
    path: '/feed/detail',
    name: 'FeedDetail',
    component: () => import('../views/FeedDetailPage.vue'),
  },
  {
    path: '/search',
    name: 'Search',
    component: () => import('../views/SearchPage.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to) => {
  if (!to.meta?.requiresAuth) return true;
  // Pinia must be installed before the first navigation completes; this runs
  // after main.ts has called app.use(createPinia()) so it's safe.
  const auth = useAuthStore();
  // Wait for the first /api/users/me probe to resolve so a hard refresh on
  // a requiresAuth route doesn't bounce to /onboarding just because the
  // cookie-backed session hasn't been rehydrated yet. Memoized — subsequent
  // navigations during the same session get the already-settled promise.
  await auth.ensureSessionReady();
  if (auth.isAuthenticated) return true;
  return {
    path: '/onboarding',
    query: { redirect: to.fullPath },
  };
});

export default router;
