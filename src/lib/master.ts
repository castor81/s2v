import type { Localized, MessageKey } from '../i18n';
import { errorCode, post, type ApiResult } from './api';

export type PollStatus = 'upcoming' | 'open' | 'closed';

export interface MPoll {
  id: string;
  slug: string;
  voteUrl: string;
  title: Localized;
  options: Array<{ id: string } & Localized>;
  status: PollStatus;
  opensAt: string | null;
  closesAt: string | null;
  closedAt: string | null;
  createdAt: string;
  archivedAt: string | null;
  projectId: string | null;
  codeId: string | null;
  purgeAt: string | null;
  stats: { votes: number; sessions: number; counts: Record<string, number> };
}

export interface MProject {
  id: string;
  name: string;
}

export interface MCode {
  id: string;
  label: string;
  projectId: string | null;
  active: boolean;
  expiresAt: string | null;
  useCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface Overview {
  now: string;
  retentionDays: number;
  polls: MPoll[];
  projects: MProject[];
  codes: MCode[];
  generalCodeActive: boolean;
}

/** A master végpont hívása; a kód és a művelet neve mindig a végén áll, hogy ne írhassa felül a törzs. */
export function masterPost<T>(code: string, action: string, extra: Record<string, unknown> = {}): Promise<ApiResult<T>> {
  return post<T>('/api/master', { ...extra, masterCode: code, action });
}

/** Hibakód → felhasználói üzenet kulcsa. */
export function masterError(r: ApiResult<unknown>): MessageKey {
  const c = errorCode(r);
  if (c === 'invalid_master_code') return 'mErrCode';
  if (c === 'master_disabled') return 'mErrDisabled';
  if (r.status === 429) return 'errRate';
  if (c === 'running') return 'mErrRunning';
  if (c === 'already_open') return 'errAlreadyOpen';
  if (c === 'closed') return 'errPollClosed';
  if (c === 'name_taken') return 'mErrNameTaken';
  if (c === 'code_taken') return 'mErrCodeTaken';
  if (c === 'code_too_short' || c === 'code_invalid') return 'mErrCodeFormat';
  if (c === 'label_invalid' || c === 'name_invalid') return 'mErrName';
  if (c === 'expiry_invalid' || c === 'expiry_past') return 'mErrExpiry';
  if (c === 'project_not_found') return 'mErrProject';
  if (/^(opens_|closes_|window_)/.test(c)) return 'errSchedule';
  if (r.status === 400) return 'errValidation';
  return 'errGeneric';
}

const KEY = 's2v_master_session';

/** A master kód csak a böngésző munkamenetében (lap bezárásáig) marad meg. */
export function readSessionCode(): string {
  try {
    return sessionStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}
export function writeSessionCode(code: string): void {
  try {
    if (code) sessionStorage.setItem(KEY, code);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* nem kritikus: a kód a lap állapotában marad */
  }
}
