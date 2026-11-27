import { useEffect, useRef, useState } from 'react';
import { useLang, type MessageKey } from '../i18n';
import { errorCode, post } from '../lib/api';

const DIGITS = 6;

interface Props {
  onSignedIn: (role: 'master' | 'editor', code: string, projectName: string | null) => void;
}

/**
 * Közös belépő oldal (master és szerkesztő): 6 jegyű számkód "kódzár" mezőkkel (egyetlen valódi beviteli mező fölött),
 * a lakat a sikeres belépésnél kinyílik. A forgó NKE logó a panel alatt van.
 */
export function PadlockSignIn({ onSignedIn }: Props) {
  const { t } = useLang();
  const [value, setValue] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'error' | 'ok'>('idle');
  const [message, setMessage] = useState<MessageKey | ''>('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function check(code: string) {
    setState('checking');
    setMessage('');
    const r = await post<{ role: 'master' | 'editor'; projectName?: string | null }>('/api/signin', { code });
    if (r.ok) {
      setState('ok');
      const { role, projectName } = r.data as { role: 'master' | 'editor'; projectName?: string | null };
      // Rövid szünet, hogy a lakat nyitása látszódjon (csökkentett mozgásnál nincs késleltetés).
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      setTimeout(() => onSignedIn(role, code, projectName ?? null), reduce ? 0 : 600);
      return;
    }
    setState('error');
    setMessage(r.status === 429 ? 'siLocked' : errorCode(r) === 'invalid_code' ? 'siError' : 'errGeneric');
    setValue('');
  }

  // A hibás kód után újra a mezőre kerül a fókusz (a mező a próbálkozás alatt le volt tiltva).
  useEffect(() => {
    if (state === 'error') inputRef.current?.focus();
  }, [state]);

  function onChange(raw: string) {
    // Csak számjegyek (beillesztett, szóközzel vagy kötőjellel tagolt kód is jó).
    const digits = raw.replace(/\D/g, '').slice(0, DIGITS);
    setValue(digits);
    if (state === 'error') setState('idle');
    if (digits.length === DIGITS) void check(digits);
  }

  const busy = state === 'checking' || state === 'ok';
  return (
    <div className="signin">
      <form
        className="padlock-card"
        data-state={state}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (value.length === DIGITS && !busy) void check(value);
        }}
      >
        <h1>{t('siTitle')}</h1>
        <p className="padlock-text">{t('siText')}</p>

        <svg className="padlock-shackle" viewBox="0 0 80 52" aria-hidden="true" focusable="false">
          <path d="M20 48V28a20 20 0 0 1 40 0v20" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
        </svg>
        <div className={`padlock-body${focused ? ' focused' : ''}`} onClick={() => inputRef.current?.focus()}>
          {Array.from({ length: DIGITS }, (_, i) => (
            <span key={i} className={`pbox${value.length === i ? ' cur' : ''}${value[i] ? ' filled' : ''}`} aria-hidden="true">
              {value[i] ?? '–'}
            </span>
          ))}
          <input
            ref={inputRef}
            className="padlock-input"
            aria-label={t('siLabel')}
            aria-describedby="si-help"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            spellCheck={false}
            maxLength={DIGITS + 4}
            value={value}
            disabled={busy}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>

        <p id="si-help" className="padlock-hint">
          {t('siHelp')}
        </p>
        <p role={state === 'error' ? 'alert' : 'status'} className="padlock-status">
          {state === 'checking' && t('siChecking')}
          {state === 'ok' && t('siOk')}
          {state === 'error' && message && t(message)}
        </p>
        <button type="submit" className="button padlock-btn" disabled={busy || value.length !== DIGITS}>
          {t('siSubmit')}
        </button>
      </form>

      {/* Forgó NKE logó; csökkentett mozgás beállításnál álló kép */}
      <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet="/brand/nke-logo-still.png" />
        <img className="signin-logo" src="/brand/nke-logo-spin.gif" alt="" width={112} height={112} />
      </picture>
    </div>
  );
}
