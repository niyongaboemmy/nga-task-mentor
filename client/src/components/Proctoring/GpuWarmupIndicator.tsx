import { useSyncExternalStore } from "react";
import { gpuWarmup } from "../../utils/gpuWarmup";

/**
 * "Preparing camera checks…" while the first detection compiles the
 * graphics card's programs (see utils/gpuWarmup). The page can't respond
 * for those seconds, so every moving part here is a CSS transform/opacity
 * animation: the browser runs those on the compositor, so they keep moving
 * while the page's thread is busy.
 */
export default function GpuWarmupIndicator() {
  const label = useSyncExternalStore(gpuWarmup.subscribe, gpuWarmup.snapshot, () => "");
  if (!label) return null;
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/40 nga-warm-fade"
      role="status"
      aria-live="polite"
      data-testid="gpu-warmup"
    >
      <style>{`
        @keyframes nga-warm-in { from { opacity: 0; transform: translateY(8px) scale(.98) } to { opacity: 1; transform: none } }
        @keyframes nga-warm-spin { to { transform: rotate(360deg) } }
        @keyframes nga-warm-bar { from { transform: translateX(-100%) } to { transform: translateX(250%) } }
        @keyframes nga-warm-pulse { 0%, 100% { transform: scale(.85); opacity: .5 } 50% { transform: scale(1); opacity: 1 } }
        .nga-warm-fade { animation: nga-warm-in .25s ease-out both }
        .nga-warm-spin { animation: nga-warm-spin .9s linear infinite; will-change: transform }
        .nga-warm-bar { animation: nga-warm-bar 1.3s cubic-bezier(.4,0,.2,1) infinite; will-change: transform }
        .nga-warm-pulse { animation: nga-warm-pulse 1.4s ease-in-out infinite; will-change: transform, opacity }
        @media (prefers-reduced-motion: reduce) {
          .nga-warm-spin, .nga-warm-bar, .nga-warm-pulse { animation-duration: 3s }
        }
      `}</style>
      <div className="nga-warm-fade mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-white p-6 text-center shadow-2xl dark:bg-gray-900">
        <div className="relative mx-auto h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-blue-900/50" />
          <div className="nga-warm-spin absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 border-r-blue-400" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="nga-warm-pulse block h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600" />
          </div>
        </div>
        <h2 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">{label}</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Getting your graphics card ready. This takes a few seconds the first time only.
        </p>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div className="nga-warm-bar h-full w-2/5 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" />
        </div>
      </div>
    </div>
  );
}
