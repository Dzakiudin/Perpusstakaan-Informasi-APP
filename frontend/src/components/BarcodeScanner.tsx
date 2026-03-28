import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
    onScan: (code: string) => void;
    onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
    const [error, setError] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let isActive = true;
        let scannerInstance: Html5Qrcode | null = null;

        const startScanner = async () => {
            if (!containerRef.current) return;

            try {
                const scanner = new Html5Qrcode('barcode-scanner');
                scannerInstance = scanner;
                scannerRef.current = scanner;

                await scanner.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 150 },
                    },
                    (decodedText) => {
                        if (isActive && scanner.isScanning) {
                            onScan(decodedText);
                            scanner.stop().catch(() => { });
                        }
                    },
                    () => {
                        // Ignore errors during scanning
                    }
                );
            } catch (err: any) {
                console.error('Scanner error:', err);
                if (isActive) {
                    setError(err?.message || 'Gagal memulai kamera');
                }
            }
        };

        startScanner();

        return () => {
            isActive = false;
            if (scannerInstance && scannerInstance.isScanning) {
                scannerInstance.stop().catch(() => { });
            }
        };
    }, [onScan]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center">
                        <span className="material-icons-round text-primary mr-2">qr_code_scanner</span>
                        Scan Barcode / QR
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                    >
                        <span className="material-icons-round">close</span>
                    </button>
                </div>
                <div className="p-4">
                    {error ? (
                        <div className="text-center py-8">
                            <span className="material-icons-round text-5xl text-red-400 mb-3">error</span>
                            <p className="text-red-500 mb-4">{error}</p>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                            >
                                Tutup
                            </button>
                        </div>
                    ) : (
                        <>
                            <div
                                id="barcode-scanner"
                                ref={containerRef}
                                className="w-full aspect-[4/3] bg-black rounded-xl overflow-hidden"
                            />
                            <p className="text-center text-sm text-slate-500 mt-4">
                                Arahkan kamera ke barcode atau QR code
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
