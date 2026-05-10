import type { ToastMessage } from "../../lib/types";

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const TOAST_STYLES = {
  success: "border-emerald-700 bg-emerald-950/80 text-emerald-300",
  error: "border-red-700 bg-red-950/80 text-red-300",
  warning: "border-amber-700 bg-amber-950/80 text-amber-300",
};

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg max-w-sm ${TOAST_STYLES[toast.type]}`}
        >
          <div className="flex-1">
            <p className="text-sm font-medium">{toast.title}</p>
            {toast.detail && (
              <p className="mt-1 text-xs opacity-70">{toast.detail}</p>
            )}
          </div>
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-xs opacity-50 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
