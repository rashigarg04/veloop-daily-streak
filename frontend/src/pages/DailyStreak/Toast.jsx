import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import styles from "./DailyStreak.module.css";

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
};

const CLASS_BY_TYPE = {
  success: styles.toastSuccess,
  error: styles.toastError,
  warning: styles.toastWarning,
};

export default function Toast({ toasts, onDismiss }) {
  return (
    <div className={styles.toastWrap}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const Icon = ICONS[toast.type] || ICONS.success;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className={`${styles.toast} ${CLASS_BY_TYPE[toast.type]}`}>
      <Icon size={18} />
      <span>{toast.message}</span>
    </div>
  );
}