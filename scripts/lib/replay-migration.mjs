/**
 * 지난 마이그레이션을 **검증용으로 다시 적용**할 때 쓰는 로더.
 *
 * 검증 스위트 몇 개(033·035·036·037)는 옛 마이그레이션을 트랜잭션 안에서 다시 적용하고
 * ROLLBACK 합니다. 그런데 그 파일들은 당시의 불변식을 그대로 들고 있습니다.
 *
 *   037 등: user_rewards_sign_check CHECK (... AND amount > 0)   ← 적립은 반드시 양수
 *   057   : user_rewards_amount_sign_check CHECK (... AND amount >= 0)  ← 0원(꽝) 허용
 *
 * 057 이 "굴렸지만 꽝" 을 남기려고 0 을 허용했으므로, 운영 원장에는 0원 행이 생길 수 있습니다.
 * 그 상태에서 037 을 다시 적용하면 ADD CONSTRAINT 가 기존 행을 전부 재검사하다가
 *
 *   error: check constraint "user_rewards_sign_check" of relation "user_rewards"
 *          is violated by some row                                   (SQLSTATE 23514)
 *
 * 로 터집니다. **데이터가 잘못된 게 아니라 재적용이 과거의 규칙을 현재 데이터에 들이대는 것**입니다.
 * 0원 행이 하나도 없는 동안에는 조용히 지나가다가 처음 꽝이 나오는 순간 전부 빨개지는 함정이었습니다.
 *
 * 그래서 재적용할 때만 이 제약을 NOT VALID 로 바꿉니다.
 *
 *   · NOT VALID 는 **제약을 걸되 기존 행은 재검사하지 않습니다.** 이후 INSERT/UPDATE 에는
 *     그대로 적용되므로, 스위트가 확인하려는 "037 이 이 부호 규칙을 건다" 는 사실은 남습니다.
 *   · 같은 트랜잭션에서 바로 뒤에 57 이 이 제약을 DROP 하고 >= 0 짜리로 바꿉니다.
 *     즉 검증이 끝난 모습은 운영과 동일합니다.
 *   · 운영 파일은 건드리지 않습니다. 이미 적용된 마이그레이션을 고쳐 쓰면 이력이 거짓이 됩니다.
 */
import { readFileSync } from 'node:fs'

/** `ALTER TABLE ... ADD CONSTRAINT user_rewards_sign_check CHECK ( ... );` 한 덩어리 */
const SIGN_CHECK = /(ADD\s+CONSTRAINT\s+user_rewards_sign_check\s+CHECK\s*\([\s\S]*?\n)\);/

/**
 * db/journey/<name>.sql 을 읽어 재적용에 안전한 형태로 돌려줍니다.
 * @param {string} name 확장자 없는 파일명 (예: '037_redesign')
 */
export function readReplayable(name) {
  const path = new URL(`../../db/journey/${name}.sql`, import.meta.url).pathname
  const sql = readFileSync(path, 'utf8')
  if (!SIGN_CHECK.test(sql)) return sql
  return sql.replace(SIGN_CHECK, '$1) NOT VALID;')
}
