import type { AnswerMap } from '../utils/bodyCodeCalculator';

export const QUESTIONNAIRE_PROGRESS_KEY = 'mebody:questionnaire-progress:v1';
export interface QuestionnaireProgress { answers: AnswerMap; index: number; draftId?: string; id?: string; completedResultId?: string }
export const emptyQuestionnaireProgress = (): QuestionnaireProgress => ({ answers: {}, index: 0, id: crypto.randomUUID() });

export function parseQuestionnaireProgress(raw: string | null): QuestionnaireProgress {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || !Number.isInteger(value.index) || value.index < 0 || value.index > 31
      || !value.answers || typeof value.answers !== 'object' || Array.isArray(value.answers)) return emptyQuestionnaireProgress();
    const answers: AnswerMap = {};
    for (const [key, answer] of Object.entries(value.answers)) {
      if (/^(A(?:[1-9]|10)|B[1-6]|C[1-9]|D[1-7])$/.test(key) && ['①', '②', '③'].includes(answer as string)) answers[key] = answer as string;
    }
    return { answers, index: value.index, id: typeof value.id === 'string' ? value.id : crypto.randomUUID(), completedResultId: typeof value.completedResultId === 'string' ? value.completedResultId : undefined, draftId: typeof value.draftId === 'string' ? value.draftId : undefined };
  } catch { return emptyQuestionnaireProgress(); }
}

export function readQuestionnaireProgress() {
  try { return parseQuestionnaireProgress(sessionStorage.getItem(QUESTIONNAIRE_PROGRESS_KEY)); }
  catch { return emptyQuestionnaireProgress(); }
}

export function persistQuestionnaireProgress(progress: QuestionnaireProgress) {
  try { sessionStorage.setItem(QUESTIONNAIRE_PROGRESS_KEY, JSON.stringify(progress)); } catch { /* React state still preserves this visit. */ }
}

/** Mid-flow progress that can be resumed (not yet completed). */
export function hasIncompleteProgress(progress: QuestionnaireProgress): boolean {
  if (progress.completedResultId) return false
  if (progress.index > 0) return true
  return Object.keys(progress.answers).length > 0
}
