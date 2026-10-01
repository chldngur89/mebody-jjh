# 검증 스위트 돌리는 법

`npm run verify:*` 는 39개입니다. 한 번에 다 돌릴 수 없습니다. **서버 설정이 서로 다른 두 묶음**이
섞여 있기 때문입니다. 이걸 모르면 "어제는 다 통과했는데 오늘은 절반이 401" 을 반복하게 됩니다.

## 요약

| 묶음 | 서버 설정 | 스위트 |
|---|---|---|
| A | 기본 (운영과 같음, JWKS 비대칭 검증) | 아래 3개를 뺀 전부 — 34개 |
| B | 검증용 (HS256 + 개발 결제 어댑터) | `product-api` · `billing-api` · `order-api` |
| — | 서버 불필요, 대신 원본 엑셀 필요 | `v1-excel` · `v1-excel-db` |

## 왜 나뉘는가

**B 묶음은 토큰을 직접 만들어야 합니다.** 상품 등록·결제·배송 API 를 실제 요청으로 확인하려면
여러 역할(일반 회원·판매자·관리자)의 토큰이 필요한데, 운영과 같은 JWKS 비대칭 검증에서는
우리가 토큰을 서명할 수 없습니다. 그래서 그 묶음만 서버를 HS256 대칭키 모드로 띄웁니다.

**A 묶음은 반대입니다.** 진짜 Supabase 로그인으로 받은 토큰을 씁니다. 서버를 HS256 모드로 띄우면
그 토큰을 못 읽어서 전부 401 이 됩니다(`attention` · `account-api` · `professional-api` · `metrics` 가
이렇게 깨집니다).

`order-api` 는 결제가 끝난 주문이 있어야 배송 단계를 볼 수 있으므로 개발 결제 어댑터도 켭니다.
`billing-api` 는 어댑터가 꺼진 상태(501)와 켜진 상태를 둘 다 다루므로 어느 쪽이든 통과합니다.

## 돌리는 순서

서버 jar 는 `mebody-server/target/mebody-server-0.1.0.jar` 입니다. 먼저 빌드해 두세요.

```bash
cd mebody-server && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" mvn -q -DskipTests package
```

### 1차 — 기본 설정 (A 묶음, 34개)

```bash
cd mebody-server && SERVER_PORT=8081 java -jar target/mebody-server-0.1.0.jar
```

서버가 뜨면 다른 창에서:

```bash
cd mebody-jjh && node -p "Object.keys(require('./package.json').scripts).filter(k=>k.startsWith('verify')&&!['verify:product-api','verify:billing-api','verify:order-api','verify:v1-excel','verify:v1-excel-db'].includes(k)).join('\n')" | while read s; do npm run "$s" >/dev/null 2>&1 && echo "OK   $s" || echo "FAIL $s"; done
```

### 2차 — 검증용 설정 (B 묶음, 3개)

1차 서버를 끄고, 32자 이상의 **일회용** 시크릿으로 다시 띄웁니다. 운영 시크릿을 쓰지 마세요 —
이 모드는 아무나 토큰을 만들 수 있다는 뜻이라 로컬 밖으로 나가면 안 됩니다.

```bash
cd mebody-server && SECRET=$(node -e "console.log(require('crypto').randomBytes(36).toString('base64url'))") && SERVER_PORT=8081 java -jar target/mebody-server-0.1.0.jar --mebody.supabase.jwks-url= --mebody.supabase.jwt-secret="$SECRET" --mebody.billing.dev-mode=true
```

같은 `$SECRET` 을 넘겨서:

```bash
cd mebody-jjh && for s in product-api billing-api order-api; do MEBODY_TEST_JWT_SECRET="$SECRET" npm run verify:$s; done
```

### 엑셀 2개

`verify:v1-excel` · `verify:v1-excel-db` 는 2차 문항 원본 명세가 있어야 돌아갑니다.
저장소에 없는 파일이라 **가지고 있는 사람만** 돌릴 수 있습니다.

```bash
EXCEL_PATH=/경로/MEBODY_V1_2차문항_최종_개발명세.xlsx npm run verify:v1-excel
```

기본 경로는 `~/Downloads/MEBODY_V1_2차문항_최종_개발명세.xlsx` 입니다.

## 주의 — 운영 DB 를 씁니다

대부분의 스위트가 **운영 DB** 에 붙습니다. 그래서 두 가지를 지킵니다.

- 스키마를 건드리는 것은 트랜잭션 안에서 적용하고 `ROLLBACK` 합니다.
- 계정·주문·상품처럼 실제로 만드는 것은 스위트 끝에서 스스로 지웁니다
  (끝에 `(정리: …)` 가 찍히는 것들).

중간에 끊으면 정리가 안 돌 수 있습니다. 끊었으면 남은 것이 없는지 확인하세요.

## 자주 나던 함정 — 「계정에 과거가 없다」 가정

스위트 몇 개가 검증용 계정에 기록이 하나도 없다고 전제하고 있었습니다. 그 계정으로 앱을 한 번이라도
실제로 쓰고 나면 영영 빨개집니다. 지금은 전부 **증가분**으로 보게 고쳤지만, 새로 쓸 때도 같은 규칙을
지키세요.

- 나쁨: `count(*) = 1` · `count(*) = 0`
- 좋음: 작업 전 개수를 재 두고 `after - before === 1`

같은 이유로, 특정 날짜 칸에 행을 심을 때는 **비어 있는 날짜를 찾아서** 씁니다
(`verify-routine-reward.mjs` 의 「옮겨 둘 빈 날짜를 찾음」 참고).
