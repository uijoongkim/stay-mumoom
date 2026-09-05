# 머무름 (Stay Curator) PoC

여기어때·야놀자·에어비앤비·네이버·개인 호스팅처럼 서로 다른 숙소 출처를 공통 형식으로 정리하고, 여행 목적과 조건에 맞춰 제안하는 프론트엔드 PoC입니다.

현재 버전은 기본 샘플 데이터와 함께 **NAVER API HUB 공식 지역 검색**으로 공주 숙소 후보를 가져올 수 있습니다. 에어비앤비는 파트너 승인 전까지 공식 공주 검색 링크만 제공하며, 사진은 저작권 문제를 피하기 위해 자체 제작 SVG 일러스트를 사용합니다.

## 실행

### 요구 환경

- Node.js 20 이상
- 별도 패키지 설치 불필요

```bash
cd /Users/kimuijoong/Desktop/JJOONGS/AI/agent/develop/stay-mumoom
npm start
```

브라우저에서 <http://127.0.0.1:4173>을 엽니다.

네이버 실데이터를 사용하려면 `.env.example`을 `.env`로 복사하고 NAVER API HUB 키를 입력한 뒤 실행합니다.

```bash
npm run start:live
```

키 발급과 설정은 `docs/PROVIDER_INTEGRATION.md`를 따릅니다. 실제 Secret은 저장소나 채팅에 넣지 마세요.
정적 서버는 `.env`, `.env.example`, `.git` 등 dotfile 요청을 403으로 차단합니다.

포트를 바꾸려면:

```bash
PORT=5000 npm start
```

## 검증

```bash
npm test
npm run check
```

- `npm test`: 정규화, 복합 필터, 편의시설 AND 조건, 거리, 목적별 추천, 불변성 단위 테스트
- `npm run check`: JavaScript 문법 검사

## 구현 기능

- 5개 숙박 출처를 가정한 필드 정규화
- 메인 여행 목적 선택, 조건 비교 탐색, 공급자 연결 관리의 3개 화면
- NAVER API HUB 서버 측 인증, 공주 관련 핵심 검색어 6개, 최대 30건, 지역·업종 검증, 중복 제거, 단일-flight 10분 캐시
- 에어비앤비 공주 공식 검색 외부 링크와 파트너 승인 대기 상태 표시
- 커플/가족/친구 목적별 설명 가능한 추천
- 지역/숙소명, 가격, 욕실, 인원, 6개 편의시설 복합 필터
- 추천/가격/거리 정렬
- 브라우저 위치 사용(사용자가 버튼을 누른 경우에만)
- 찜 목록의 localStorage 유지
- 상세 모달, 갱신 시각, 외부 원문 링크 안내
- 조건 불일치 시 빈 결과와 초기화 경로
- 키보드 포커스, 스킵 링크, 반응형 레이아웃

## 구조

```text
stay-mumoom/
├── assets/                 # 직접 제작한 숙소 SVG 일러스트
├── docs/
│   ├── REQUIREMENTS.md     # 요구사항, 범위, 정책/법률 리스크
│   ├── PROVIDER_INTEGRATION.md # 네이버 인증과 에어비앤비 정책
│   ├── PROVIDER_ROADMAP.md # 추가 플랫폼 API·제휴·공식 링크 로드맵
│   ├── SKILL_SYSTEM.md     # 프로젝트 Skill 연동 및 토큰 예산
│   ├── TEST_REPORT.md      # 실행 기반 검증 결과
│   └── USER_MANUAL.md      # 사용자 매뉴얼
├── src/
│   ├── api.js              # API 서비스와 공개 오류 변환
│   ├── app.js              # 화면 상태와 이벤트
│   ├── connections.js      # 공급자 연결 상태 화면
│   ├── data.js             # 플랫폼별 원본 형태의 가상 데이터
│   ├── domain.js           # 정규화, 필터, 거리, 추천 로직
│   ├── journey.js          # 여행 목적 URL과 연결 상태 표현
│   ├── provider-cache.js   # 단일-flight TTL 캐시와 target 투영
│   ├── providers.js        # 네이버 어댑터와 에어비앤비 링크
│   └── static-files.js     # 정적 자산 경로와 dotfile 차단
├── test/                   # Node 내장 단위 테스트
├── index.html              # 메인 여행 목적 선택
├── explore.html            # 숙소 조건 비교
├── connections.html        # 로그인/공급자 연결 준비
├── .env.example            # Secret 값 없는 환경변수 템플릿
├── styles.css
├── server.mjs
└── package.json
```

## 실제 플랫폼 연동 상태

- **네이버:** 공식 API HUB 인증 구현 완료. 키가 설정되면 업체명, 분류, 주소, 좌표와 원문 링크를 수집합니다.
- **에어비앤비:** 파트너 API 계약 전이므로 데이터 수집/OAuth/크롤링 없이 공식 검색 링크만 제공합니다.

상세한 인증 절차, 호출 제한과 정책 근거는 `docs/PROVIDER_INTEGRATION.md`에 있습니다.

## PoC 한계

- 네이버 지역 검색은 가격, 재고, 인원, 욕실, 편의시설, 평점과 사진을 제공하지 않습니다.
- 별점 필드가 없어 높은 별점 필터는 제공하지 않습니다. `sort=comment` 결과도 별점이라고 표시하지 않습니다.
- 최대 30개는 PoC 상한이며 6개 검색의 중복 제거 결과에 따라 실제 고유 업체 수가 더 적을 수 있습니다.
- 에어비앤비 숙소 데이터와 사진은 파트너 승인 전까지 수집하지 않습니다.
- 거리는 좌표 간 직선거리에 보정 계수 1.2를 적용한 예상치입니다.
- 샘플 카드의 데모 원문 링크는 `example.com`, 네이버 실데이터 카드는 업체 홈페이지 또는 네이버 검색으로 연결됩니다.
- 날짜별 재고, 세금, 청소비와 취소 정책은 미구현입니다.
