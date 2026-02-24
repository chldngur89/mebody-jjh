/**
 * Ver2 문항 데이터 (doc/ver2 문항 엑셀 기준)
 * 1축 7문항, 2축 10문항, 3축 10문항, 4축 13문항 = 40문항
 */

const OPTION_2_NEUTRAL = '② 잘 모르겠다 / 상황에 따라 다르다';

export type AxisKey = 'neck' | 'shoulder' | 'pelvis' | 'flexibility';

export interface Ver2Question {
  id: number
  question_number: number
  axis: AxisKey
  question_text: string
  option_1: string
  option_2: string
  option_3: string
  /** Ver2 가중치: ① 선택 시 A방향 점수 (1축 F, 2축 R, 3축 R, 4축 S) */
  weight_a: number
  /** Ver2 가중치: ③ 선택 시 B방향 점수 (1축 C, 2축 L, 3축 L, 4축 F) */
  weight_b: number
}

/** 1축: 7문항 (F vs C), 2축: 10문항 (R vs L), 3축: 10문항 (R vs L), 4축: 13문항 (S vs F) */
export const VER2_QUESTIONS: Ver2Question[] = [
  // 1축 목 (FORWARD / CENTRAL) — 7문항, 총 15점
  { id: 1, question_number: 1, axis: 'neck', weight_a: 2, weight_b: 2, question_text: '10초 휴대폰 보기(즉시)', option_1: '① 턱이 화면 쪽으로 나가고, 목이 많이 숙여진다', option_2: OPTION_2_NEUTRAL, option_3: '③ 휴대폰을 눈높이 쪽으로 올려, 목이 크게 숙지 않는다' },
  { id: 2, question_number: 2, axis: 'neck', weight_a: 2, weight_b: 2, question_text: '벽 정렬: 뒤통수 닿음(즉시)', option_1: '① 뒤통수가 벽에 잘 안 닿는다(턱이 앞으로/위로)', option_2: OPTION_2_NEUTRAL, option_3: '③ 뒤통수·등·골반이 비교적 자연스럽게 같이 닿는다' },
  { id: 3, question_number: 3, axis: 'neck', weight_a: 3, weight_b: 3, question_text: '옆모습 사진: 귀-어깨 선(즉시)', option_1: '① 귀가 어깨보다 확실히 앞으로 나와 있다', option_2: OPTION_2_NEUTRAL, option_3: '③ 귀가 어깨와 거의 같은 선이거나 약간 뒤에 있다' },
  { id: 4, question_number: 4, axis: 'neck', weight_a: 3, weight_b: 3, question_text: '의자에 앉아 엉덩이 깊게, 등을 등받이에 붙여. 그 상태에서 화면을 정면으로 보면 고개가 앞으로 나가나요?', option_1: '① 등을 붙여도 턱/얼굴이 앞으로 나가야 보기 편하다', option_2: OPTION_2_NEUTRAL, option_3: '③ 등을 붙인 상태에서도 턱을 앞으로 내밀지 않고 보기 편하다' },
  { id: 5, question_number: 5, axis: 'neck', weight_a: 3, weight_b: 3, question_text: '턱 당기기 10초(즉시)', option_1: '① 3~5초도 힘들고, 앞목/턱밑이 금방 힘들어진다', option_2: OPTION_2_NEUTRAL, option_3: '③ 10초가 비교적 편하고, 목이 길게 유지된다' },
  { id: 6, question_number: 6, axis: 'neck', weight_a: 1, weight_b: 1, question_text: '컴퓨터/휴대폰 30분 후 먼저 느껴지는 것(경험, "피로감")', option_1: '① 뒷목/목 위쪽이 먼저 피로해진다', option_2: OPTION_2_NEUTRAL, option_3: '③ 목보다는 등/허리가 먼저 피로해진다' },
  { id: 7, question_number: 7, axis: 'neck', weight_a: 1, weight_b: 1, question_text: '자기 인식', option_1: '① 나는 거북목/앞으로 쏠림에 가깝다', option_2: OPTION_2_NEUTRAL, option_3: '③ 나는 목이 많이 나가 있진 않은 편이다' },
  // 2축 어깨 (RIGHT UP / LEFT UP) — 10문항, 총 17점
  { id: 8, question_number: 8, axis: 'shoulder', weight_a: 3, weight_b: 3, question_text: '거울 앞 힘 빼고 섰을 때(즉시)', option_1: '① 오른쪽 어깨가 더 올라가 보인다', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼쪽 어깨가 더 올라가 보인다' },
  { id: 9, question_number: 9, axis: 'shoulder', weight_a: 2, weight_b: 2, question_text: '사진으로 목-어깨 라인 길이(즉시)', option_1: '① 오른쪽 귀밑~어깨 라인이 더 짧아 보인다', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼쪽 라인이 더 짧아 보인다' },
  { id: 10, question_number: 10, axis: 'shoulder', weight_a: 1, weight_b: 1, question_text: '가방/옷 끈이 자주 흘러내리는 쪽(최근 7일)', option_1: '① 오른쪽에서 더 자주 흘러내린다', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼쪽에서 더 자주 흘러내린다' },
  { id: 11, question_number: 11, axis: 'shoulder', weight_a: 1, weight_b: 1, question_text: '양팔 툭 떨어뜨린 손끝 높이(즉시)', option_1: '① 오른쪽 손끝이 더 위에 있다', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼쪽 손끝이 더 위에 있다' },
  { id: 12, question_number: 12, axis: 'shoulder', weight_a: 1, weight_b: 1, question_text: '옆으로 누워 쉬는 쪽(습관)', option_1: '① 오른쪽으로 더 자주 눕는다', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼쪽으로 더 자주 눕는다' },
  { id: 13, question_number: 13, axis: 'shoulder', weight_a: 3, weight_b: 3, question_text: '팔 옆으로 들어 90도(즉시)', option_1: '① 오른쪽 어깨가 더 으쓱 올라가 보인다', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼쪽 어깨가 더 으쓱 올라가 보인다' },
  { id: 14, question_number: 14, axis: 'shoulder', weight_a: 3, weight_b: 3, question_text: '으쓱 3번: 더 먼저/더 크게 올라가는 쪽(즉시)', option_1: '① 오른쪽', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼쪽' },
  { id: 15, question_number: 15, axis: 'shoulder', weight_a: 1, weight_b: 1, question_text: '팔짱: 위로 올라오는 팔', option_1: '① 오른팔', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼팔' },
  { id: 16, question_number: 16, axis: 'shoulder', weight_a: 1, weight_b: 1, question_text: '목 옆~어깨선 스트레치 시 더 "빡빡한" 쪽', option_1: '① 오른쪽이 더 빡빡하게 느껴진다', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼쪽이 더 빡빡하게 느껴진다' },
  { id: 17, question_number: 17, axis: 'shoulder', weight_a: 1, weight_b: 1, question_text: '무의식적으로 힘이 더 들어가는 어깨', option_1: '① 오른쪽 어깨에 힘이 더 들어간다', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼쪽 어깨에 힘이 더 들어간다' },
  // 3축 골반 (RIGHT ROTATION / LEFT ROTATION) — 10문항, 총 17점 (앵커 5점)
  { id: 18, question_number: 18, axis: 'pelvis', weight_a: 5, weight_b: 5, question_text: '거울 정면: 골반 "앞으로 나온 쪽"', option_1: '① 오른쪽 골반(허리선)이 더 앞으로 나와 보인다', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼쪽 골반(허리선)이 더 앞으로 나와 보인다' },
  { id: 19, question_number: 19, axis: 'pelvis', weight_a: 1, weight_b: 1, question_text: '바지/벨트 중앙선 돌아감', option_1: '① 오른쪽으로 더 자주 돌아간다', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼쪽으로 더 자주 돌아간다' },
  { id: 20, question_number: 20, axis: 'pelvis', weight_a: 2, weight_b: 2, question_text: '벽 기대기: 엉덩이 먼저 닿는 쪽', option_1: '① 오른쪽 엉덩이가 먼저/더 크게 닿는다', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼쪽 엉덩이가 먼저/더 크게 닿는다' },
  { id: 21, question_number: 21, axis: 'pelvis', weight_a: 2, weight_b: 2, question_text: '딱딱한 의자: 좌골(엉덩이뼈) 압력', option_1: '① 오른쪽이 더 강하게 닿는다', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼쪽이 더 강하게 닿는다' },
  { id: 22, question_number: 22, axis: 'pelvis', weight_a: 1, weight_b: 1, question_text: '"짝다리/체중 싣기" 더 편한 다리(습관)', option_1: '① 오른쪽 다리에 체중 싣는 게 더 편하다', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼쪽 다리에 체중 싣는 게 더 편하다' },
  { id: 23, question_number: 23, axis: 'pelvis', weight_a: 1, weight_b: 1, question_text: '앉아서 다리 꼬기: "더 편한" 위쪽 다리(습관)', option_1: '① 오른다리가 위로 오는 게 더 편하다', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼다리가 위로 오는 게 더 편하다' },
  { id: 24, question_number: 24, axis: 'pelvis', weight_a: 1, weight_b: 1, question_text: '바로 누워 힘 빼기: 발끝이 더 바깥으로 향하는 쪽', option_1: '① 오른발 끝이 더 바깥으로 돌아가 있다', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼발 끝이 더 바깥으로 돌아가 있다' },
  { id: 25, question_number: 25, axis: 'pelvis', weight_a: 2, weight_b: 2, question_text: '눈 감고 제자리 걸음 10초 후 방향', option_1: '① 몸이 오른쪽으로 더 돌아가 있다', option_2: OPTION_2_NEUTRAL, option_3: '③ 몸이 왼쪽으로 더 돌아가 있다' },
  { id: 26, question_number: 26, axis: 'pelvis', weight_a: 1, weight_b: 1, question_text: '스쿼트(가볍게): 무릎이 더 바깥으로 벌어지는 쪽', option_1: '① 오른쪽 무릎이 더 바깥으로 벌어진다', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼쪽 무릎이 더 바깥으로 벌어진다' },
  { id: 27, question_number: 27, axis: 'pelvis', weight_a: 1, weight_b: 1, question_text: '서 있을 때 "틀어진 느낌" 방향', option_1: '① 오른쪽으로 틀어진 느낌이 더 가깝다', option_2: OPTION_2_NEUTRAL, option_3: '③ 왼쪽으로 틀어진 느낌이 더 가깝다' },
  // 4축 하체 (STIFF / FLEXIBLE) — 13문항, 총 28점
  { id: 28, question_number: 28, axis: 'flexibility', weight_a: 2, weight_b: 2, question_text: '무릎 펴고 상체 숙이기', option_1: '① 손끝이 무릎 근처', option_2: OPTION_2_NEUTRAL, option_3: '③ 손끝이 발등/바닥 가까이' },
  { id: 29, question_number: 29, axis: 'flexibility', weight_a: 2, weight_b: 2, question_text: '완전 쪼그려 앉기(즉시, 5초)', option_1: '① 거의 불가/뒤꿈치가 많이 뜬다', option_2: OPTION_2_NEUTRAL, option_3: '③ 비교적 편하게 5초 가능' },
  { id: 30, question_number: 30, axis: 'flexibility', weight_a: 4, weight_b: 4, question_text: '발목 유연성: 무릎-벽 테스트(10cm)\n세팅: 벽 앞에서 엄지발가락 10cm, 뒤꿈치 안 들고 무릎을 벽에 닿게', option_1: '① 10cm는 어렵다(뒤꿈치 들림/안 닿음)', option_2: OPTION_2_NEUTRAL, option_3: '③ 10cm도 비교적 쉽게 닿는다' },
  { id: 31, question_number: 31, axis: 'flexibility', weight_a: 2, weight_b: 2, question_text: '런지 자세(무릎 바닥)로 앞쪽 사타구니 늘림(즉시)\n세팅: 한쪽 무릎을 바닥에 대고(매트/수건), 반대발은 앞에. 골반을 살짝 말고 상체는 곧게.', option_1: '① 사타구니 앞이 강하게 뻣뻣하고 자세가 유지가 어렵다', option_2: OPTION_2_NEUTRAL, option_3: '③ 비교적 편하게 늘어난다' },
  { id: 32, question_number: 32, axis: 'flexibility', weight_a: 2, weight_b: 2, question_text: '허벅지 앞 늘리기(서서 발목 잡기, 즉시)', option_1: '① 발꿈치가 엉덩이 쪽으로 거의 안 오고 강하게 뻣뻣하다', option_2: OPTION_2_NEUTRAL, option_3: '③ 비교적 잘 오고 편하다' },
  { id: 33, question_number: 33, axis: 'flexibility', weight_a: 4, weight_b: 4, question_text: '발끝 힘 빼고, 허리 편 채 "엉덩이 뒤로 빼며" 숙이기\n세팅: 발바닥 전체 바닥, 발끝 일부러 들지 말고 힘만 빼기, 무릎은 쭉(잠그진 말고), 허리는 편하게', option_1: '① 뒤허벅지/엉덩이 아래가 빨리 강하게 뻣뻣해져 많이 못 숙인다', option_2: OPTION_2_NEUTRAL, option_3: '③ 비교적 잘 숙여지고 뻣뻣함이 심하지 않다' },
  { id: 34, question_number: 34, axis: 'flexibility', weight_a: 2, weight_b: 2, question_text: '누워서 한쪽 무릎 가슴 쪽(즉시)', option_1: '① 무릎이 잘 안 올라오고 뒤쪽 엉덩이 / 엉덩이-허벅지 경계가 뻣뻣하다', option_2: OPTION_2_NEUTRAL, option_3: '③ 잘 올라오고 편하다' },
  { id: 35, question_number: 35, axis: 'flexibility', weight_a: 1, weight_b: 1, question_text: '나비자세(고관절/내전근)', option_1: '① 무릎이 많이 뜨고 불편해서 자세 유지가 어렵다', option_2: OPTION_2_NEUTRAL, option_3: '③ 무릎이 비교적 잘 내려가고 편하다' },
  { id: 36, question_number: 36, axis: 'flexibility', weight_a: 2, weight_b: 2, question_text: '힙힌지(허리 편 상태로 상체 숙이기) 5회(즉시)\n설명: "허리는 편하게 유지" + "엉덩이를 뒤로 빼며" 상체를 숙였다가 올라오기', option_1: '① 허리가 먼저 둥글게 말리거나 허리로 접히는 느낌이 강하다', option_2: OPTION_2_NEUTRAL, option_3: '③ 허리 말림이 적고, 엉덩이 접힘(고관절)로 숙이는 느낌이 난다' },
  { id: 37, question_number: 37, axis: 'flexibility', weight_a: 1, weight_b: 1, question_text: "의자 앉아 '4자' 자세\n세팅: 의자에 앉아 오른발목을 왼쪽 무릎 위에 올려 '4' 모양(양쪽 다 해봄)", option_1: '① 무릎이 많이 떠서 자세가 불편하거나 뻣뻣하다', option_2: OPTION_2_NEUTRAL, option_3: '③ 비교적 편하고 무릎이 잘 내려간다' },
  { id: 38, question_number: 38, axis: 'flexibility', weight_a: 2, weight_b: 2, question_text: '벽 짚고 뒤꿈치 들기 10회\n설명: 벽을 가볍게 짚고, 뒤꿈치를 천천히 올렸다 내리기 10회(반동X)', option_1: '① 10회가 어렵고 종아리가 빨리 뻣뻣해진다', option_2: OPTION_2_NEUTRAL, option_3: '③ 10회가 비교적 쉽고 뻣뻣함이 심하지 않다' },
  { id: 39, question_number: 39, axis: 'flexibility', weight_a: 3, weight_b: 3, question_text: '계단/스텝 없이 가능한 "발목 앞쪽 접힘" 체크(즉시)\n설명: 벽 앞에서 한 발을 앞으로 두고(앞발), 무릎을 천천히 앞으로 보내 벽에 닿게(뒤꿈치 안 들기) — 5회', option_1: '① 뒤꿈치가 들리거나 무릎이 앞으로 잘 못 간다', option_2: OPTION_2_NEUTRAL, option_3: '③ 비교적 잘 된다(뒤꿈치 유지)' },
  { id: 40, question_number: 40, axis: 'flexibility', weight_a: 1, weight_b: 1, question_text: '운동/활동 전 "몸 풀기" 필요도', option_1: '① 스트레칭이나 몸을 풀어야 운동/활동할 때 움직임이 잘 나온다', option_2: OPTION_2_NEUTRAL, option_3: '③ 몸을 안 풀어도 운동/활동할 때 움직임이 잘 나온다' },
];

/** 축별 최대 점수 (신뢰도 40% 미만 판단용) */
export const VER2_AXIS_MAX_SCORE: Record<AxisKey, number> = {
  neck: 15,
  shoulder: 17,
  pelvis: 17,
  flexibility: 28,
};

/** 축별 신뢰도 부족 기준 (최대의 40% 미만) */
export const VER2_LOW_CONFIDENCE_THRESHOLD: Record<AxisKey, number> = {
  neck: 6,      // 15 * 0.4
  shoulder: 7,  // 17 * 0.4
  pelvis: 7,
  flexibility: 11, // 28 * 0.4
};
