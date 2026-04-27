import { describe, it, expect } from 'vitest';
import {
  buildBoastShareData,
  buildPlaceShareData,
  buildProfileShareData,
} from '@/utils/share';
import type { PhotoResponse } from '@/stores/upload';

describe('buildProfileShareData', () => {
  const baseUser = {
    id: 7,
    nickname: '비타민찌',
    handle: 'ghdalswj',
    avatarUrl: 'https://img/avatar.jpg',
    bio: '여행 좋아함',
    level: 3,
    levelName: '성지 입문자',
  };

  it('uses bio when present, profile url points to /user/:id', () => {
    const data = buildProfileShareData(baseUser);
    expect(data.title).toBe('비타민찌 (@ghdalswj)');
    expect(data.description).toBe('여행 좋아함');
    expect(data.imageUrl).toBe('https://img/avatar.jpg');
    expect(data.url).toMatch(/\/user\/7$/);
  });

  it('falls back to "LV.X · {levelName}" when bio is null (서버가 null 내려줄 때 대비)', () => {
    // bio === null 인 사용자에서 .trim() 호출하면 TypeError 가 발생하던 회귀 차단.
    const data = buildProfileShareData({ ...baseUser, bio: null });
    expect(data.description).toBe('LV.3 · 성지 입문자');
  });

  it('falls back to level label when bio is undefined', () => {
    const { bio: _omit, ...withoutBio } = baseUser;
    void _omit;
    const data = buildProfileShareData(withoutBio as typeof baseUser);
    expect(data.description).toBe('LV.3 · 성지 입문자');
  });

  it('falls back when bio is whitespace-only', () => {
    const data = buildProfileShareData({ ...baseUser, bio: '   ' });
    expect(data.description).toBe('LV.3 · 성지 입문자');
  });
});

describe('buildBoastShareData', () => {
  const baseResult: PhotoResponse = {
    id: 99,
    imageUrl: 'https://cdn/p/99.jpg',
    placeId: 10,
    workId: 1,
    workTitle: '도깨비',
    workEpisode: '1회',
    caption: null,
    tags: [],
    visibility: 'PUBLIC',
    createdAt: '2026-04-22T00:00:00Z',
    images: [{ id: 99, imageUrl: 'https://cdn/p/99.jpg', imageOrderIndex: 0 }],
  };

  it('prefers stamp.placeName, falls through to fallbackPlaceName, then "성지"', () => {
    const withStamp = buildBoastShareData(
      {
        ...baseResult,
        stamp: { placeName: '주문진 영진해변 방파제', workId: 1, workTitle: '도깨비', collectedCount: 1, totalCount: 8, percent: 12 },
      },
      'fallback name',
    );
    expect(withStamp.title).toContain('주문진 영진해변 방파제');

    const withFallback = buildBoastShareData(baseResult, 'fallback name');
    expect(withFallback.title).toContain('fallback name');

    const noFallback = buildBoastShareData(baseResult);
    expect(noFallback.title).toContain('성지');
  });

  it('url points to /shot/:id', () => {
    const data = buildBoastShareData(baseResult);
    expect(data.url).toMatch(/\/shot\/99$/);
  });
});

describe('buildPlaceShareData', () => {
  it('builds card with first cover image and /place/:id url', () => {
    const data = buildPlaceShareData({
      id: 12,
      name: '단밤 포차',
      regionLabel: '서울 용산구 이태원동',
      workTitle: '이태원 클라쓰',
      coverImageUrls: ['https://img/p12-1.jpg', 'https://img/p12-2.jpg'],
    });
    expect(data.title).toBe('단밤 포차');
    expect(data.description).toBe('이태원 클라쓰 · 서울 용산구 이태원동');
    expect(data.imageUrl).toBe('https://img/p12-1.jpg');
    expect(data.url).toMatch(/\/place\/12$/);
  });

  it('imageUrl is empty string when coverImageUrls is empty', () => {
    const data = buildPlaceShareData({
      id: 13,
      name: 'X',
      regionLabel: 'Y',
      workTitle: 'Z',
      coverImageUrls: [],
    });
    expect(data.imageUrl).toBe('');
  });
});
