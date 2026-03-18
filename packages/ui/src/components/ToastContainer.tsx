import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore, type ToastType } from '../stores/toastStore';

const STYLES: Record<ToastType, { border: string; icon: typeof CheckCircle; iconColor: string }> = {
  success: { border: 'border-cc-green-border', icon: CheckCircle,    iconColor: 'text-cc-green-text' },
  error:   { border: 'border-cc-red-border',     icon: AlertCircle,    iconColor: 'text-cc-red-text'     },
  warning: { border: 'border-cc-yellow-border',  icon: AlertTriangle,  iconColor: 'text-cc-yellow-text'  },
  info:    { border: 'border-cc-blue-border',    icon: Info,           iconColor: 'text-cc-blue-text'    },
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const { border, icon: Icon, iconColor } = STYLES[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              className={`bg-cc-bg ${border} border rounded-lg px-4 py-3 flex items-start gap-3 min-w-[260px] max-w-[360px] shadow-xl pointer-events-auto`}
            >
              <Icon size={14} className={`${iconColor} shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-cc-text">{toast.title}</div>
                {toast.message && (
                  <div className="text-xs text-cc-text-secondary mt-0.5">{toast.message}</div>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-cc-text-muted hover:text-cc-text-secondary shrink-0 transition-colors"
              >
                <X size={13} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
