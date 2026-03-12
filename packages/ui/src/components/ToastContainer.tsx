import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, type ToastType } from '../stores/toastStore';

const STYLES: Record<ToastType, { border: string; icon: typeof CheckCircle; iconColor: string }> = {
  success: { border: 'border-emerald-500/50', icon: CheckCircle,    iconColor: 'text-emerald-400' },
  error:   { border: 'border-red-500/50',     icon: AlertCircle,    iconColor: 'text-red-400'     },
  warning: { border: 'border-yellow-500/50',  icon: AlertTriangle,  iconColor: 'text-yellow-400'  },
  info:    { border: 'border-blue-500/50',    icon: Info,           iconColor: 'text-blue-400'    },
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const { border, icon: Icon, iconColor } = STYLES[toast.type];
        return (
          <div
            key={toast.id}
            className={`bg-gray-900 ${border} border rounded-lg px-4 py-3 flex items-start gap-3 min-w-[260px] max-w-[360px] shadow-xl pointer-events-auto toast-enter`}
          >
            <Icon size={14} className={`${iconColor} shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-100">{toast.title}</div>
              {toast.message && (
                <div className="text-xs text-gray-400 mt-0.5">{toast.message}</div>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-600 hover:text-gray-400 shrink-0 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
