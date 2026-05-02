<template>
  <ion-page>
    <ion-content :fullscreen="true" class="ea-content">
      <div class="ea-root">
        <div class="auth-top">
          <button class="back" type="button" aria-label="뒤로" @click="onBack">
            <ion-icon :icon="chevronBackOutline" class="ic-22" />
          </button>
          <span class="step">{{ mode === 'signup' ? 'STEP 2 / 3' : '' }}</span>
        </div>

        <div class="ea-scroll no-scrollbar">
          <div class="seg-tabs" role="tablist">
            <button
              type="button"
              class="seg-tab"
              :class="{ on: mode === 'login' }"
              role="tab"
              :aria-selected="mode === 'login'"
              @click="setMode('login')"
            >
              로그인
            </button>
            <button
              type="button"
              class="seg-tab"
              :class="{ on: mode === 'signup' }"
              role="tab"
              :aria-selected="mode === 'signup'"
              @click="setMode('signup')"
            >
              회원가입
            </button>
          </div>

          <!-- SIGNUP -->
          <form
            v-if="mode === 'signup'"
            class="view-signup"
            novalidate
            @submit.prevent="onSubmitSignup"
          >
            <div class="auth-intro">
              <h1>이메일로<br />필름로드 시작하기</h1>
              <p>계정을 만들고 나만의 성지 지도를 채워보세요.</p>
            </div>

            <div class="form">
              <div class="field">
                <span class="lbl">이름</span>
                <div class="input-wrap">
                  <input
                    v-model.trim="name"
                    type="text"
                    placeholder="본명 또는 닉네임"
                    autocomplete="name"
                  />
                  <span class="ic-right">
                    <ion-icon :icon="personOutline" class="ic-20" />
                  </span>
                </div>
              </div>

              <div class="field">
                <span class="lbl">이메일</span>
                <div
                  class="input-wrap"
                  :class="{
                    valid: emailStatus === 'available',
                    'has-error': emailStatus === 'taken' || emailFormatError,
                  }"
                >
                  <input
                    v-model.trim="email"
                    type="email"
                    placeholder="your@email.com"
                    autocomplete="email"
                    inputmode="email"
                  />
                  <span class="ic-right">
                    <ion-icon
                      :icon="
                        emailStatus === 'available'
                          ? checkmarkCircleOutline
                          : mailOutline
                      "
                      class="ic-20"
                    />
                  </span>
                </div>
                <div v-if="emailFormatError" class="help err">
                  <ion-icon :icon="closeCircleOutline" class="ic-16" />{{ emailFormatError }}
                </div>
                <div v-else-if="emailStatus === 'available'" class="help ok">
                  <ion-icon :icon="checkmarkCircleOutline" class="ic-16" />사용 가능한 이메일이에요
                </div>
                <div v-else-if="emailStatus === 'taken'" class="help err">
                  <ion-icon :icon="closeCircleOutline" class="ic-16" />{{
                    emailTakenReason || '이미 사용 중인 이메일이에요'
                  }}
                </div>
                <div v-else-if="emailStatus === 'checking'" class="help">
                  확인 중…
                </div>
              </div>

              <div class="field">
                <span class="lbl">비밀번호</span>
                <div class="input-wrap">
                  <input
                    v-model="password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="8자 이상, 문자·숫자 포함"
                    autocomplete="new-password"
                  />
                  <button
                    type="button"
                    class="ic-right"
                    :aria-label="showPassword ? '비밀번호 숨기기' : '비밀번호 표시'"
                    @click="showPassword = !showPassword"
                  >
                    <ion-icon
                      :icon="showPassword ? eyeOffOutline : eyeOutline"
                      class="ic-20"
                    />
                  </button>
                </div>
                <div class="strength" aria-hidden="true">
                  <span
                    v-for="i in 4"
                    :key="i"
                    class="bar"
                    :class="{
                      on: i <= passwordStrength.level && passwordStrength.level >= 3,
                      warn: i <= passwordStrength.level && passwordStrength.level < 3,
                    }"
                  />
                  <span
                    class="txt"
                    :class="{ weak: passwordStrength.level < 3 }"
                  >
                    {{ passwordStrength.label }}
                  </span>
                </div>
              </div>

              <div class="field">
                <span class="lbl">비밀번호 확인</span>
                <div
                  class="input-wrap"
                  :class="{
                    valid: passwordConfirm !== '' && passwordConfirm === password,
                    'has-error': passwordConfirm !== '' && passwordConfirm !== password,
                  }"
                >
                  <input
                    v-model="passwordConfirm"
                    :type="showPasswordConfirm ? 'text' : 'password'"
                    placeholder="한 번 더 입력해 주세요"
                    autocomplete="new-password"
                  />
                  <button
                    type="button"
                    class="ic-right"
                    :aria-label="showPasswordConfirm ? '비밀번호 숨기기' : '비밀번호 표시'"
                    @click="showPasswordConfirm = !showPasswordConfirm"
                  >
                    <ion-icon
                      :icon="
                        passwordConfirm !== '' && passwordConfirm === password
                          ? checkmarkCircleOutline
                          : showPasswordConfirm
                            ? eyeOffOutline
                            : eyeOutline
                      "
                      class="ic-20"
                    />
                  </button>
                </div>
                <div
                  v-if="passwordConfirm !== '' && passwordConfirm !== password"
                  class="help err"
                >
                  <ion-icon :icon="closeCircleOutline" class="ic-16" />비밀번호가 일치하지 않아요
                </div>
              </div>
            </div>

            <div class="form terms">
              <div
                class="check-row all"
                :class="{ on: allRequiredAgreed && agreeMarketing }"
                @click="toggleAll"
              >
                <span class="box"><ion-icon :icon="checkmarkOutline" class="ic-16" /></span>
                <span>전체 동의</span>
              </div>
              <div
                v-for="item in termItems"
                :key="item.key"
                class="check-row"
                :class="{ on: item.model.value }"
                @click="item.model.value = !item.model.value"
              >
                <span class="box"><ion-icon :icon="checkmarkOutline" class="ic-16" /></span>
                <span class="req" :class="{ optional: !item.required }">
                  {{ item.required ? '필수' : '선택' }}
                </span>
                <span>{{ item.label }}</span>
                <span class="arrow">
                  <ion-icon :icon="chevronForwardOutline" class="ic-18" />
                </span>
              </div>
            </div>

            <div class="submit-area">
              <button
                class="submit"
                type="submit"
                :disabled="!canSubmitSignup || submitting"
              >
                {{ submitting ? '가입 중…' : '가입 완료하기' }}
              </button>
            </div>
          </form>

          <!-- LOGIN -->
          <form
            v-else
            class="view-login"
            novalidate
            @submit.prevent="onSubmitLogin"
          >
            <div class="auth-intro">
              <h1>다시 만나서<br />반가워요 👋</h1>
              <p>이메일과 비밀번호로 로그인하세요.</p>
            </div>

            <div class="form">
              <div class="field">
                <span class="lbl">이메일</span>
                <div class="input-wrap">
                  <input
                    v-model.trim="email"
                    type="email"
                    placeholder="your@email.com"
                    autocomplete="email"
                    inputmode="email"
                  />
                  <span class="ic-right">
                    <ion-icon :icon="mailOutline" class="ic-20" />
                  </span>
                </div>
              </div>

              <div class="field">
                <span class="lbl">비밀번호</span>
                <div class="input-wrap">
                  <input
                    v-model="password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="비밀번호를 입력하세요"
                    autocomplete="current-password"
                  />
                  <button
                    type="button"
                    class="ic-right"
                    :aria-label="showPassword ? '비밀번호 숨기기' : '비밀번호 표시'"
                    @click="showPassword = !showPassword"
                  >
                    <ion-icon
                      :icon="showPassword ? eyeOffOutline : eyeOutline"
                      class="ic-20"
                    />
                  </button>
                </div>
              </div>

              <div class="row-between">
                <label class="remember">
                  <span
                    class="box-sm"
                    :class="{ on: rememberMe }"
                    @click.prevent="rememberMe = !rememberMe"
                  >
                    <ion-icon
                      v-if="rememberMe"
                      :icon="checkmarkOutline"
                      class="ic-16"
                    />
                  </span>
                  로그인 유지
                </label>
                <button
                  type="button"
                  class="forgot"
                  @click="onForgotPassword"
                >
                  비밀번호 찾기
                </button>
              </div>
            </div>

            <div class="submit-area">
              <button
                class="submit"
                type="submit"
                :disabled="!canSubmitLogin || submitting"
              >
                {{ submitting ? '로그인 중…' : '로그인' }}
              </button>
            </div>
          </form>

          <div class="divider">또는</div>

          <div class="socials">
            <button type="button" class="soc-btn kakao" @click="onKakao">
              <ion-icon :icon="chatbubbleEllipsesOutline" class="ic-18" />
              카카오
            </button>
            <button type="button" class="soc-btn apple" @click="onApple">
              <ion-icon :icon="logoApple" class="ic-18" />
              Apple
            </button>
            <button type="button" class="soc-btn google" @click="onGoogle">
              <ion-icon :icon="logoGoogle" class="ic-18" />
              Google
            </button>
          </div>

          <div class="bottom-cta">
            <template v-if="mode === 'signup'">
              이미 계정이 있으신가요?<a href="#" @click.prevent="setMode('login')">로그인</a>
            </template>
            <template v-else>
              아직 계정이 없으신가요?<a href="#" @click.prevent="setMode('signup')">회원가입</a>
            </template>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  chevronBackOutline,
  chevronForwardOutline,
  checkmarkOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  eyeOffOutline,
  eyeOutline,
  mailOutline,
  personOutline,
  chatbubbleEllipsesOutline,
  logoApple,
  logoGoogle,
} from 'ionicons/icons';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { ApiError } from '@/services/api';
import { useToast } from '@/composables/useToast';
import { markOnboarded } from '@/composables/useOnboarding';

type Mode = 'login' | 'signup';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { showError, showInfo } = useToast();

const initialMode = route.query.mode === 'login' ? 'login' : 'signup';
const mode = ref<Mode>(initialMode as Mode);

// The router guard on /meta.requiresAuth routes forwards the original URL
// here as ?redirect=…; fall back to /home when nothing was stashed.
function redirectTarget(): string {
  const q = route.query.redirect;
  const raw = Array.isArray(q) ? q[0] : q;
  // Only honour same-origin paths — refuse external URLs or router loops.
  if (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) {
    if (raw === '/email-auth' || raw === '/onboarding') return '/home';
    return raw;
  }
  return '/home';
}

const name = ref('');
const email = ref('');
const password = ref('');
const passwordConfirm = ref('');
const showPassword = ref(false);
const showPasswordConfirm = ref(false);
const rememberMe = ref(false);
const submitting = ref(false);

// Terms
const agreeAge = ref(false);
const agreeTos = ref(false);
const agreePrivacy = ref(false);
const agreeMarketing = ref(false);

const termItems = [
  { key: 'age', label: '만 14세 이상입니다', required: true, model: agreeAge },
  { key: 'tos', label: '서비스 이용약관', required: true, model: agreeTos },
  { key: 'privacy', label: '개인정보 수집·이용 동의', required: true, model: agreePrivacy },
  { key: 'marketing', label: '마케팅 정보 수신', required: false, model: agreeMarketing },
];

const allRequiredAgreed = computed(
  () => agreeAge.value && agreeTos.value && agreePrivacy.value,
);

function toggleAll(): void {
  const next = !(allRequiredAgreed.value && agreeMarketing.value);
  agreeAge.value = next;
  agreeTos.value = next;
  agreePrivacy.value = next;
  agreeMarketing.value = next;
}

// Email validation
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailFormatError = computed(() => {
  if (email.value === '') return '';
  if (!EMAIL_RE.test(email.value)) return '이메일 형식이 올바르지 않아요';
  return '';
});

type EmailStatus = 'idle' | 'checking' | 'available' | 'taken';
const emailStatus = ref<EmailStatus>('idle');
const emailTakenReason = ref<string>('');

let emailDebounce: ReturnType<typeof setTimeout> | null = null;

watch(
  () => [email.value, mode.value] as const,
  ([value, currentMode]) => {
    if (emailDebounce) {
      clearTimeout(emailDebounce);
      emailDebounce = null;
    }
    emailStatus.value = 'idle';
    emailTakenReason.value = '';
    if (currentMode !== 'signup') return;
    if (value === '' || !EMAIL_RE.test(value)) return;
    emailStatus.value = 'checking';
    emailDebounce = setTimeout(async () => {
      try {
        const result = await authStore.checkEmail(value);
        // Guard against late responses after the user edited the field.
        if (email.value !== value || mode.value !== 'signup') return;
        emailStatus.value = result.available ? 'available' : 'taken';
        emailTakenReason.value = result.reason ?? '';
      } catch {
        // Silent — network failure shouldn't block the form; server-side
        // validation on submit remains the source of truth.
        if (email.value === value && mode.value === 'signup') {
          emailStatus.value = 'idle';
        }
      }
    }, 400);
  },
);

// Password strength (0..4)
const passwordStrength = computed<{ level: number; label: string }>(() => {
  const v = password.value;
  if (v === '') return { level: 0, label: '' };
  let score = 0;
  if (v.length >= 8) score += 1;
  if (/[A-Za-z]/.test(v) && /\d/.test(v)) score += 1;
  if (v.length >= 12) score += 1;
  if (/[^A-Za-z0-9]/.test(v)) score += 1;
  const label =
    score >= 4 ? '매우 강함' : score === 3 ? '강함' : score === 2 ? '보통' : '약함';
  return { level: score, label };
});

const passwordMeetsPolicy = computed(
  () => password.value.length >= 8 && /[A-Za-z]/.test(password.value) && /\d/.test(password.value),
);

const canSubmitSignup = computed(
  () =>
    name.value.length > 0 &&
    EMAIL_RE.test(email.value) &&
    emailStatus.value !== 'taken' &&
    passwordMeetsPolicy.value &&
    passwordConfirm.value === password.value &&
    allRequiredAgreed.value,
);

const canSubmitLogin = computed(
  () => EMAIL_RE.test(email.value) && password.value.length >= 1,
);

function setMode(next: Mode): void {
  mode.value = next;
}

function onBack(): void {
  if (window.history.length > 1) router.back();
  else void router.replace('/onboarding');
}

async function onSubmitSignup(): Promise<void> {
  if (!canSubmitSignup.value || submitting.value) return;
  submitting.value = true;
  try {
    await authStore.signup({
      name: name.value,
      email: email.value,
      password: password.value,
      agreeAge: agreeAge.value,
      agreeTos: agreeTos.value,
      agreePrivacy: agreePrivacy.value,
      agreeMarketing: agreeMarketing.value,
    });
    markOnboarded();
    await showInfo('가입이 완료되었어요');
    await router.replace(redirectTarget());
  } catch (e) {
    const msg =
      e instanceof ApiError && e.message ? e.message : '가입에 실패했어요. 잠시 후 다시 시도해 주세요.';
    await showError(msg);
  } finally {
    submitting.value = false;
  }
}

async function onSubmitLogin(): Promise<void> {
  if (!canSubmitLogin.value || submitting.value) return;
  submitting.value = true;
  try {
    await authStore.login({ email: email.value, password: password.value });
    markOnboarded();
    await router.replace(redirectTarget());
  } catch (e) {
    const msg =
      e instanceof ApiError && e.message ? e.message : '로그인에 실패했어요. 이메일과 비밀번호를 확인해 주세요.';
    await showError(msg);
  } finally {
    submitting.value = false;
  }
}

function onForgotPassword(): void {
  // Placeholder — 비밀번호 재설정 플로우는 별도 작업으로 이어집니다.
  void showInfo('비밀번호 찾기 기능은 준비 중이에요');
}

function apiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080';
  // Trailing slashes here would produce `//oauth2/...` when concatenated with
  // a leading-slash path, which window.location.href and Browser.open()
  // (unlike axios) don't normalize — Spring Security then 404s the OAuth
  // start endpoint.
  return raw.replace(/\/+$/, '');
}

// Native Capacitor shells (Android/iOS) can't use a same-origin redirect for
// OAuth — Custom Tabs/SFSafariViewController have separate cookie stores from
// the in-app webview. We open the OAuth start URL in the system browser with
// an `app=mobile` flag; the backend success handler then redirects to the
// `filmroad://oauth/callback` deep link instead of the web success page.
async function startOAuth(provider: 'google' | 'kakao'): Promise<void> {
  const webUrl = `${apiBase()}/oauth2/authorization/${provider}`;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: `${webUrl}?app=mobile` });
      return;
    }
  } catch {
    // Capacitor not bundled (web-only build) — fall through to the redirect.
  }
  window.location.href = webUrl;
}

function onGoogle(): void {
  void startOAuth('google');
}

function onKakao(): void {
  void startOAuth('kakao');
}

function onApple(): void {
  // Apple OAuth 는 아직 백엔드에 연결되어 있지 않아 안내 메시지만 노출합니다.
  void showInfo('Apple 로그인은 준비 중이에요');
}
</script>

<style scoped>
/* Design tokens — mirror design/pages/shared.css so the page renders
   identically even when the host app's theme variables differ. */
.ea-root {
  --fr-primary: #14bced;
  --fr-primary-soft: #e6f8fd;
  --fr-ink: #0f172a;
  --fr-ink-2: #334155;
  --fr-ink-3: #64748b;
  --fr-ink-4: #94a3b8;
  --fr-line: #e5e7eb;
  --fr-line-soft: #f1f5f9;
  --fr-bg: #ffffff;
  --fr-bg-muted: #f8fafc;
  --fr-coral: #ff5a5f;
  --fr-amber: #f5a524;
  --fr-mint: #10b981;

  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--fr-bg);
  color: var(--fr-ink);
  font-family:
    'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo',
    'Segoe UI', system-ui, sans-serif;
  letter-spacing: -0.01em;
}

ion-content.ea-content {
  --background: #ffffff;
}

.auth-top {
  padding: calc(8px + env(safe-area-inset-top)) 20px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.back {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.auth-top .step {
  margin-left: auto;
  font-size: 12px;
  color: var(--fr-ink-3);
  font-weight: 700;
  letter-spacing: 0.03em;
}

.ea-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.seg-tabs {
  display: flex;
  margin: 8px 20px 24px;
  background: var(--fr-bg-muted);
  border-radius: 14px;
  padding: 4px;
  position: relative;
}
.seg-tab {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--fr-ink-3);
  border-radius: 10px;
  cursor: pointer;
  letter-spacing: -0.02em;
  transition: color 0.2s;
  background: transparent;
  border: none;
}
.seg-tab.on {
  color: var(--fr-ink);
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.auth-intro {
  padding: 0 24px 26px;
}
.auth-intro h1 {
  font-size: 27px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.25;
  margin: 0 0 8px;
}
.auth-intro p {
  font-size: 14px;
  color: var(--fr-ink-3);
  line-height: 1.5;
  margin: 0;
}

.form {
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field .lbl {
  font-size: 12px;
  font-weight: 700;
  color: var(--fr-ink-2);
  letter-spacing: -0.01em;
  padding-left: 4px;
}
.input-wrap {
  position: relative;
}
.input-wrap input {
  width: 100%;
  height: 54px;
  border-radius: 14px;
  border: 1.5px solid var(--fr-line);
  background: #ffffff;
  padding: 0 48px 0 16px;
  font-size: 15px;
  font-family: inherit;
  color: var(--fr-ink);
  letter-spacing: -0.01em;
  transition: border-color 0.15s;
}
.input-wrap input:focus {
  outline: none;
  border-color: var(--fr-primary);
}
.input-wrap input::placeholder {
  color: var(--fr-ink-4);
}
.input-wrap.valid input {
  border-color: var(--fr-mint);
}
.input-wrap.valid .ic-right {
  color: var(--fr-mint);
}
.input-wrap.has-error input {
  border-color: var(--fr-coral);
}
.input-wrap .ic-right {
  position: absolute;
  top: 50%;
  right: 14px;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fr-ink-4);
  cursor: pointer;
  border: none;
  background: transparent;
}

.help {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--fr-ink-3);
  padding-left: 4px;
  letter-spacing: -0.01em;
}
.help.err {
  color: var(--fr-coral);
}
.help.ok {
  color: var(--fr-mint);
}

.strength {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  padding: 0 4px;
  align-items: center;
}
.strength .bar {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: var(--fr-line);
}
.strength .bar.on {
  background: var(--fr-mint);
}
.strength .bar.warn {
  background: var(--fr-amber);
}
.strength .txt {
  font-size: 10.5px;
  color: var(--fr-mint);
  font-weight: 700;
  margin-left: 4px;
  letter-spacing: -0.01em;
}
.strength .txt.weak {
  color: var(--fr-amber);
}

.terms {
  padding: 20px 24px 8px;
  gap: 10px;
}
.check-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--fr-ink-2);
  cursor: pointer;
}
.check-row .box {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 1.5px solid var(--fr-line);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: transparent;
}
.check-row.on .box {
  background: var(--fr-primary);
  border-color: var(--fr-primary);
  color: #ffffff;
}
.check-row.all {
  font-weight: 800;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--fr-line);
  color: var(--fr-ink);
}
.check-row .arrow {
  margin-left: auto;
  color: var(--fr-ink-4);
}
.check-row .req {
  font-size: 10.5px;
  color: var(--fr-primary);
  font-weight: 700;
  padding: 2px 6px;
  background: var(--fr-primary-soft);
  border-radius: 4px;
}
.check-row .req.optional {
  color: var(--fr-ink-3);
  background: var(--fr-bg-muted);
}

.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 0;
}
.remember {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--fr-ink-2);
  cursor: pointer;
}
.box-sm {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 1.5px solid var(--fr-line);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: transparent;
}
.box-sm.on {
  background: var(--fr-primary);
  border-color: var(--fr-primary);
  color: #ffffff;
}
.forgot {
  font-size: 13px;
  color: var(--fr-primary);
  font-weight: 700;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}

.submit-area {
  padding: 24px 20px 12px;
}
.submit {
  width: 100%;
  height: 54px;
  border-radius: 16px;
  background: var(--fr-primary);
  color: #ffffff;
  border: none;
  font-weight: 800;
  font-size: 15.5px;
  letter-spacing: -0.02em;
  box-shadow: 0 10px 22px rgba(20, 188, 237, 0.35);
  cursor: pointer;
}
.submit:disabled {
  background: var(--fr-line);
  color: var(--fr-ink-4);
  box-shadow: none;
  cursor: not-allowed;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  color: var(--fr-ink-4);
  font-size: 11.5px;
  font-weight: 700;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--fr-line);
}

.socials {
  padding: 0 20px;
  display: flex;
  gap: 10px;
}
.soc-btn {
  flex: 1;
  height: 52px;
  border-radius: 14px;
  border: 1px solid var(--fr-line);
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-weight: 700;
  font-size: 13px;
  color: var(--fr-ink);
  cursor: pointer;
}
.soc-btn.kakao {
  background: #fee500;
  border-color: #fee500;
  color: #181600;
}
.soc-btn.apple {
  background: #000000;
  border-color: #000000;
  color: #ffffff;
}

.bottom-cta {
  text-align: center;
  padding: 22px 20px 28px;
  font-size: 13px;
  color: var(--fr-ink-3);
}
.bottom-cta a {
  color: var(--fr-primary);
  font-weight: 800;
  margin-left: 4px;
  text-decoration: none;
}
</style>
