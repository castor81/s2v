import { useLayoutEffect, useRef } from 'react';
import { pick, useLang } from '../i18n';
import { rankOptions } from '../lib/ranking';

interface Props {
  options: Array<{ id: string; hu?: string; en?: string }>;
  counts: Record<string, number>;
  total: number;
}

const MOVE_MS = 500;

/**
 * Eredménytábla szavazatszám szerint csökkenő sorrendben. A sorok átrendeződése animált (FLIP);
 * csökkentett mozgás beállításnál animáció nélkül. A szervezői és a szavazói nézet közös eleme.
 */
export function ResultsTable({ options, counts, total }: Props) {
  const { t, lang } = useLang();
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const prevTops = useRef(new Map<string, number>());
  const ranked = rankOptions(options, counts);

  useLayoutEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const next = new Map<string, number>();
    rowRefs.current.forEach((el, id) => {
      const top = el.offsetTop;
      next.set(id, top);
      const before = prevTops.current.get(id);
      if (reduce || before === undefined || before === top) return;
      el.style.transition = 'none';
      el.style.transform = `translateY(${before - top}px)`;
      void el.offsetHeight; // kényszerített újraszámolás: a kezdőállapot rögzül
      el.style.transition = `transform ${MOVE_MS}ms ease`;
      el.style.transform = '';
    });
    prevTops.current = next;
  }, [counts, options]);

  const nf = new Intl.NumberFormat(lang === 'hu' ? 'hu-HU' : 'en-GB', { maximumFractionDigits: 1 });
  const pct = (n: number) => `${nf.format(n * 100)} %`;

  return (
    <table className="results">
      <caption>{t('resultsHeading')}</caption>
      <thead>
        <tr>
          <th scope="col" className="rank">
            {t('colRank')}
          </th>
          <th scope="col">{t('colOption')}</th>
          <th scope="col">{t('colVotes')}</th>
          <th scope="col">{t('colShare')}</th>
        </tr>
      </thead>
      <tbody>
        {ranked.map(({ item, count, rank }) => {
          const share = total > 0 ? count / total : 0;
          return (
            <tr
              key={item.id}
              ref={(el) => {
                if (el) rowRefs.current.set(item.id, el);
                else rowRefs.current.delete(item.id);
              }}
            >
              <td className="num rank">{rank}.</td>
              <th scope="row">{pick(item, lang)}</th>
              <td className="num">{count}</td>
              <td>
                <div className="num">{pct(share)}</div>
                {/* A sáv csak szemléltet; az érték számként és szövegként is szerepel */}
                <div className="bar" aria-hidden="true">
                  <span style={{ width: `${share * 100}%` }} />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
