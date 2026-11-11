import { useState } from 'react';
import { Download, Share } from 'lucide-react';
import type { SavedReport } from '@/app/weeklyReport';
import { BottomSheet, PrimaryButton, SecondaryButton, SegmentedControl } from '@/components/kit';
import type { ReportLang, ReportMode } from './ReportView';
import type { PdfThemeName } from './pdf/theme';

/**
 * Download the report as a PDF, made on the phone (nothing is sent anywhere). Quick or Full,
 * dark like the screen or Print friendly. The PDF code and its fonts load only here.
 */
export function DownloadSheet(props: {
  open: boolean;
  onClose: () => void;
  saved: SavedReport | null;
  number: number;
  lang: ReportLang;
}) {
  return (
    <BottomSheet open={props.open} onClose={props.onClose} title="Download your report" subtitle="A PDF made on your phone">
      {props.open && props.saved ? <DownloadForm {...props} saved={props.saved} /> : null}
    </BottomSheet>
  );
}

async function fontBytes() {
  const urls = await Promise.all([
    import('@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-600-normal.woff?url'),
    import('@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff?url'),
    import('@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff?url'),
    import('@fontsource/dm-sans/files/dm-sans-latin-600-normal.woff?url'),
    import('@fontsource/dm-mono/files/dm-mono-latin-400-normal.woff?url'),
    import('@fontsource/dm-mono/files/dm-mono-latin-500-normal.woff?url'),
  ]);
  const bytes = await Promise.all(
    urls.map(async (m) => {
      const res = await fetch(m.default);
      if (!res.ok) throw new Error(`font ${res.status}`);
      return res.arrayBuffer();
    }),
  );
  const [display600, display800, sans400, sans600, mono400, mono500] = bytes as [ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer];
  return { display600, display800, sans400, sans600, mono400, mono500 };
}

function DownloadForm({ saved, number, lang }: { saved: SavedReport; number: number; lang: ReportLang }) {
  const [mode, setMode] = useState<ReportMode>('full');
  const [theme, setTheme] = useState<PdfThemeName>('dark');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const canShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
  const fileName = `macrotrophy-report-${saved.weekStart}${mode === 'quick' ? '-quick' : ''}.pdf`;

  async function make(): Promise<File> {
    const [{ makeReportPdf }, fonts] = await Promise.all([import('./pdf/makePdf'), fontBytes()]);
    const bytes = await makeReportPdf({ report: saved.report, number, mode, lang, theme, fonts });
    return new File([bytes as BlobPart], fileName, { type: 'application/pdf' });
  }

  async function run(share: boolean) {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const file = await make();
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        setDone('Shared.');
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        setDone('Saved to your downloads.');
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.error('[report] pdf failed', e);
      setError(
        navigator.onLine === false
          ? 'The PDF needs a connection the first time. Connect and try again.'
          : 'Could not make the PDF. Try again, or reload the app if it keeps happening.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-report-download-sheet>
      <div className="flex flex-col gap-2">
        <span className="type-footnote text-text-2">Length</span>
        <SegmentedControl
          label="Length"
          block
          value={mode}
          onChange={setMode}
          options={[
            { value: 'quick', label: 'Quick summary' },
            { value: 'full', label: 'Full report' },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="type-footnote text-text-2">Look</span>
        <SegmentedControl
          label="Look"
          block
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Print friendly' },
          ]}
        />
      </div>
      {error ? (
        <p role="alert" className="type-footnote text-danger-text">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="type-footnote text-up">
          {done}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        {canShare ? (
          <PrimaryButton block icon={<Share aria-hidden />} loading={busy} onClick={() => void run(true)}>
            Share PDF
          </PrimaryButton>
        ) : null}
        {canShare ? (
          <SecondaryButton block icon={<Download aria-hidden />} disabled={busy} onClick={() => void run(false)} data-report-save-pdf>
            Save PDF
          </SecondaryButton>
        ) : (
          <PrimaryButton block icon={<Download aria-hidden />} loading={busy} onClick={() => void run(false)} data-report-save-pdf>
            Save PDF
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}
