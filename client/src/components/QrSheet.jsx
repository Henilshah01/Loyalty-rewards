import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export const QR_SHEET_LIMIT = 500; // larger batches: use the CSV with your printer's QR tool

/**
 * Printable sheet of QR labels. Each QR opens `${base}/claim?code=…`.
 * On screen: a short preview. In print: the full grid (see .print-only in styles.css).
 */
export default function QrSheet({ codes, base, product, points }) {
  const list = codes.slice(0, QR_SHEET_LIMIT);
  const [svgs, setSvgs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setSvgs([]);
    (async () => {
      const out = [];
      for (let i = 0; i < list.length; i++) {
        out.push(await QRCode.toString(`${base}/claim?code=${list[i]}`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }));
        if (i % 50 === 49) {
          if (cancelled) return;
          setSvgs([...out]);
          await new Promise((r) => setTimeout(r)); // let the browser paint between chunks
        }
      }
      if (!cancelled) setSvgs(out);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes, base]);

  const ready = svgs.length === list.length;
  const label = (svg, i) => (
    <figure className="qr-label" key={i}>
      {/* SVG text is produced by the qrcode library from our own data */}
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption>
        <span className="mono">{list[i]}</span>
        <span>{product} · {points} points</span>
      </figcaption>
    </figure>
  );

  return (
    <div>
      <div className="row between">
        <strong>QR labels</strong>
        <button className="btn" onClick={() => window.print()} disabled={!ready}>
          {ready ? `Print ${list.length} labels` : `Preparing ${svgs.length}/${list.length}…`}
        </button>
      </div>
      {codes.length > QR_SHEET_LIMIT && (
        <p className="note bad">The sheet holds the first {QR_SHEET_LIMIT} codes. For the rest, give the CSV to your printer.</p>
      )}
      <div className="qr-preview">{svgs.slice(0, 6).map(label)}</div>
      <div className="print-only">{svgs.map(label)}</div>
    </div>
  );
}
