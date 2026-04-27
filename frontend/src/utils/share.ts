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
    title: `${result.workTitle} · ${placeName} 인증 완료!`,
    description: `필름로드에서 ${result.workTitle} 성지를 다녀왔어요`,
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
  workTitle: string;
  coverImageUrls: string[];
}

export function buildPlaceShareData(place: PlaceShareInput): ShareData {
  return {
    title: place.name,
    description: `${place.workTitle} · ${place.regionLabel}`,
    imageUrl: place.coverImageUrls[0] ?? '',
    url: `${shareOrigin()}/place/${place.id}`,
  };
}
