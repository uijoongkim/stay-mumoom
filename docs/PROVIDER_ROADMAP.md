# 숙소 제공자 연동 로드맵

검토일: 2026-09-05 KST

## 판단 원칙

- 공식 API 또는 서면 제휴가 확인된 경우에만 숙소 데이터를 자동 수집한다.
- 공개 API가 없거나 권한 범위가 불명확하면 공식 사이트 링크만 제공한다.
- 플랫폼 로그인 비밀번호·쿠키·세션을 수집하거나 재사용하지 않는다.
- 가격·재고·평점·후기·사진은 공급자가 명시적으로 제공하고 표시 권한이 확인된 경우에만 사용한다.

## 우선순위

| 우선순위 | 제공자 | 현재 모드 | 필요한 인증/계약 | 기대 데이터 | 결정 |
|---|---|---|---|---|---|
| P0 | NAVER API HUB 지역 검색 | 공식 API 구현 완료 | Client ID/Secret | 업체명, 주소, 좌표, 분류, 원문 링크 | 6회 호출·30건 상한·10분 캐시 유지. 별점은 제공되지 않음.[1] |
| P1 | 한국관광공사 TourAPI 4.0 | 다음 구현 후보 | 공공데이터포털 활용 신청 및 Service Key | 국내 관광·숙박 콘텐츠 | 공공 데이터 범위와 라이선스를 확인한 뒤 별도 어댑터 구현.[2] |
| P1 | ONDA Channel API | 제휴 문의 | 제휴 계약 후 API 키 | 국내 숙소 검색, 가격·재고, 예약 | 국내 숙소 커버리지 확장에 적합. 계약 전 데이터 호출 금지.[3] |
| P2 | Booking.com Demand API | 공식 링크만 | Affiliate ID + API key token | 숙소 콘텐츠, 검색, 가용성, 주문 또는 Booking.com 리디렉션 | affiliate 승인을 받은 뒤 `search, look and redirect` 흐름 검토.[4][5] |
| P2 | Agoda Demand API | 공식 링크만 | 파트너 등록, site credentials, 인증 및 live 전환 | 콘텐츠, 검색, 가격·가용 객실 | 비교 서비스용 Online Affiliates/MSE 모델을 파트너 담당자에게 신청.[6] |
| P2 | Expedia Rapid API | 공식 링크만 | 파트너 신청·사례별 심사 | 숙소 쇼핑부터 예약까지 모듈형 API | PoC 트래픽과 사업 모델이 생긴 뒤 파트너 신청.[7] |
| P2 | Airbnb | 공식 공주 검색 링크 | API 프로그램/파트너 서면 승인 | 승인 scope에 따른 콘텐츠 | 승인 전 비공식 API·DOM 크롤링·로그인 세션 사용 금지.[8] |
| P3 | 여기어때 | 공식 홈페이지 링크 | 공개 개발자 API 문서 미확인, 사업 제휴 문의 필요 | 미확정 | 링크만 제공. DOM/앱 API 역공학 금지. |
| P3 | 야놀자 | 공식 홈페이지 링크 | 공개 소비자 숙소 API 문서 미확인, 사업 제휴 문의 필요 | 미확정 | 링크만 제공. DOM/앱 API 역공학 금지. |
| P3 | 트립닷컴·마이리얼트립 | 공식 홈페이지 링크 | 각사 affiliate/제휴 확인 필요 | 미확정 | 계약 전 공식 사이트 링크만 제공. |

## 사용자가 준비해야 할 인증

### 지금 사용 가능

- NAVER API HUB `NAVER_API_HUB_CLIENT_ID`
- NAVER API HUB `NAVER_API_HUB_CLIENT_SECRET`

두 값은 서버의 `.env`에만 저장하며 Git, 브라우저 번들, 채팅, 로그에 넣지 않는다.

### 다음 단계에서 필요

1. **TourAPI Service Key**: 공공데이터포털에서 한국관광공사 국문 관광정보 서비스 활용 신청.
2. **ONDA 파트너 키**: Channel API 사용 목적과 예상 트래픽을 포함해 제휴 문의.
3. **Booking.com affiliate credentials**: Affiliate ID와 API key token.
4. **Agoda site credentials**: Online Affiliates/MSE 모델 파트너 승인과 인증 절차.
5. **Expedia Rapid credentials**: 파트너 신청과 사례별 심사.
6. **Airbnb partner scope**: 숙소 검색·콘텐츠 표시에 대한 서면 승인.

플랫폼 계정의 일반 사용자 로그인은 위 API 자격 증명을 대신하지 않는다.

## 로그인 설계 원칙

`connections.html`의 로그인은 현재 인터페이스 placeholder다. 이후에는 서비스 자체 계정(예: Kakao/Google OIDC)과 공급자 연결을 분리한다.

- 서비스 로그인: 찜·여행 프로필·동행 목적 동기화
- 공급자 OAuth/API 연결: 공급자가 공식적으로 지원할 때만 별도 동의 화면 제공
- 일반 플랫폼 비밀번호 입력: 제공하지 않음
- 예약·결제: 원 플랫폼에서 완료
- 토큰: 서버 암호화 저장, 최소 scope, 연결 해제 시 폐기

## Sources

[1] https://api.ncloud-docs.com/docs/naver-api-hub-search-local — NAVER API HUB 지역 검색
[2] https://www.data.go.kr/data/15101578/openapi.do — 한국관광공사 국문 관광정보 서비스
[3] https://developers.onda.me/ — ONDA Partner Developer Center
[4] https://developers.booking.com/demand/docs/getting-started/overview — Booking.com Demand API 개요
[5] https://developers.booking.com/demand/docs/development-guide/authentication — Booking.com 인증·인가
[6] https://developer.agoda.com/demand/docs/getting-started — Agoda Demand API 시작하기
[7] https://partner.expediagroup.com/en-us/join-us/rapid-api — Expedia Rapid API 파트너 신청
[8] https://www.airbnb.co.kr/help/article/3418 — Airbnb API 이용 약관
