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
          hint={`${earned.toLocaleString()}원 적립`}
        />
        <ProgressTrack
          percent={((status?.monthDone ?? 0) / Math.max(1, status?.monthRequired ?? 20)) * 100}
          label="월간 완주"
          value={status?.monthClaimed ? '보너스 받음' : `${status?.monthRequired ?? 20}일 달성 시 50원`}
        />
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
              <div key={key} style={{ textAlign: 'center', fontSize: '10px', color: '#718078' }}>
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
                    fontSize: '12px',
                    background: done ? BRAND.green : '#ffffff',
                    color: done ? '#ffffff' : isToday ? BRAND.green : '#9BA79F',
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
            fontSize: '11px',
          }}
        >
          <span>7일 모두 완료하면</span>
          <b style={{ color: BRAND.green }}>주간 보너스 20원</b>
        </div>
        {status && !status.weekClaimed && status.weekDone >= status.weekRequired && (
          <CTA onClick={() => void claim('weekly')} disabled={working}>
            <Gift size={16} /> 주간 보너스 받기
          </CTA>
        )}
        {notice && (
          <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 700, color: BRAND.muted, textAlign: 'center' }}>
            {notice}
          </div>
        )}
      </Card>

      {/* 한 달 달력 */}
      <Card>
        <SectionHeading kicker="기록" title={`${monthStart.getMonth() + 1}월 관리 달력`} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px' }}>
          {DOW.map((d) => (
            <div key={d} style={{ textAlign: 'center', fontSize: '10px', color: BRAND.muted, fontWeight: 800 }}>
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
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: done ? 900 : 600,
                      background: done ? BRAND.green : inMonth ? SURFACE.subtle : 'transparent',
                      color: done ? '#ffffff' : inMonth ? BRAND.text : '#C9D2CB',
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
