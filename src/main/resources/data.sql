-- Idempotent seed data for Home / Map / PlaceDetail screens.
-- INSERT IGNORE + explicit IDs so re-running is a no-op; trailing UPDATEs keep
-- columns added in later migrations in sync with existing rows in dev DBs.

INSERT IGNORE INTO work (id, title, poster_url, type, CREATE_DATE, UPDATE_DATE) VALUES
  (1, '도깨비', NULL, 'DRAMA', NOW(), NOW()),
  (2, '이태원 클라쓰', NULL, 'DRAMA', NOW(), NOW()),
  (3, '호텔 델루나', NULL, 'DRAMA', NOW(), NOW()),
  (4, '미스터션샤인', NULL, 'DRAMA', NOW(), NOW());

INSERT IGNORE INTO place (id, name, region_label, latitude, longitude, cover_image_url, work_id, trending_score, photo_count, like_count, rating, CREATE_DATE, UPDATE_DATE) VALUES
  (10, '주문진 영진해변 방파제', '강릉시 주문진읍', 37.8928, 128.8347,
   'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
   1, 98, 1204, 3200, 4.8, NOW(), NOW()),
  (11, '논산 선샤인 스튜디오', '충남 논산시 연무읍', 36.1349, 127.0983,
   'https://images.unsplash.com/photo-1546874177-9e664107314e?auto=format&fit=crop&w=600&q=80',
   4, 92, 870, 2100, 4.6, NOW(), NOW()),
  (12, '청하공진시장', '경북 포항시 청하면', 36.1943, 129.3567,
   'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=600&q=80',
   3, 84, 542, 1650, 4.5, NOW(), NOW()),
  (13, '단밤 포차 (서울밤)', '서울 용산구 이태원동', 37.5347, 126.9947,
   'https://images.unsplash.com/photo-1554797589-7241bb691973?auto=format&fit=crop&w=600&q=80',
   2, 90, 1980, 4100, 4.7, NOW(), NOW()),
  (14, '덕수궁 돌담길', '서울 중구 정동', 37.5658, 126.9751,
   'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
   1, 80, 820, 2400, 4.7, NOW(), NOW()),
  (15, '호텔 델루나 외경 촬영지', '경북 포항시 호미곶면', 36.0760, 129.5666,
   'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=600&q=80',
   3, 75, 410, 1210, 4.4, NOW(), NOW()),
  (16, '이태원 녹사평 거리', '서울 용산구 이태원동', 37.5345, 126.9881,
   'https://images.unsplash.com/photo-1554797589-7241bb691973?auto=format&fit=crop&w=600&q=80',
   2, 70, 720, 1880, 4.5, NOW(), NOW()),
  (17, '합천 영상테마파크', '경남 합천군 용주면', 35.5668, 128.1668,
   'https://images.unsplash.com/photo-1546874177-9e664107314e?auto=format&fit=crop&w=600&q=80',
   4, 65, 390, 1040, 4.3, NOW(), NOW());

-- Backfill stats for rows seeded before these columns existed (dev DBs only).
UPDATE place SET photo_count = 1204, like_count = 3200, rating = 4.8 WHERE id = 10;
UPDATE place SET photo_count =  870, like_count = 2100, rating = 4.6 WHERE id = 11;
UPDATE place SET photo_count =  542, like_count = 1650, rating = 4.5 WHERE id = 12;
UPDATE place SET photo_count = 1980, like_count = 4100, rating = 4.7 WHERE id = 13;
UPDATE place SET photo_count =  820, like_count = 2400, rating = 4.7 WHERE id = 14;
UPDATE place SET photo_count =  410, like_count = 1210, rating = 4.4 WHERE id = 15;
UPDATE place SET photo_count =  720, like_count = 1880, rating = 4.5 WHERE id = 16;
UPDATE place SET photo_count =  390, like_count = 1040, rating = 4.3 WHERE id = 17;

-- PlaceDetail 화면용 신규 컬럼 백필. 에피소드/타임스탬프/장면 썸네일/본문/주변 맛집/추천 시간/리뷰수.
UPDATE place SET work_episode = '1회', scene_timestamp = '00:15:24',
  scene_image_url = 'https://images.unsplash.com/photo-1502514276747-de8d3fc3a2cb?auto=format&fit=crop&w=800&q=80',
  scene_description = '공유가 처음 지은탁을 만나던 그 방파제. 빨간 목도리가 바람에 흩날리던 장면입니다.',
  nearby_restaurant_count = 8, recommended_time_label = '골든아워', review_count = 1204
  WHERE id = 10;
UPDATE place SET work_episode = '3회', scene_timestamp = '00:42:11',
  scene_image_url = 'https://images.unsplash.com/photo-1503264116251-35a269479413?auto=format&fit=crop&w=800&q=80',
  scene_description = '미스터션샤인의 저잣거리 세트. 애신과 유진이 마주치던 장면이 바로 이곳입니다.',
  nearby_restaurant_count = 5, recommended_time_label = '오전', review_count = 870
  WHERE id = 11;
UPDATE place SET work_episode = '2회', scene_timestamp = '00:08:47',
  scene_image_url = 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=800&q=80',
  scene_description = '델루나 호텔의 평행세계, 청하공진시장. 장만월이 손님을 맞던 그 입구 장면.',
  nearby_restaurant_count = 6, recommended_time_label = '저녁', review_count = 542
  WHERE id = 12;
UPDATE place SET work_episode = '4회', scene_timestamp = '00:23:55',
  scene_image_url = 'https://images.unsplash.com/photo-1528702748617-c64d49f918af?auto=format&fit=crop&w=800&q=80',
  scene_description = '단밤 포차 오픈 첫 날. 박새로이가 간판을 올리던 감격의 장면.',
  nearby_restaurant_count = 12, recommended_time_label = '밤', review_count = 1980
  WHERE id = 13;
UPDATE place SET work_episode = '5회', scene_timestamp = '00:31:02',
  scene_image_url = 'https://images.unsplash.com/photo-1502635385003-ee1e6a1a742d?auto=format&fit=crop&w=800&q=80',
  scene_description = '도깨비와 저승사자가 나란히 걷던 그 돌담길. 붉은 단풍이 흩날리던 가을 장면.',
  nearby_restaurant_count = 9, recommended_time_label = '오후', review_count = 820
  WHERE id = 14;
UPDATE place SET work_episode = '6회', scene_timestamp = '00:19:30',
  scene_image_url = 'https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=800&q=80',
  scene_description = '호텔 델루나의 외경 촬영지. 안개 낀 바닷가에서 만월이 추억하던 장면.',
  nearby_restaurant_count = 3, recommended_time_label = '새벽', review_count = 410
  WHERE id = 15;
UPDATE place SET work_episode = '8회', scene_timestamp = '00:55:18',
  scene_image_url = 'https://images.unsplash.com/photo-1518544801976-3e188ea7cce5?auto=format&fit=crop&w=800&q=80',
  scene_description = '녹사평역에서 단밤 식구들이 모두 모이던 엔딩 장면.',
  nearby_restaurant_count = 15, recommended_time_label = '밤', review_count = 720
  WHERE id = 16;
UPDATE place SET work_episode = '10회', scene_timestamp = '01:02:44',
  scene_image_url = 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
  scene_description = '합천 영상테마파크. 개화기 거리 풍경 속에서 촬영된 주요 장면.',
  nearby_restaurant_count = 4, recommended_time_label = '오전', review_count = 390
  WHERE id = 17;

-- place_photo.user_id 가 FK + NOT NULL 이므로 place_photo INSERT 전에 users 1~5 를 먼저 준비.
-- 하단 148/160 라인의 상세 users INSERT 는 INSERT IGNORE 로 중복 skip 되므로 중복 없이 idempotent.
INSERT IGNORE INTO users (id, nickname, handle, level, points, streak_days, followers_count, following_count, total_photo_count, provider, verified, CREATE_DATE, UPDATE_DATE) VALUES
  (1, '김미루', '@miru',    5, 350, 7, 1200, 234, 186, 'DEMO', true,  NOW(), NOW()),
  (2, '이서준', '@seojun',  4, 280, 3,  820, 180,  92, 'DEMO', true,  NOW(), NOW()),
  (3, '박하늘', '@haneul',  3, 180, 2,  430,  95,  54, 'DEMO', false, NOW(), NOW()),
  (4, '최도윤', '@doyoon',  5, 420, 5, 1500, 210, 120, 'DEMO', true,  NOW(), NOW()),
  (5, '김지안', '@jian',    2,  90, 1,  210,  60,  18, 'DEMO', false, NOW(), NOW());

-- user_id 는 INSERT 시점에 바로 채워준다 — PlacePhoto 엔티티가 `user_id NOT NULL` 이라
-- NULL 로 먼저 넣고 나중에 UPDATE 하는 패턴은 INSERT 자체에서 실패한다. 값은 하단 UPDATE 들과 일치.
INSERT IGNORE INTO place_photo (id, place_id, image_url, author_nickname, order_index, user_id, CREATE_DATE, UPDATE_DATE) VALUES
  (100, 10, 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80', '영진파도', 0, 1, NOW(), NOW()),
  (101, 10, 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=600&q=80', '주문진러버', 1, 2, NOW(), NOW()),
  (102, 10, 'https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=600&q=80', '바다봄', 2, 3, NOW(), NOW()),
  (103, 10, 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=600&q=80', '도깨비덕후', 3, 4, NOW(), NOW()),
  (104, 10, 'https://images.unsplash.com/photo-1502514276747-de8d3fc3a2cb?auto=format&fit=crop&w=600&q=80', '강릉여행러', 4, 5, NOW(), NOW()),
  (105, 10, 'https://images.unsplash.com/photo-1496483648148-47c686dc86a8?auto=format&fit=crop&w=600&q=80', '파도타기', 5, 1, NOW(), NOW()),
  (110, 11, 'https://images.unsplash.com/photo-1546874177-9e664107314e?auto=format&fit=crop&w=600&q=80', '개화기러버', 0, 2, NOW(), NOW()),
  (111, 11, 'https://images.unsplash.com/photo-1518544801976-3e188ea7cce5?auto=format&fit=crop&w=600&q=80', '논산여행', 1, 3, NOW(), NOW()),
  (112, 11, 'https://images.unsplash.com/photo-1528702748617-c64d49f918af?auto=format&fit=crop&w=600&q=80', '선샤인팬', 2, 4, NOW(), NOW()),
  (113, 11, 'https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=600&q=80', '애신낭자', 3, 1, NOW(), NOW()),
  (114, 11, 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=600&q=80', '유진초이', 4, 5, NOW(), NOW()),
  (115, 11, 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=600&q=80', '연무대', 5, 2, NOW(), NOW()),
  (120, 12, 'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=600&q=80', '청하마실', 0, 3, NOW(), NOW()),
  (121, 12, 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=600&q=80', '포항러', 1, 4, NOW(), NOW()),
  (122, 12, 'https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=600&q=80', '델루나팬', 2, 1, NOW(), NOW()),
  (123, 12, 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=600&q=80', '시장탐방', 3, 2, NOW(), NOW()),
  (124, 12, 'https://images.unsplash.com/photo-1502514276747-de8d3fc3a2cb?auto=format&fit=crop&w=600&q=80', '만월언니', 4, 5, NOW(), NOW()),
  (125, 12, 'https://images.unsplash.com/photo-1496483648148-47c686dc86a8?auto=format&fit=crop&w=600&q=80', '저승사자', 5, 3, NOW(), NOW()),
  (130, 13, 'https://images.unsplash.com/photo-1554797589-7241bb691973?auto=format&fit=crop&w=600&q=80', '이태원덕후', 0, 4, NOW(), NOW()),
  (131, 13, 'https://images.unsplash.com/photo-1528702748617-c64d49f918af?auto=format&fit=crop&w=600&q=80', '단밤단골', 1, 1, NOW(), NOW()),
  (132, 13, 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=600&q=80', '박새로이', 2, 2, NOW(), NOW()),
  (133, 13, 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=600&q=80', '조이서', 3, 3, NOW(), NOW()),
  (134, 13, 'https://images.unsplash.com/photo-1496483648148-47c686dc86a8?auto=format&fit=crop&w=600&q=80', '포차러버', 4, 5, NOW(), NOW()),
  (135, 13, 'https://images.unsplash.com/photo-1518544801976-3e188ea7cce5?auto=format&fit=crop&w=600&q=80', '서울밤', 5, 4, NOW(), NOW()),
  (140, 14, 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80', '덕수궁산책', 0, 1, NOW(), NOW()),
  (141, 14, 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=600&q=80', '돌담길', 1, 2, NOW(), NOW()),
  (142, 14, 'https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=600&q=80', '도깨비팬', 2, 3, NOW(), NOW()),
  (143, 14, 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=600&q=80', '가을단풍', 3, 4, NOW(), NOW()),
  (144, 14, 'https://images.unsplash.com/photo-1502514276747-de8d3fc3a2cb?auto=format&fit=crop&w=600&q=80', '정동걷기', 4, 5, NOW(), NOW()),
  (145, 14, 'https://images.unsplash.com/photo-1496483648148-47c686dc86a8?auto=format&fit=crop&w=600&q=80', '공유님', 5, 1, NOW(), NOW()),
  (150, 15, 'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=600&q=80', '호미곶', 0, 2, NOW(), NOW()),
  (151, 15, 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=600&q=80', '바다호텔', 1, 3, NOW(), NOW()),
  (152, 15, 'https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=600&q=80', '만월씨', 2, 4, NOW(), NOW()),
  (153, 15, 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=600&q=80', '델루나외경', 3, 1, NOW(), NOW()),
  (154, 15, 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=600&q=80', '새벽안개', 4, 5, NOW(), NOW()),
  (155, 15, 'https://images.unsplash.com/photo-1496483648148-47c686dc86a8?auto=format&fit=crop&w=600&q=80', '평행세계', 5, 2, NOW(), NOW()),
  (160, 16, 'https://images.unsplash.com/photo-1554797589-7241bb691973?auto=format&fit=crop&w=600&q=80', '녹사평', 0, 3, NOW(), NOW()),
  (161, 16, 'https://images.unsplash.com/photo-1528702748617-c64d49f918af?auto=format&fit=crop&w=600&q=80', '이태원걷기', 1, 4, NOW(), NOW()),
  (162, 16, 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=600&q=80', '용산구', 2, 1, NOW(), NOW()),
  (163, 16, 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=600&q=80', '밤거리', 3, 2, NOW(), NOW()),
  (164, 16, 'https://images.unsplash.com/photo-1496483648148-47c686dc86a8?auto=format&fit=crop&w=600&q=80', '단밤식구', 4, 5, NOW(), NOW()),
  (165, 16, 'https://images.unsplash.com/photo-1518544801976-3e188ea7cce5?auto=format&fit=crop&w=600&q=80', '엔딩씬', 5, 3, NOW(), NOW()),
  (170, 17, 'https://images.unsplash.com/photo-1546874177-9e664107314e?auto=format&fit=crop&w=600&q=80', '합천여행', 0, 4, NOW(), NOW()),
  (171, 17, 'https://images.unsplash.com/photo-1518544801976-3e188ea7cce5?auto=format&fit=crop&w=600&q=80', '테마파크', 1, 1, NOW(), NOW()),
  (172, 17, 'https://images.unsplash.com/photo-1528702748617-c64d49f918af?auto=format&fit=crop&w=600&q=80', '개화기거리', 2, 2, NOW(), NOW()),
  (173, 17, 'https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=600&q=80', '용주면', 3, 3, NOW(), NOW()),
  (174, 17, 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=600&q=80', '영상촬영', 4, 5, NOW(), NOW()),
  (175, 17, 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=600&q=80', '경남합천', 5, 4, NOW(), NOW());

-- 업로드 API 도입(#15) 시 추가된 visibility 컬럼 백필. 기존 시드 행은 모두 공개 가시성.
UPDATE place_photo SET visibility = 'PUBLIC' WHERE visibility IS NULL;

-- 프로필/스탬프북/배지 도메인(#19) 데모 유저 시드. 실제 OAuth 연결 전까지 CurrentUser bean이 id=1을 주체로 사용.
INSERT IGNORE INTO users (id, nickname, handle, avatar_url, bio, level, points, streak_days, followers_count, following_count, total_photo_count, CREATE_DATE, UPDATE_DATE) VALUES
  (1, '김미루', '@miru',
   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
   '전국 성지 다 털어보는 중', 5, 350, 7, 1200, 234, 186, NOW(), NOW());
UPDATE users SET level = 5, points = 350, streak_days = 7, followers_count = 1200, following_count = 234, total_photo_count = 186 WHERE id = 1;

-- OAuth 도입(#33) 전까지 데모 유저는 provider=DEMO로 유지. 실 Google 유저는 로그인 시 자동 INSERT.
UPDATE users SET provider = 'DEMO', provider_id = NULL, email = NULL WHERE id = 1;

-- 피드(#42) 데모 유저 추가 + 기존 유저 verified 승격.
UPDATE users SET verified = true WHERE id = 1;

INSERT IGNORE INTO users (id, nickname, handle, avatar_url, bio, level, points, streak_days, followers_count, following_count, total_photo_count, provider, provider_id, email, verified, CREATE_DATE, UPDATE_DATE) VALUES
  (2, '이서준', '@seojun',
   'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
   '드라마 촬영지 수집가', 4, 280, 3, 820, 180, 92, 'DEMO', NULL, NULL, true, NOW(), NOW()),
  (3, '박하늘', '@haneul',
   'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=300&q=80',
   '주말마다 성지순례', 3, 180, 2, 430, 95, 54, 'DEMO', NULL, NULL, false, NOW(), NOW()),
  (4, '최도윤', '@doyoon',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
   '사진 찍는 여행자', 5, 420, 5, 1500, 210, 120, 'DEMO', NULL, NULL, true, NOW(), NOW()),
  (5, '김지안', '@jian',
   'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
   '드라마 덕후', 2, 90, 1, 210, 60, 18, 'DEMO', NULL, NULL, false, NOW(), NOW());

-- place_photo.user_id 순환 배치 + like_count 분산 시드. POPULAR 정렬이 likeCount 내림차순이라 의미 있는 편차 필요.
UPDATE place_photo SET user_id = 1, like_count = 128 WHERE id = 100;
UPDATE place_photo SET user_id = 2, like_count = 84 WHERE id = 101;
UPDATE place_photo SET user_id = 3, like_count = 61 WHERE id = 102;
UPDATE place_photo SET user_id = 4, like_count = 40 WHERE id = 103;
UPDATE place_photo SET user_id = 5, like_count = 22 WHERE id = 104;
UPDATE place_photo SET user_id = 1, like_count = 17 WHERE id = 105;
UPDATE place_photo SET user_id = 2, like_count = 95 WHERE id = 110;
UPDATE place_photo SET user_id = 3, like_count = 70 WHERE id = 111;
UPDATE place_photo SET user_id = 4, like_count = 48 WHERE id = 112;
UPDATE place_photo SET user_id = 1, like_count = 33 WHERE id = 113;
UPDATE place_photo SET user_id = 5, like_count = 21 WHERE id = 114;
UPDATE place_photo SET user_id = 2, like_count = 12 WHERE id = 115;
UPDATE place_photo SET user_id = 3, like_count = 88 WHERE id = 120;
UPDATE place_photo SET user_id = 4, like_count = 67 WHERE id = 121;
UPDATE place_photo SET user_id = 1, like_count = 45 WHERE id = 122;
UPDATE place_photo SET user_id = 2, like_count = 30 WHERE id = 123;
UPDATE place_photo SET user_id = 5, like_count = 18 WHERE id = 124;
UPDATE place_photo SET user_id = 3, like_count = 10 WHERE id = 125;
UPDATE place_photo SET user_id = 4, like_count = 110 WHERE id = 130;
UPDATE place_photo SET user_id = 1, like_count = 82 WHERE id = 131;
UPDATE place_photo SET user_id = 2, like_count = 63 WHERE id = 132;
UPDATE place_photo SET user_id = 3, like_count = 44 WHERE id = 133;
UPDATE place_photo SET user_id = 5, like_count = 26 WHERE id = 134;
UPDATE place_photo SET user_id = 4, like_count = 15 WHERE id = 135;
UPDATE place_photo SET user_id = 1, like_count = 102 WHERE id = 140;
UPDATE place_photo SET user_id = 2, like_count = 76 WHERE id = 141;
UPDATE place_photo SET user_id = 3, like_count = 55 WHERE id = 142;
UPDATE place_photo SET user_id = 4, like_count = 38 WHERE id = 143;
UPDATE place_photo SET user_id = 5, like_count = 20 WHERE id = 144;
UPDATE place_photo SET user_id = 1, like_count = 14 WHERE id = 145;
UPDATE place_photo SET user_id = 2, like_count = 71 WHERE id = 150;
UPDATE place_photo SET user_id = 3, like_count = 52 WHERE id = 151;
UPDATE place_photo SET user_id = 4, like_count = 36 WHERE id = 152;
UPDATE place_photo SET user_id = 1, like_count = 24 WHERE id = 153;
UPDATE place_photo SET user_id = 5, like_count = 13 WHERE id = 154;
UPDATE place_photo SET user_id = 2, like_count = 9 WHERE id = 155;
UPDATE place_photo SET user_id = 3, like_count = 99 WHERE id = 160;
UPDATE place_photo SET user_id = 4, like_count = 73 WHERE id = 161;
UPDATE place_photo SET user_id = 1, like_count = 51 WHERE id = 162;
UPDATE place_photo SET user_id = 2, like_count = 35 WHERE id = 163;
UPDATE place_photo SET user_id = 5, like_count = 22 WHERE id = 164;
UPDATE place_photo SET user_id = 3, like_count = 16 WHERE id = 165;
UPDATE place_photo SET user_id = 4, like_count = 65 WHERE id = 170;
UPDATE place_photo SET user_id = 1, like_count = 49 WHERE id = 171;
UPDATE place_photo SET user_id = 2, like_count = 33 WHERE id = 172;
UPDATE place_photo SET user_id = 3, like_count = 24 WHERE id = 173;
UPDATE place_photo SET user_id = 5, like_count = 14 WHERE id = 174;
UPDATE place_photo SET user_id = 4, like_count = 8 WHERE id = 175;

-- 좋아요(#46) 시드. user=1이 일부 place/photo 좋아요.
INSERT IGNORE INTO place_like (id, user_id, place_id, CREATE_DATE, UPDATE_DATE) VALUES
  (1, 1, 10, NOW(), NOW()),
  (2, 1, 13, NOW(), NOW()),
  (3, 1, 14, NOW(), NOW()),
  (4, 1, 16, NOW(), NOW()),
  (5, 1, 17, NOW(), NOW());

INSERT IGNORE INTO photo_like (id, user_id, photo_id, CREATE_DATE, UPDATE_DATE) VALUES
  (1, 1, 100, NOW(), NOW()),
  (2, 1, 110, NOW(), NOW()),
  (3, 1, 130, NOW(), NOW()),
  (4, 1, 140, NOW(), NOW()),
  (5, 1, 150, NOW(), NOW()),
  (6, 1, 160, NOW(), NOW());

-- 댓글(#49) 시드. 여러 유저가 여러 photo에 댓글.
INSERT IGNORE INTO post_comment (id, user_id, photo_id, content, CREATE_DATE, UPDATE_DATE) VALUES
  (1, 2, 100, '이 각도 너무 예뻐요!', NOW(), NOW()),
  (2, 3, 100, '저도 꼭 가봐야겠네요', NOW(), NOW()),
  (3, 4, 100, '도깨비 생각나요', NOW(), NOW()),
  (4, 5, 110, '개화기 감성', NOW(), NOW()),
  (5, 1, 110, '저도 여기 가봤어요', NOW(), NOW()),
  (6, 2, 130, '단밤 포차!!', NOW(), NOW()),
  (7, 3, 130, '추억의 장소', NOW(), NOW()),
  (8, 4, 140, '덕수궁 돌담길 최고', NOW(), NOW()),
  (9, 5, 140, '가을에 가면 더 예쁠듯', NOW(), NOW()),
  (10, 1, 150, '델루나 외경 찐', NOW(), NOW()),
  (11, 2, 160, '이태원 밤 분위기 좋죠', NOW(), NOW()),
  (12, 3, 170, '합천 테마파크 재밌어요', NOW(), NOW());

-- comment_count 컬럼 보정 (기존 행은 0, 새 댓글 row 수와 맞춤).
UPDATE place_photo SET comment_count = 3 WHERE id = 100;
UPDATE place_photo SET comment_count = 2 WHERE id = 110;
UPDATE place_photo SET comment_count = 2 WHERE id = 130;
UPDATE place_photo SET comment_count = 2 WHERE id = 140;
UPDATE place_photo SET comment_count = 1 WHERE id = 150;
UPDATE place_photo SET comment_count = 1 WHERE id = 160;
UPDATE place_photo SET comment_count = 1 WHERE id = 170;

-- 팔로우(#56) 시드. user=1 follows 2,3,4 / user=2 follows 1,3 / user=3 follows 2,4 / user=4 follows 1,2 / user=5 follows 1
INSERT IGNORE INTO user_follow (id, follower_id, followee_id, CREATE_DATE, UPDATE_DATE) VALUES
  (1, 1, 2, NOW(), NOW()),
  (2, 1, 3, NOW(), NOW()),
  (3, 1, 4, NOW(), NOW()),
  (4, 2, 1, NOW(), NOW()),
  (5, 2, 3, NOW(), NOW()),
  (6, 3, 2, NOW(), NOW()),
  (7, 3, 4, NOW(), NOW()),
  (8, 4, 1, NOW(), NOW()),
  (9, 4, 2, NOW(), NOW()),
  (10, 5, 1, NOW(), NOW());

UPDATE users SET followers_count = 3, following_count = 3 WHERE id = 1;
UPDATE users SET followers_count = 3, following_count = 2 WHERE id = 2;
UPDATE users SET followers_count = 2, following_count = 2 WHERE id = 3;
UPDATE users SET followers_count = 2, following_count = 2 WHERE id = 4;
UPDATE users SET followers_count = 0, following_count = 1 WHERE id = 5;

INSERT IGNORE INTO badge (id, code, name, description, icon_key, gradient, order_index, condition_type, condition_threshold, condition_work_id, CREATE_DATE, UPDATE_DATE) VALUES
  (1, 'COASTAL_RUNNER', '바다 러너', '바다 성지 5곳 이상 방문', 'waves', 'sky-violet', 1, 'COASTAL_COUNT', 5, NULL, NOW(), NOW()),
  (2, 'STREAK_7', '연속 7일', '7일 연속 성지 방문', 'flame', 'amber-coral', 2, 'STREAK', 7, NULL, NOW(), NOW()),
  (3, 'EARLY_BIRD', '얼리버드', '이른 아침 방문 1회', 'sunrise', 'mint-sky', 3, 'EARLY_BIRD', 1, NULL, NOW(), NOW()),
  (4, 'NATIONAL_CONQUEROR', '전국 정복', '전국 17개 지역 모두 방문', 'map', 'indigo-violet', 4, 'REGION_COUNT', 17, NULL, NOW(), NOW()),
  (5, 'GRIM_REAPER', '저승사자', '도깨비 전 촬영지 완주', 'user-x', 'ink-violet', 5, 'WORK_COMPLETE', NULL, 1, NOW(), NOW()),
  (6, 'HUNDRED_PLACES', '100 성지', '누적 100개 성지 방문', 'trophy', 'amber-coral', 6, 'STAMP_COUNT', 100, NULL, NOW(), NOW());

INSERT IGNORE INTO user_badge (id, user_id, badge_id, acquired_at, CREATE_DATE, UPDATE_DATE) VALUES
  (1, 1, 1, NOW(), NOW(), NOW()),
  (2, 1, 2, NOW(), NOW(), NOW()),
  (3, 1, 3, NOW(), NOW(), NOW());

-- 데모 유저의 스탬프 12개: 도깨비(id=10,14) 2곳, 이태원클라쓰(13,16) 2곳, 델루나(12,15) 2곳, 미스터션샤인(11,17) 2곳 + 도깨비 보강용 더미 1개(11→10은 중복이라 패스, 다른 작품의 스탬프로 골고루).
-- 현재 시드 place 8개 전체 + 추가 없음 → 실제로는 8행. 테스트가 '>=10'을 기대할 수 있어 user.totalPhotoCount로 대신하므로 여기선 8개만.
INSERT IGNORE INTO stamp (id, user_id, place_id, photo_id, acquired_at, CREATE_DATE, UPDATE_DATE) VALUES
  (1, 1, 10, 100, NOW(), NOW(), NOW()),
  (2, 1, 14, 140, NOW(), NOW(), NOW()),
  (3, 1, 13, 130, NOW(), NOW(), NOW()),
  (4, 1, 16, 160, NOW(), NOW(), NOW()),
  (5, 1, 12, 120, NOW(), NOW(), NOW()),
  (6, 1, 15, 150, NOW(), NOW(), NOW()),
  (7, 1, 11, 110, NOW(), NOW(), NOW()),
  (8, 1, 17, 170, NOW(), NOW(), NOW());

-- 작품 확장(#23) 메타데이터 백필: synopsis/ratingAverage/yearStart/episodeCount/network/subtitle.
UPDATE work SET synopsis = '불멸의 도깨비와 그의 신부가 된 소녀의 이야기',
  rating_average = 9.2, year_start = 2016, episode_count = 16, network = 'tvN',
  subtitle = '쓸쓸하고 찬란하神' WHERE id = 1;
UPDATE work SET synopsis = '편견과 부조리에 맞서는 청춘의 단밤 창업기',
  rating_average = 8.6, year_start = 2020, episode_count = 16, network = 'JTBC',
  subtitle = '이태원의 밤' WHERE id = 2;
UPDATE work SET synopsis = '과거와 현재를 잇는 호텔 델루나의 판타지 로맨스',
  rating_average = 8.8, year_start = 2019, episode_count = 16, network = 'tvN',
  subtitle = '별이 머무는 호텔' WHERE id = 3;
UPDATE work SET synopsis = '개화기 조선, 의병이 된 청년들의 서사',
  rating_average = 9.5, year_start = 2018, episode_count = 24, network = 'tvN',
  subtitle = '선샤인' WHERE id = 4;

-- 컬렉션/저장 성지 시드(#23). 동일 user_id=1 기준.
INSERT IGNORE INTO saved_collection (id, user_id, name, description, cover_place_id, gradient, CREATE_DATE, UPDATE_DATE) VALUES
  (1, 1, '다음 여행 · 강릉', '이번 주말에 털 강릉 성지', 10, 'sky-violet', NOW(), NOW()),
  (2, 1, '도깨비 컴플리트', '도깨비 전 촬영지 완주', 14, 'amber-coral', NOW(), NOW()),
  (3, 1, '서울 야경 성지', '밤에 돌기 좋은 서울', 14, 'ink-violet', NOW(), NOW());

INSERT IGNORE INTO saved_place (id, user_id, place_id, collection_id, CREATE_DATE, UPDATE_DATE) VALUES
  (1, 1, 10, 1, NOW(), NOW()),
  (2, 1, 14, 2, NOW(), NOW()),
  (3, 1, 16, 3, NOW(), NOW()),
  (4, 1, 11, NULL, NOW(), NOW()),
  (5, 1, 13, NULL, NOW(), NOW()),
  (6, 1, 15, NULL, NOW(), NOW());
