import type { ShareData } from '@/stores/ui';
import type { PhotoResponse } from '@/stores/upload';

function shareOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/**
 * 인증 직후 "친구에게 자랑하기" 카드. UploadPage / RewardPage 가 같은 PhotoResponse 를
 * 공유 시트에 넘길 때 사용. placeName 은 stamp 응답에서 우선, 없으면 호출부의 fallback
 * (예: targetPlace.placeName) 을 사용.
 */
export function buildBoastShareData(
  result: PhotoResponse,
  fallbackPlaceName?: string | null,
): ShareData {
  const placeName = result.stamp?.placeName ?? fallbackPlaceName ?? '성지';
  return {
    title: `${result.contentTitle} · ${placeName} 인증 완료!`,
    description: `필름로드에서 ${result.contentTitle} 성지를 다녀왔어요`,
    imageUrl: result.imageUrl,
    url: `${shareOrigin()}/shot/${result.id}`,
  };
}

/**
 * 성지(place) 를 공유할 때 쓰는 공통 카드. PlaceDetailPage / MapPage 등 PlaceDetail
 * 모양이 다른 store 가 같이 쓸 수 있도록 구조적 타입으로 받는다.
 */
export interface PlaceShareInput {
  id: number;
  name: string;
  regionLabel: string;
  contentTitle: string;
  coverImageUrls: string[];
}

export function buildPlaceShareData(place: PlaceShareInput): ShareData {
  return {
    title: place.name,
    description: `${place.contentTitle} · ${place.regionLabel}`,
    imageUrl: place.coverImageUrls[0] ?? '',
    url: `${shareOrigin()}/place/${place.id}`,
  };
}

/**
 * 사용자 프로필 공유 카드. /profile (내 프로필) 과 /user/:id (남의 프로필) 가
 * 같은 빌더를 쓴다. 공유 URL 은 항상 /user/:id — /profile 은 me 전용 라우트라
 * 다른 사람이 클릭해도 의미가 없음. bio 가 비어 있으면 레벨 라벨로 폴백.
 */
export interface ProfileShareInput {
  id: number;
  nickname: string;
  handle: string;
  avatarUrl: string;
  // bio 미설정 사용자는 백엔드가 null 을 내려보낸다. 타입 상으로는 string 이지만
  // 런타임은 null/undefined 일 수 있어 nullable 로 수용.
  bio: string | null | undefined;
  level: number;
  levelName: string;
}

export function buildProfileShareData(user: ProfileShareInput): ShareData {
  const trimmedBio = (user.bio ?? '').trim();
  const description = trimmedBio.length > 0
    ? trimmedBio
    : `LV.${user.level} · ${user.levelName}`;
  return {
    title: `${user.nickname} (@${user.handle})`,
    description,
    imageUrl: user.avatarUrl,
    url: `${shareOrigin()}/user/${user.id}`,
  };
}
