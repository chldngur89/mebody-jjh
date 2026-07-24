UPDATE public.questions SET is_active=false, updated_at=now()
WHERE COALESCE(question_set,'v3_full') NOT IN ('sample_subjective_v1','mebody_v1_32');
DELETE FROM public.questions WHERE question_set='mebody_v1_32';
DELETE FROM public.question_choice_scores WHERE question_set='mebody_v1_32';
INSERT INTO public.questions (
  question_code, question_number, sort_order, axis,
  question_text, option_1, option_2, option_3,
  weight_a, weight_b, question_version, is_precheck, is_scored, is_active,
  answer_type, max_select, title, part, instruction, guide_text,
  axis_anchor, axis_priority, question_set
) VALUES
('A1', 1, 1, 'none', '최근 규칙적으로 운동하고 있나요?', '일주일에 3회 이상 한다', '일주일에 1~2회 정도 한다', '거의 하지 않는다', 0, 0, 'mebody_v1_32', false, true, true, 'single', NULL, '운동 빈도', 'A', '최근 3개월을 기준으로 답합니다.', '[보조] 최근 반복적인 운동 자극을 받고 있는지 확인합니다. 운동 빈도만으로 근력을 판단하지 않으며 A10의 실제 기능 수행과 함께 해석합니다.', 'None', NULL, 'mebody_v1_32'),
('A2', 2, 2, 'none', '충분히 잤다고 느껴도 몸이 개운하지 않은 날이 자주 있나요?', '자주 그렇다', '가끔 그렇다', '거의 그렇지 않다', 0, 0, 'mebody_v1_32', false, true, true, 'single', NULL, '수면 후 회복감', 'A', '최근 한 달의 평소 상태를 기준으로 답합니다.', '[핵심] 질환이나 수면장애를 판단하는 문항이 아니라, 사용자가 느끼는 수면 후 회복감을 확인합니다. 생활 리듬·업무량·스트레스의 영향을 함께 고려합니다.', 'None', NULL, 'mebody_v1_32'),
('A3', 3, 3, 'flexibility', '오래 앉아 있다가 일어날 때 몸은 어떤가요?', '몸이 무겁고 뻣뻣해서 바로 움직이기 어렵다', '상황에 따라 다르다', '비교적 바로 편하게 움직일 수 있다', 0, 0, 'mebody_v1_32', false, true, true, 'single', NULL, '오래 앉은 뒤 움직임', 'A', '최근 한 달 동안 오래 앉아 있다가 처음 일어설 때의 경험을 기준으로 답합니다.', '[보조] 오래 앉은 뒤 몸이 다시 움직일 준비를 하는 속도와 뻣뻣함을 함께 확인합니다. 환경 영향을 받으므로 단독 판정에는 사용하지 않습니다.', 'Supporting', 3, 'mebody_v1_32'),
('A4', 4, 4, 'none', '평소보다 많이 움직인 다음 날 몸은 어떤가요?', '다음 날까지 몸이 무겁고 피로가 오래간다', '활동량이나 상황에 따라 다르다', '비교적 잘 회복되는 편이다', 0, 0, 'mebody_v1_32', false, true, true, 'single', NULL, '활동 후 회복', 'A', '최근 한 달 동안 오래 걷거나 운동한 다음 날의 경험을 기준으로 답합니다.', '[핵심] 일상 활동 뒤 회복 속도를 직접 확인합니다. 활동량·수면·업무량에 따라 달라질 수 있으므로 A2·A5와 함께 해석합니다.', 'None', NULL, 'mebody_v1_32'),
('A5', 5, 5, 'none', '바쁘거나 긴장되는 일이 끝난 뒤에도 몸의 힘이 쉽게 풀리지 않는 편인가요?', '몸의 긴장이 오래 남는 편이다', '상황에 따라 다르다', '비교적 쉽게 편안해지는 편이다', 0, 0, 'mebody_v1_32', false, true, true, 'single', NULL, '긴장 후 이완', 'A', '최근 한 달의 평소 상태를 기준으로 답합니다.', '[핵심] 자율신경 질환을 판단하지 않고, 긴장 상황이 끝난 뒤 주관적으로 편안한 상태로 전환되는 경험을 확인합니다.', 'None', NULL, 'mebody_v1_32'),
('A6', 6, 6, 'none', '계단을 내려갈 때 어떤가요?', '손잡이를 자주 잡거나 불안해서 조심스럽게 내려간다', '상황에 따라 다르거나 잘 모르겠다', '특별한 불안감 없이 자연스럽게 내려간다', 0, 0, 'mebody_v1_32', false, true, true, 'single', NULL, '계단 내려가기', 'A', '평소 계단을 내려갈 때의 경험을 기준으로 답합니다. 일부러 계단에서 검사하지 않아도 됩니다.', '[핵심] 계단 하강에서 체중을 받아내는 힘과 중심 조절의 일상적 어려움을 확인합니다.', 'None', NULL, 'mebody_v1_32'),
('A7', 7, 7, 'flexibility', '평소 몸을 움직일 때 어떤 느낌이 가장 가까운가요?', '몸이 뻣뻣해서 원하는 만큼 움직이기 어렵다', '특별히 불편하거나 이상한 느낌은 없다', '몸은 잘 움직이지만 힘이 잘 모이지 않거나 자세를 오래 유지하기 어렵다', 0, 0, 'mebody_v1_32', false, true, true, 'single', NULL, '전반적인 몸의 느낌', 'A', '평소 전반적인 몸의 느낌을 기준으로 답합니다.', '[보조] 전반적인 특성을 ‘뻣뻣함’과 ‘잘 움직이지만 안정적으로 유지하기 어려움’으로 나눕니다. 실제 동작 문항과 같은 방향일 때 의미가 커집니다.', 'Supporting', 3, 'mebody_v1_32'),
('A8', 8, 8, 'neck', '평소 목이나 어깨가 뻐근해서 자주 주무르거나 스트레칭을 하나요?', '거의 매일 한다', '가끔 한다', '거의 하지 않는다', 0, 0, 'mebody_v1_32', false, true, true, 'single', NULL, '목·어깨 피로 경험', 'A', '최근 한 달을 기준으로 답합니다.', '[해설·동점 참고] 업무환경·스트레스·수면의 영향을 많이 받으므로 축과 아이덴티티 점수에는 직접 반영하지 않습니다. 목·어깨 피로 해설과 결과 동점 시 참고 태그로만 사용합니다.', 'Tie tag', 99, 'mebody_v1_32'),
('A9', 9, 9, 'shoulder', '한쪽 어깨에 가방을 메면 어느 쪽에서 더 자주 흘러내리나요?', '오른쪽 어깨에서 더 자주 흘러내린다', '양쪽이 비슷하거나 잘 모르겠다', '왼쪽 어깨에서 더 자주 흘러내린다', 0, 0, 'mebody_v1_32', false, true, true, 'single', NULL, '가방 흘러내림', 'A', '평소 비슷한 형태의 가방을 멜 때를 기준으로 답합니다.', '환경 영향이 큰 보조', 'Supporting', 3, 'mebody_v1_32'),
('A10', 10, 10, 'none', '의자에서 10번 연속으로 일어났다가 앉아보세요. 어떤가요?', '팔을 짚어야 하거나 10번 하기 어렵다', '할 수 있지만 뒤로 갈수록 힘들거나 자세가 흐트러진다', '비교적 일정하게 10번 할 수 있다', 0, 0, 'mebody_v1_32', false, true, true, 'single', NULL, '의자 10회 일어나기', 'A', '팔걸이 없는 안정적인 의자에서 팔을 가슴 앞에 모으고 10회 반복합니다. 통증·어지럼이 생기면 즉시 중단합니다.', '[핵심] 하체 근력, 근지구력, 체간 유지 능력이 함께 필요한 일상 기능 문항입니다. 통증 때문에 수행하지 못한 경우 점수 대신 중단 태그를 기록합니다.', 'None', NULL, 'mebody_v1_32'),
('B1', 11, 11, 'shoulder', '편하게 섰을 때 어느 쪽 어깨가 더 높아 보이나요?', '오른쪽 어깨가 더 높다', '비슷하거나 잘 모르겠다', '왼쪽 어깨가 더 높다', 0, 0, 'mebody_v1_32', false, true, true, 'single', NULL, '어깨 높이', 'B', '정면 거울이나 사진에서 양팔과 어깨 힘을 빼고 평소 자세 그대로 확인합니다.', '[핵심 앵커] 정적 선 자세의 어깨 높이 방향을 확인하는 2축 핵심 앵커입니다.', 'Primary', 1, 'mebody_v1_32'),
('B2', 12, 12, 'pelvis', '편하게 섰을 때 어느 쪽 골반 앞부분이 더 앞으로 나와 보이나요?', '왼쪽 골반이 더 앞으로 보인다', '비슷하거나 잘 모르겠다', '오른쪽 골반이 더 앞으로 보인다', 0, 0, 'mebody_v1_32', false, true, true, 'single', NULL, '편안한 골반 방향', 'B', '양손 검지를 좌우 골반 앞쪽 돌출부에 가볍게 대거나 정면 사진으로 비교합니다.', '[핵심 앵커] 편안한 선 자세에서 골반 앞부분의 좌우 앞뒤 차이를 확인합니다. 왼쪽이 앞으로 보이면 3축 R, 오른쪽이 앞으로 보이면 3축 L로 계산합니다.', 'Primary', 1, 'mebody_v1_32'),
('B3', 13, 13, 'pelvis', '양쪽 발끝을 정면으로 맞추고 섰을 때 골반 방향은 어떤가요?', '왼쪽 골반이 더 앞으로 보인다', '비슷하거나 잘 모르겠다', '오른쪽 골반이 더 앞으로 보인다', 0, 0, 'mebody_v1_32', false, true, true, 'single', NULL, '발 정렬 후 골반 방향', 'B', '발을 어깨너비로 두고 발끝을 11자로 맞춘 뒤 B2와 같은 방법으로 확인합니다.', '[앵커 보조] 발 방향의 영향을 줄인 상태에서도 골반 방향이 유지되는지 확인합니다.', 'Secondary', 2, 'mebody_v1_32'),
('B4', 14, 14, 'neck', '옆모습에서 귀는 어깨보다 앞으로 나와 있나요?', '귀가 어깨보다 앞으로 나와 있다', '애매하거나 잘 모르겠다', '귀와 어깨가 비슷한 선에 있다', 0, 0, 'mebody_v1_32', false, true, true, 'single', NULL, '선 자세 귀 위치', 'B', '옆에서 평소 자세를 촬영하거나 거울로 확인합니다. 턱과 가슴을 일부러 고치지 않습니다.', '[핵심 앵커] 평소 머리를 몸통보다 앞에서 사용하는 경향을 확인합니다. 서기와 앉기 결과가 같으면 1축 확신도가 높아집니다.', 'Primary', 1, 'mebody_v1_32'),
('B5', 15, 15, 'shoulder', '어깨를 천천히 으쓱 올렸을 때 어느 쪽이 먼저 또는 더 높이 올라가나요?', '오른쪽이 더 먼저 또는 높이 올라간다', '비슷하거나 잘 모르겠다', '왼쪽이 더 먼저 또는 높이 올라간다', 0, 0, 'mebody_v1_32', false, true, true, 'single', NULL, '어깨 으쓱 비대칭', 'B', '양팔은 몸 옆에 편하게 두고 통증 없는 범위에서 양쪽 어깨를 천천히 으쓱합니다.', '기능 앵커', 'Primary', 1, 'mebody_v1_32'),
('B6', 16, 16, 'pelvis', '자주 신는 신발은 어느 쪽이 더 많이 닳았나요?', '오른쪽 신발이 더 많이 닳았다', '비슷하거나 잘 모르겠다', '왼쪽 신발이 더 많이 닳았다', 0, 0, 'mebody_v1_32', false, true, true, 'single', NULL, '신발 밑창 마모', 'B', '최근 자주 신은 비슷한 종류의 신발 밑창을 좌우 비교합니다.', '[저가중치 보조] 보행과 서기에서 반복되는 좌우 체중 사용의 누적 흔적입니다. 신발 종류의 영향을 받아 보조로만 사용합니다.', 'Supporting', 3, 'mebody_v1_32')
ON CONFLICT (question_code, question_set) DO UPDATE SET
  question_number=EXCLUDED.question_number, sort_order=EXCLUDED.sort_order, axis=EXCLUDED.axis,
  question_text=EXCLUDED.question_text, option_1=EXCLUDED.option_1, option_2=EXCLUDED.option_2,
  option_3=EXCLUDED.option_3, title=EXCLUDED.title, part=EXCLUDED.part, instruction=EXCLUDED.instruction,
  guide_text=EXCLUDED.guide_text, axis_anchor=EXCLUDED.axis_anchor, axis_priority=EXCLUDED.axis_priority,
  is_active=true, question_version='mebody_v1_32', updated_at=now();
