/**
 * 미션 탭 — 시안의 mission 페이지.
 *
 *   오늘의 미션      = 공통 스트레칭 (CodePlanDetailContent 의 routineOnly)
 *   이번 주 챌린지   = .day-dots 7일 + 주간 적립금 보너스
 *   한 달 기록       = 4주 달력. 수행 이력은 적립 원장에서 읽습니다(새 테이블 없음)
 *
 * 시안은 EXP 였지만 우리는 적립금입니다(사용자 확정).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift } from 'lucide-react';
import {
  claimMonthlyChallenge,
  claimWeeklyChallenge,
  fetchChallengeStatus,
  fetchRoutineHistory,
  type ChallengeStatus,
  type RoutineDay,
} from '../../api/routineHistory';
import { BRAND, SURFACE } from '../../theme/brand';
import { CodePlanDetailContent, useCodePlanData } from '../codePlanShared';
import { Card, CTA, PageTitle, ProgressTrack, SectionHeading } from '../ui';

const DOW = ['월', '화', '수', '목', '금', '토', '일'];

/** KST 기준 오늘의 서비스 날짜(오전 5시 경계) */
function serviceToday(): Date {
  const now = new Date();
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60_000);
  kst.setHours(kst.getHours() - 5);
  kst.setHours(0, 0, 0, 0);
  return kst;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/** 월요일 시작 주의 첫날 */
function weekStart(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // 월=0
  return addDays(d, -day);
}

export interface MissionScreenProps {
  questionnaireId?: string;
  isLoggedIn?: boolean;
  isPaid?: boolean;
  onRequireAuth?: () => void;
}

export function MissionScreen({ questionnaireId, isLoggedIn = false, isPaid = false, onRequireAuth }: MissionScreenProps) {
  const data = useCodePlanData(questionnaireId);
  const [history, setHistory] = useState<RoutineDay[]>([]);
  /*
   * 보너스 **예고 금액**을 더는 보여주지 않습니다.
   *
   * 전에는 규칙에서 읽어 "주간 보너스 2원" 처럼 미리 적었습니다. 화면에 숫자를 박지 않으려고
   * 그렇게 했는데, 정작 그 숫자가 작아서 하기 싫어지는 쪽으로 작용합니다.
   * 목표(7일·20일)만 말하고, **받은 뒤에 실제 받은 금액**을 알려 줍니다(claim 의 notice).
   *
   * 그래서 fetchRewardRules 호출도 걷어냈습니다 — 쓰지 않는 값을 계속 받아 오면
   * 다음 사람이 왜 있는지 몰라 화면에 다시 붙입니다.
   */
  const [status, setStatus] = useState<ChallengeStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const today = useMemo(() => serviceToday(), []);
  const monthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);

  const reload = useCallback(async () => {
    if (!isLoggedIn) return;
    const from = iso(weekStart(monthStart));
    const to = iso(addDays(monthStart, 41));
    const [days, st] = await Promise.all([fetchRoutineHistory(from, to), fetchChallengeStatus()]);
    setHistory(days);
    setStatus(st);
  }, [isLoggedIn, monthStart]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const doneSet = useMemo(() => new Set(history.map((d) => d.serviceDay)), [history]);
  const earned = useMemo(() => history.reduce((sum, d) => sum + d.baseAmount + d.bonusAmount, 0), [history]);

  const claim = async (kind: 'weekly' | 'monthly') => {
    setWorking(true);
    setNotice(null);
    const result = kind === 'weekly' ? await claimWeeklyChallenge() : await claimMonthlyChallenge();
    setWorking(false);
    if (!result) {
      setNotice('보너스를 처리하지 못했습니다.');
      return;
    }
    if (result.alreadyClaimed) {
      setNotice('이미 받으셨습니다.');
    } else if (result.amount > 0) {
      setNotice(`${result.amount}원이 적립되었습니다!`);
    } else {
      setNotice(`아직 ${result.doneDays} / ${result.required}일입니다.`);
    }
    void reload();
  };

  if (!isLoggedIn) {
    return (
      <div style={{ display: 'grid', gap: '14px' }}>
        <PageTitle eyebrow="TODAY · CARE" title="오늘의 미션" lead="로그인하면 매일의 기록과 보너스 적립이 쌓입니다." />
        <Card>
          <CTA onClick={onRequireAuth}>로그인 / 회원가입</CTA>
        </Card>
      </div>
    );
  }

  // 이번 주 7일
  const ws = weekStart(today);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

  // 이번 달 달력 (월요일 시작, 6주까지)
  const gridStart = weekStart(monthStart);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w += 1) {
    const row = Array.from({ length: 7 }, (_, i) => addDays(gridStart, w * 7 + i));
    if (row[0].getMonth() > monthStart.getMonth() && row[0].getFullYear() >= monthStart.getFullYear()) break;
    weeks.push(row);
  }

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <PageTitle
        eyebrow="TODAY · CARE"
        title="오늘의 미션"
        lead="매일 공통 스트레칭을 채우고, 주·월 단위로 보너스를 받아가세요."
      />

      {/* 이번 달 요약 */}
      <Card>
        <SectionHeading
          kicker={`${monthStart.getMonth() + 1}월 기록`}
          title={`${status?.monthDone ?? 0} / ${status?.monthRequired ?? 20}일 완료`}
          // 0원이면 "0원 적립" 이라고 쓰지 않습니다 — 처음 쓰는 사람은 늘 0 이라
          // 첫인상이 "아무것도 못 받는 곳" 이 됩니다. 쌓인 뒤에만 보여줍니다.
          hint={earned > 0 ? `${earned.toLocaleString()}원 적립` : undefined}
        />
        {/*
            아직 하루도 안 한 달에는 진행바 대신 **무엇을 하면 되는지**를 보여줍니다.
            0/20·0원·빈 막대 셋이 나란히 있으면 카드 전체가 비어 보입니다.
        */}
        {(status?.monthDone ?? 0) === 0 ? (
          <div style={{
            marginTop: '12px',
            borderRadius: '14px',
            background: SURFACE.subtle,
            padding: '14px 16px',
            fontSize: '0.8125rem',
            lineHeight: 1.6,
            fontWeight: 700,
            color: BRAND.muted,
            wordBreak: 'keep-all',
          }}>
            아래 공통 스트레칭을 마치면 오늘 기록이 쌓이기 시작해요.
            <br />
            한 달에 {status?.monthRequired ?? 20}일을 채우면 보너스를 드립니다.
          </div>
        ) : (
          <ProgressTrack
            percent={((status?.monthDone ?? 0) / Math.max(1, status?.monthRequired ?? 20)) * 100}
            label="월간 완주"
            // **앞으로 받을 금액을 미리 말하지 않습니다.**
            // 액수가 적어 오히려 하기 싫어지는 쪽으로 작용합니다. 목표 일수만 보여 줍니다.
            // 실제로 받은 금액은 받은 뒤에 알려 줍니다(아래 notice).
            value={status?.monthClaimed ? '보너스 받음' : `${status?.monthRequired ?? 20}일 달성`}
          />
        )}
        {status && !status.monthClaimed && status.monthDone >= status.monthRequired && (
          <CTA onClick={() => void claim('monthly')} disabled={working}>
            <Gift size={16} /> 월간 보너스 받기
          </CTA>
        )}
      </Card>

      {/* 오늘의 미션 = 공통 스트레칭 */}
      {data.result && <CodePlanDetailContent data={data} isLoggedIn={isLoggedIn} isPaid={isPaid} variant="routineOnly" />}

      {/* 이번 주 챌린지 */}
      <Card>
        <SectionHeading
          kicker="이번 주"
          title="PERFECT CHALLENGE"
          hint={`${status?.weekDone ?? 0} / 7`}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', margin: '4px 0 10px' }}>
          {weekDays.map((d, i) => {
            const key = iso(d);
            const done = doneSet.has(key);
            const isToday = key === iso(today);
            return (
              <div key={key} style={{ textAlign: 'center', fontSize: '0.6875rem', color: 'var(--mebody-t-718078, #718078)' }}>
                {DOW[i]}
                <i
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: '32px',
                    height: '32px',
                    margin: '5px auto 0',
                    borderRadius: '50%',
                    fontStyle: 'normal',
                    fontWeight: 900,
                    fontSize: '0.8125rem',
                    background: done ? BRAND.green : 'var(--mebody-s-ffffff, #ffffff)',
                    color: done ? 'var(--mebody-t-ffffff-2, #ffffff)' : isToday ? BRAND.green : 'var(--mebody-t-9ba79f, #9BA79F)',
                    outline: isToday && !done ? `2px solid ${BRAND.green}` : 'none',
                    border: done ? 'none' : `1px solid ${SURFACE.hairline}`,
                  }}
                >
                  {done ? '✓' : d.getDate()}
                </i>
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: SURFACE.soft,
            borderRadius: '14px',
            padding: '11px 12px',
            fontSize: '0.75rem',
          }}
        >
          <span>7일 모두 완료하면</span>
          {/* 금액을 미리 말하지 않습니다 — 위 monthly 와 같은 이유입니다. */}
          <b style={{ color: BRAND.green }}>주간 보너스</b>
        </div>
        {status && !status.weekClaimed && status.weekDone >= status.weekRequired && (
          <CTA onClick={() => void claim('weekly')} disabled={working}>
            <Gift size={16} /> 주간 보너스 받기
          </CTA>
        )}
        {notice && (
          <div style={{ marginTop: '10px', fontSize: '0.8125rem', fontWeight: 700, color: BRAND.muted, textAlign: 'center' }}>
            {notice}
          </div>
        )}
      </Card>

      {/* 한 달 달력 */}
      <Card>
        <SectionHeading kicker="기록" title={`${monthStart.getMonth() + 1}월 관리 달력`} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px' }}>
          {DOW.map((d) => (
            <div key={d} style={{ textAlign: 'center', fontSize: '0.6875rem', color: BRAND.muted, fontWeight: 800 }}>
              {d}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gap: '4px' }}>
          {weeks.map((row, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {row.map((d) => {
                const key = iso(d);
                const inMonth = d.getMonth() === monthStart.getMonth();
                const done = doneSet.has(key);
                const isToday = key === iso(today);
                return (
                  <div
                    key={key}
                    style={{
                      aspectRatio: '1',
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: done ? 900 : 600,
                      background: done ? BRAND.green : inMonth ? SURFACE.subtle : 'transparent',
                      color: done ? 'var(--mebody-t-ffffff-2, #ffffff)' : inMonth ? BRAND.text : 'var(--mebody-t-c9d2cb, #C9D2CB)',
                      outline: isToday ? `2px solid ${BRAND.green}` : 'none',
                    }}
                  >
                    {d.getDate()}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
