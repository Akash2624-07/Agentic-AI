import { dismissToast, useToasts } from '../lib/toast';
import { Icon } from './Icon';

export function Toasts() {
  const toasts = useToasts();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'ok' ? 'check' : 'info'} />
          <div>
            <strong>{t.title}</strong>
            {t.body && (
              <div className="small ink2" style={{ marginTop: 2 }}>
                {t.body}
              </div>
            )}
          </div>
          <button
            className="icon-btn x"
            style={{ width: 26, height: 26 }}
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss"
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
