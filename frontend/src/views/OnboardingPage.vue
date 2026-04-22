<template>
  <ion-page>
    <ion-content :fullscreen="true" class="ob-content">
      <div class="ob-root">
        <div class="bg-img">
          <img
            src="https://images.unsplash.com/photo-1520626337972-005d3cdb8978?auto=format&fit=crop&w=800&q=90"
            alt="background"
          />
        </div>
        <div class="bg-grad" />

        <div class="floating-chip chip-left">
          <span class="d"><ion-icon :icon="locationOutline" class="ic-16" /></span>
          <div>
            <div class="t">영진해변 인증 완료</div>
            <div class="s">도깨비 · 1회</div>
          </div>
        </div>
        <div class="floating-chip chip-right">
          <span class="d chip-amber"><ion-icon :icon="ribbonOutline" class="ic-16" /></span>
          <div>
            <div class="t">새 뱃지 획득!</div>
            <div class="s">바다 러너</div>
          </div>
        </div>

        <div class="content">
          <div class="brand">
            <div class="brand-badge">
              <ion-icon :icon="locationOutline" class="ic-22" />
            </div>
            <span class="brand-name">필름로드</span>
          </div>

          <div class="tag-line">
            <div class="kicker">SACRED SITE PILGRIMAGE</div>
            <h1>드라마 속<br />그 장면,<br /><em>내가 직접</em>.</h1>
            <p>좋아하는 작품의 촬영지를 찾아가서<br />같은 앵글로 인증샷을 남기고 스탬프를 모아요.</p>
          </div>

          <div class="dots">
            <span class="dot on" />
            <span class="dot" />
            <span class="dot" />
          </div>

          <div class="auth-btns">
            <button class="auth-btn google" type="button" @click="onGoogle">
              <ion-icon :icon="logoGoogle" class="ic-18" />Google로 계속하기
            </button>
            <button class="auth-btn kakao" type="button" @click="onKakao">
              <ion-icon :icon="chatbubbleEllipsesOutline" class="ic-18" />카카오로 3초 만에 시작
            </button>
            <button class="auth-btn email" type="button" @click="onEmail">
              <ion-icon :icon="mailOutline" class="ic-18" />이메일로 가입
            </button>
          </div>

          <div class="legal">
            계속하면 <a>이용약관</a>과 <a>개인정보처리방침</a>에<br />동의하는 것으로 간주돼요.
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  locationOutline,
  ribbonOutline,
  logoGoogle,
  chatbubbleEllipsesOutline,
  mailOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { markOnboarded } from '@/composables/useOnboarding';

const router = useRouter();

function onGoogle(): void {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080';
  window.location.href = `${base}/oauth2/authorization/google`;
}

function onKakao(): void {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080';
  window.location.href = `${base}/oauth2/authorization/kakao`;
}

async function onEmail(): Promise<void> {
  markOnboarded();
  await router.replace('/home');
}
</script>

<style scoped>
ion-content.ob-content {
  --background: #0a0a0a;
}

.ob-root {
  position: absolute;
  inset: 0;
  background: #0a0a0a;
  color: #ffffff;
  overflow: hidden;
}

.bg-img {
  position: absolute;
  inset: 0;
}
.bg-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.7;
  display: block;
}
.bg-grad {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(10, 10, 10, 0.3) 0%,
    rgba(10, 10, 10, 0.6) 50%,
    #0a0a0a 100%
  );
}

.floating-chip {
  position: absolute;
  z-index: 3;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 12px 8px 8px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}
.floating-chip .d {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--fr-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}
.floating-chip .d.chip-amber {
  background: #f5a524;
}
.floating-chip .t {
  font-size: 11.5px;
  font-weight: 700;
  color: #ffffff;
}
.floating-chip .s {
  font-size: 9.5px;
  opacity: 0.7;
  color: #ffffff;
}
.chip-left {
  top: calc(130px + env(safe-area-inset-top));
  left: 24px;
}
.chip-right {
  top: calc(220px + env(safe-area-inset-top));
  right: 24px;
}

.content {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: calc(60px + env(safe-area-inset-top)) 28px calc(40px + env(safe-area-inset-bottom));
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.brand-badge {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: var(--fr-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 30px rgba(20, 188, 237, 0.4);
  color: #ffffff;
}
.brand-name {
  font-size: 18px;
  font-weight: 900;
  letter-spacing: -0.04em;
  color: #ffffff;
}

.tag-line {
  margin-top: auto;
}
.tag-line .kicker {
  font-size: 12px;
  font-weight: 700;
  color: var(--fr-primary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 10px;
}
.tag-line h1 {
  font-size: 38px;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.05;
  margin: 0;
  color: #ffffff;
}
.tag-line h1 em {
  font-style: normal;
  background: linear-gradient(135deg, #14BCED, #7c3aed);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.tag-line p {
  font-size: 14.5px;
  opacity: 0.75;
  margin-top: 16px;
  line-height: 1.55;
  color: #ffffff;
}

.dots {
  display: flex;
  gap: 6px;
  margin: 26px 0 16px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
}
.dot.on {
  width: 22px;
  background: #ffffff;
  border-radius: 3px;
}

.auth-btns {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.auth-btn {
  height: 52px;
  border-radius: 14px;
  font-size: 14.5px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  letter-spacing: -0.01em;
  cursor: pointer;
}
.auth-btn.google {
  background: #ffffff;
  color: #191919;
}
.auth-btn.kakao {
  background: #FEE500;
  color: #191919;
}
.auth-btn.email {
  background: transparent;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.legal {
  font-size: 11px;
  opacity: 0.5;
  text-align: center;
  margin-top: 16px;
  line-height: 1.5;
  color: #ffffff;
}
.legal a {
  color: #ffffff;
  text-decoration: underline;
}
</style>
