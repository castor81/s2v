import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useLang } from '../i18n';

function download(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
}

/** QR-kód a szavazói címhez, PNG/SVG letöltéssel; a rövid cím a kód alatt is szerepel. */
export function QrBlock({ slug, voteUrl }: { slug: string; voteUrl: string }) {
  const { t } = useLang();
  const [png, setPng] = useState('');

  useEffect(() => {
    QRCode.toDataURL(voteUrl, { width: 512, margin: 2, errorCorrectionLevel: 'M' }).then(setPng);
  }, [voteUrl]);

  async function saveSvg() {
    const svg = await QRCode.toString(voteUrl, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' });
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    download(url, `s2v-${slug}.svg`);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="qr">
      {png && <img src={png} alt={t('qrAlt')} width={256} height={256} />}
      {/* A rövid cím a nyomtatott kód alatt is szerepeljen (hozzáférhetőség) */}
      <p className="qr-url">{voteUrl.replace(/^https?:\/\//, '')}</p>
      <div className="row">
        <button type="button" className="button" disabled={!png} onClick={() => download(png, `s2v-${slug}.png`)}>
          {t('downloadPng')}
        </button>
        <button type="button" className="button" onClick={saveSvg}>
          {t('downloadSvg')}
        </button>
      </div>
    </div>
  );
}
