# MISSION 부동산 CRM 대시보드

Track 2 Mission — `units` / `customers` / `contracts` / `consultations` / `ad_spend` 5개의 지저분한 합성 데이터를 정제·조인하여 Supabase(PostgreSQL)에 적재하고, 이를 실시간으로 조회하는 정적 대시보드입니다.

## 데이터 파이프라인

1. 원본 CSV/엑셀 5종을 정제(중복 제거, 이상치 플래그, 고아 FK 처리)
2. `units` 기준으로 조인한 통합 뷰 생성
3. Supabase `MISSION` 프로젝트의 `public` 스키마에 적재 (units 220 / customers 600 / contracts 350 / consultations 2,500 / ad_spend 144)
4. 집계 뷰 5종(`v_units_master`, `v_contracts_detail`, `v_consultations_detail`, `v_channel_funnel`, `v_monthly_ads`) 생성, RLS 읽기 전용 공개 정책 적용
5. 이 리포지토리의 정적 페이지가 Supabase REST API(anon key)로 뷰/테이블을 직접 조회해 렌더링

## 대시보드 구성

- **KPI**: 전체 매물, 누적 상담, 완료 계약, 전환율, 누적 광고비, 평균 CPL
- **차트 6종**: 채널별 상담 퍼널, 매물상태 정합성, 월별 리드 추이, 월별 CPL, 평형별 판매율, 리드소스별 전환율
- **인사이트 5개**: 각각 `발견 → 근거 데이터 → 제안 액션` 3단 구조로 정리
- **데이터 품질 참고사항**: 고객 중복 제거, 상담 고아 참조, 이상치 플래그 등 원본 데이터의 한계를 그대로 노출

## 기술 스택

순수 정적 HTML/CSS/JS (빌드 단계 없음) + [Chart.js](https://www.chartjs.org/)(CDN) + Supabase REST API. 별도 프레임워크나 백엔드 서버 없이 Vercel에 그대로 배포됩니다.

```
.
├── index.html      # 마크업 + KPI/차트/인사이트 슬롯
├── css/style.css   # 디자인 토큰(라이트/다크) 및 레이아웃
├── js/app.js       # Supabase fetch, 집계 계산, Chart.js 렌더링
└── vercel.json     # 정적 사이트 배포 설정
```

## 로컬 실행

빌드가 필요 없으므로 아무 정적 서버로 열면 됩니다.

```bash
npx serve .
# 또는
python3 -m http.server 8080
```

## 배포

GitHub 리포지토리를 Vercel 프로젝트와 연동하여, `main` 브랜치에 push할 때마다 자동으로 배포됩니다.
