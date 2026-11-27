import { useRef, useState } from 'react';
import { useLang, type Localized, type MessageKey } from '../i18n';
import { ImportError, SAMPLE_CSV, parseOptionsFile } from '../lib/importOptions';

const MIN = 2;
const MAX = 10;

interface Props {
  title: Localized;
  setTitle: (t: Localized) => void;
  options: Localized[];
  setOptions: (o: Localized[]) => void;
}

/** Egyetlen megjelenített szöveg (a felületi nyelv váltása nem fordítja a szavazás tartalmát). */
const text = (l: Localized) => l.hu ?? l.en ?? '';
/** A szöveget mindkét nyelvi mezőbe írjuk, így a szavazó a nyelvétől függetlenül ugyanazt látja. */
const both = (v: string): Localized => ({ hu: v, en: v });

/** A szavazás tartalma: cím és 2–10 válaszlehetőség (létrehozáshoz és módosításhoz közös). */
export function ContentFields({ title, setTitle, options, setOptions }: Props) {
  const { t } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  /** Fájl betöltése: a kitöltött lehetőségek megmaradnak, az importáltak (ismétlődés nélkül) utánuk kerülnek, legfeljebb MAX. */
  async function importFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const { items, skipped } = await parseOptionsFile(file);
      const kept = options.filter((o) => text(o).trim());
      const have = new Set(kept.map((o) => text(o).trim().toLowerCase()));
      const fresh = items.filter((i) => !have.has(i.toLowerCase()));
      const room = Math.max(0, MAX - kept.length);
      const added = fresh.slice(0, room);
      const next = [...kept, ...added.map(both)];
      while (next.length < MIN) next.push(both(''));
      setOptions(next);
      const dup = skipped + (items.length - fresh.length);
      const cut = fresh.length - added.length;
      setImportMsg({
        error: false,
        text: `${added.length} ${t('imLoaded')}${dup ? ` ${dup} ${t('imSkippedDup')}` : ''}${cut ? ` ${cut} ${t('imSkippedLimit')}` : ''}`,
      });
    } catch (e) {
      const code = e instanceof ImportError ? e.code : 'read';
      const key: Record<string, MessageKey> = { type: 'imErrType', size: 'imErrSize', empty: 'imErrEmpty', read: 'imErrRead' };
      setImportMsg({ error: true, text: t(key[code]) });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function downloadSample() {
    const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lehetosegek_minta.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="field">
        <label htmlFor="poll-title">{t('pollTitle')}</label>
        <input id="poll-title" maxLength={120} value={text(title)} onChange={(e) => setTitle(both(e.target.value))} />
      </div>

      <fieldset
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void importFile(e.dataTransfer.files[0]);
        }}
      >
        <legend>{t('optionsLegend')}</legend>
        <div className="row">
          <input
            ref={fileRef}
            id="opt-import"
            type="file"
            hidden
            accept=".xlsx,.csv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => void importFile(e.target.files?.[0])}
          />
          <button type="button" className="button" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? t('loading') : t('imBtn')}
          </button>
          <button type="button" className="button" onClick={downloadSample}>
            {t('imSample')}
          </button>
        </div>
        <p className="hint">{t('imHelp')}</p>
        {importMsg && (
          <p role={importMsg.error ? 'alert' : 'status'} className={importMsg.error ? 'error' : 'hint'}>
            {importMsg.text}
          </p>
        )}
        {options.map((o, i) => (
          <div key={i} className="option-row">
            <div className="field">
              <label htmlFor={`o-${i}`}>{`${t('optionN')} ${i + 1}`}</label>
              <input
                id={`o-${i}`}
                maxLength={80}
                value={text(o)}
                onChange={(e) => setOptions(options.map((x, idx) => (idx === i ? both(e.target.value) : x)))}
              />
            </div>
            {options.length > MIN && (
              <button type="button" className="button" onClick={() => setOptions(options.filter((_, idx) => idx !== i))}>
                {t('removeOption')} ({i + 1})
              </button>
            )}
          </div>
        ))}
        {options.length < MAX && (
          <button type="button" className="button" onClick={() => setOptions([...options, both('')])}>
            {t('addOption')}
          </button>
        )}
      </fieldset>
    </>
  );
}
