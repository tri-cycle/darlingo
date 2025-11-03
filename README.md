# 🚲 따릉이GO

서울 시민을 위한 스마트한 따릉이(공공자전거) + 대중교통 연계 경로 안내 서비스

## 📖 프로젝트 소개

따릉이GO는 서울시 공공자전거 "따릉이"와 대중교통을 효율적으로 연계하여 최적의 이동 경로를 제안하는 웹 애플리케이션입니다. 단순히 대중교통만 이용하는 것보다 따릉이를 활용하면 더 빠르고 건강한 이동이 가능합니다.

### ✨ 주요 기능

- **🗺️ 실시간 따릉이 정보**: 현재 위치 주변 대여소와 이용 가능한 자전거 수 표시
- **🚴 복합 경로 안내**: 따릉이 + 대중교통을 조합한 최적 경로 제공
- **📍 스마트 경로 탐색**: 출발지, 경유지, 도착지를 설정하여 맞춤형 경로 생성
- **⏱️ 다양한 옵션**: 자전거 이용 시간에 따른 여러 경로 옵션 제시
- **🎯 대여소 정보**: 경로 상의 대여소 위치와 자전거 현황 상세 표시
- **💾 검색 기록**: 최근 검색한 장소 자동 저장 (로컬 스토리지)

### 🎨 주요 특징

- **직관적인 UI**: 현대적이고 사용하기 쉬운 인터페이스
- **반응형 디자인**: 데스크톱과 모바일 모두 최적화
- **실시간 지도**: 네이버 지도 기반의 정확한 위치 정보
- **PWA 지원**: 앱처럼 설치하여 사용 가능
- **서울 전역 커버**: 약 2,600개의 따릉이 대여소 정보 제공

## 🛠️ 기술 스택

### Frontend
- **React 19** - UI 프레임워크
- **Vite** - 빌드 도구
- **Tailwind CSS 4** - 스타일링
- **Context API** - 상태 관리

### APIs & Services
- **네이버 지도 API** - 지도 표시 및 기본 경로
- **Google Places API** - 장소 검색 및 자동완성
- **Google Maps API** - 좌표 변환 및 지오코딩
- **ODsay API** - 대중교통 경로 안내
- **TMAP API** - 도보 경로 상세 안내
- **OpenRouteService API** - 자전거 경로 계산
- **서울시 공공데이터 API** - 따릉이 대여소 실시간 정보

### Deployment
- **Vercel** - 호스팅 및 서버리스 함수
- **PWA** - 프로그레시브 웹 앱

## 📦 설치 및 실행

### 1. 저장소 클론
```bash
git clone https://github.com/your-username/darlingo.git
cd darlingo
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
`.env` 파일을 생성하고 다음 API 키들을 설정하세요:

```env
# 네이버 지도
VITE_NAVER_KEY_ID=your_naver_client_id

# Google Maps
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
VITE_GOOGLE_KEY=your_google_maps_key

# ODsay (대중교통)
VITE_ODSAY_API_KEY=your_odsay_key

# 서울시 공공데이터
VITE_SEOUL_API_KEY=your_seoul_open_api_key

# OpenRouteService (자전거 경로)
VITE_ORS_API_KEY=your_ors_key

# TMAP (도보 경로)
VITE_TMAP_API_KEY=your_tmap_key
```

### 4. 개발 서버 실행
```bash
npm run dev
```

개발 서버가 `http://localhost:5173`에서 실행됩니다.

### 5. 프로덕션 빌드
```bash
npm run build
npm run preview
```

## 🗂️ 프로젝트 구조

```
darlingo/
├── api/                          # Vercel 서버리스 함수
│   └── getStations.js           # 따릉이 대여소 데이터 프록시
├── src/
│   ├── components/              # React 컴포넌트
│   │   ├── ClickableMap.jsx    # 지도 클릭 인터랙션
│   │   ├── DdarungiMarkers.jsx # 따릉이 대여소 마커
│   │   ├── IntegratedRoute.jsx # 통합 경로 표시
│   │   ├── LocationMarkers.jsx # 출발/도착지 마커
│   │   ├── MapLoader.jsx       # 지도 스크립트 로더
│   │   ├── MapView.jsx         # 지도 뷰 컴포넌트
│   │   ├── PlaceAutocomplete.jsx # 장소 자동완성
│   │   ├── RouteLine.jsx       # 경로 선 그리기
│   │   ├── RouteList.jsx       # 경로 목록
│   │   ├── RouteStationMarkers.jsx # 경로 상 대여소
│   │   ├── RouteSummary.jsx    # 경로 요약 정보
│   │   └── UserInputForm.jsx   # 사용자 입력 폼
│   ├── context/
│   │   └── RouteContext.jsx    # 경로 상태 관리
│   ├── hooks/
│   │   ├── useCurrentLocation.js # 현재 위치 훅
│   │   └── useMarkers.js       # 마커 관리 훅
│   ├── utils/                   # 유틸리티 함수
│   │   ├── routeCalculator/    # 경로 계산 로직
│   │   │   ├── createBikeFirst.js
│   │   │   ├── createBikeLast.js
│   │   │   ├── helpers.js
│   │   │   ├── prioritizeRoutes.js
│   │   │   └── processOdsayPath.js
│   │   ├── constants.js        # 상수 정의
│   │   ├── fetchAllStations.js # 대여소 데이터 로드
│   │   ├── fetchBikeRoute.js   # 자전거 경로 API
│   │   ├── fetchOdsayRoute.js  # 대중교통 경로 API
│   │   ├── fetchTmapRoute.js   # 도보 경로 API
│   │   ├── haversine.js        # 거리 계산
│   │   ├── loadGoogleMaps.js   # Google Maps 로더
│   │   ├── routeCalculator.js  # 경로 계산 메인
│   │   ├── routeColors.js      # 경로 색상 정의
│   │   └── splitBikeRoute.js   # 자전거 경로 분할
│   ├── App.jsx                  # 메인 앱 컴포넌트
│   ├── main.jsx                 # 엔트리 포인트
│   └── styles.css              # 전역 스타일
├── tests/                       # 테스트 파일
├── .env                         # 환경 변수
├── .gitignore
├── package.json
├── vite.config.js              # Vite 설정
└── README.md
```

## 🚀 주요 알고리즘

### 경로 계산 로직

1. **순수 대중교통 경로** (최대 2개)
   - ODsay API를 통한 기본 대중교통 경로

2. **자전거 + 대중교통 복합 경로**
   - Forward: 출발지 → 자전거 → 환승 → 대중교통 → 도착지
   - Backward: 출발지 → 대중교통 → 환승 → 자전거 → 도착지
   - 다양한 자전거 이용 시간대 (15분, 20분, 30분, 40분) 탐색

3. **순수 자전거 경로**
   - 전체 구간 자전거 이용 (장거리의 경우)

### 경로 우선순위

```javascript
복합 경로 (자전거 + 대중교통) > 순수 대중교통 > 순수 자전거
```

### 성능 최적화

- **캐싱**: API 호출 결과를 메모리에 캐싱하여 중복 호출 방지
- **Rate Limiting**: OpenRouteService API 호출 제한 (분당 40회)
- **병렬 처리**: 여러 경로 옵션을 동시에 계산
- **지연 로딩**: 지도 스크립트 동적 로드

## 🎯 사용 방법

### 1. 기본 경로 검색
1. 출발지와 도착지를 검색창에 입력
2. "길찾기 시작" 버튼 클릭
3. 여러 경로 옵션 중 선택

### 2. 경유지 추가
1. "+ 경유지 추가" 버튼 클릭 (최대 1개)
2. 경유지 입력 후 경로 검색

### 3. 지도 인터랙션
- **지도 클릭**: 해당 위치를 출발지/도착지로 설정 가능
- **대여소 클릭**: 대여소 상세 정보 (이용 가능 자전거 수) 확인
- **GPS 버튼**: 현재 위치로 이동 및 통계 초기화

### 4. 경로 정보 확인
- 총 소요 시간
- 구간별 이동 수단 (도보/자전거/지하철/버스)
- 각 구간의 거리 및 소요 시간
- 경로 상의 따릉이 대여소 위치

## 🔑 API 키 발급 방법

### 네이버 지도 API
1. [네이버 클라우드 플랫폼](https://www.ncloud.com/) 가입
2. AI·NAVER API → Application 등록
3. Client ID 발급

### Google Maps API
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 생성 → API 및 서비스 → 사용자 인증 정보
3. Places API, Maps JavaScript API 활성화
4. API 키 발급

### ODsay API
1. [ODsay Lab](https://lab.odsay.com/) 가입
2. API 키 신청 및 발급

### 서울시 공공데이터
1. [서울 열린데이터 광장](https://data.seoul.go.kr/) 가입
2. 따릉이 실시간 대여정보 API 신청

### OpenRouteService API
1. [OpenRouteService](https://openrouteservice.org/) 가입
2. 무료 API 키 발급

### TMAP API
1. [TMAP Open Platform](https://openapi.sk.com/) 가입
2. 보행자 경로안내 API 신청

## 🧪 테스트

```bash
# 전체 테스트 실행
npm test

# 특정 테스트 실행
npm test -- tests/routePrioritization.test.mjs
```

### 테스트 항목
- Rate limiting 동작 확인
- 지도 리사이즈 이벤트
- 경로 우선순위 정렬
- 사이드바 토글
- 경유지 포함 경로 계산

## 🚧 제한 사항

- **서울 지역 한정**: 서울시 공공자전거 시스템 기반
- **API 호출 제한**: 일부 API는 무료 할당량 존재
- **자전거 경로**: 실제 자전거 도로와 다를 수 있음
- **실시간 정보**: 대여소 정보는 주기적으로 업데이트되나 실시간 반영은 아님

## 📱 브라우저 지원

- Chrome (권장)
- Safari
- Firefox
- Edge

※ 위치 정보 권한 필요

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 개인 프로젝트이며, 사용된 API들의 라이선스를 따릅니다.

## 📞 문의

프로젝트 관련 문의나 버그 리포트는 GitHub Issues를 이용해주세요.
