import { tr } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/** Full-screen camera that reports the first EAN/UPC it reads. Loaded lazily: the decoder is large. */
export function Scanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { BarcodeDetector } = await import('barcode-detector/ponyfill');
        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (cancelled || done.current || !video.current) return;
          const codes = await detector.detect(video.current).catch(() => []);
          const code = codes.find((c) => /^\d{8,14}$/.test(c.rawValue))?.rawValue;
          if (code) {
            done.current = true;
            navigator.vibrate?.(60);
            onCode(code);
            return;
          }
          timer = setTimeout(() => void tick(), 250);
        };
        void tick();
      } catch (e) {
        setError(e instanceof DOMException && e.name === 'NotAllowedError'
          ? tr('Немає доступу до камери. Дозвольте його в налаштуваннях браузера.')
          : tr('Не вдалося увімкнути камеру.'));
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black text-white">
      <video ref={video} className="h-full w-full object-cover" playsInline muted />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="h-40 w-72 rounded-3xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
      </div>
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
        <span className="font-extrabold">{tr('Наведіть на штрихкод')}</span>
        <button className="ot-btn ot-btn--icon ot-btn--outline" aria-label={tr('Закрити')} onClick={onClose}><X className="ot-icon" /></button>
      </div>
      {error && <p className="absolute inset-x-4 bottom-10 rounded-2xl bg-black/80 p-4 text-center font-bold">{error}</p>}
    </div>
  );
}
