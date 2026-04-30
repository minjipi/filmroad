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
    // Public user profile (task #42). Endpoint is permitAll — anonymous
    // viewers get { isMe: false, following: false } — so NO
    // `meta.requiresAuth` gate here. If the viewer is the same user,
    // the page internally redirects to /profile.
    path: '/user/:id',
    name: 'UserProfile',
    component: () => import('../views/UserProfilePage.vue'),
    props: true,
  },
  {
    // 팔로워 / 팔로잉 목록 — 같은 컴포넌트가 두 라우트를 처리하고 initialTab
    // prop 으로 어느 탭을 활성화할지 결정. 사용자가 탭을 바꾸면 router.replace
    // 로 URL 도 같이 동기화.
    path: '/user/:id/followers',
    name: 'FollowFollowers',
    component: () => import('../views/FollowListPage.vue'),
    props: (route) => ({ id: route.params.id, initialTab: 'followers' }),
  },
  {
    path: '/user/:id/following',
    name: 'FollowFollowing',
    component: () => import('../views/FollowListPage.vue'),
    props: (route) => ({ id: route.params.id, initialTab: 'following' }),
  },
  {
    path: '/profile/edit',
    name: 'ProfileEdit',
    component: () => import('../views/ProfileEditPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile/likes',
    name: 'ProfileLikes',
    component: () => import('../views/LikedPlacesPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile/routes',
    name: 'ProfileRoutes',
    component: () => import('../views/SavedRoutesPage.vue'),
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
    path: '/gallery/:placeId',
    name: 'Gallery',
    component: () => import('../views/GalleryPage.vue'),
    props: true,
  },
  {
    path: '/content/:id',
    name: 'ContentDetail',
    component: () => import('../views/ContentDetailPage.vue'),
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
  {
    // 여행 루트 짜기 — collectionId 가 있으면 기존 컬렉션 편집, 없으면 신규.
    // contentId / contentTitle query 로 진입 시 해당 작품의 성지 N개 시드.
    // (실제 구현은 task #7. 현재는 stub 페이지 — 백엔드 task #6 완료 후 frontend
    //  task #7 가 본 컴포넌트로 채움.)
    path: '/route/:collectionId?',
    name: 'TripRoute',
    component: () => import('../views/TripRoutePage.vue'),
    props: true,
    meta: { requiresAuth: true },
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
