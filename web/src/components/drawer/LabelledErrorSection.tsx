import type { LabelledError } from '../../api/types';
import { formatNumber, formatValue, formatVersion } from '../../lib/format';
import { Badge } from '../Badge';

export function LabelledErrorSection({ error }: { error: LabelledError | null }) {
  return (
    <section>
      <div className="section-title">Labelled error (arrived this week)</div>
      {error ? (
        <>
          <dl className="kv">
            <dt>Labelled week</dt>
            <dd className="num">{error.week}</dd>
            <dt>Model</dt>
            <dd>{formatVersion(error.version)}</dd>
            <dt>MAE</dt>
            <dd className="num">{formatNumber(error.mae)} bikes / hour</dd>
            <dt>WAPE / baseline</dt>
            <dd className="num">
              {formatValue(error.wape)} / {formatValue(error.baseline_wape)}
              {' = '}
              <b>{error.ratio === null ? '-' : `${error.ratio.toFixed(2)}×`}</b>{' '}
              {error.ratio !== null && error.ratio > 1.25 && <Badge tone="warn">above 1.25</Badge>}
            </dd>
            {error.shadow_version !== null && (
              <>
                <dt>Previous model (shadow)</dt>
                <dd className="num">
                  {formatVersion(error.shadow_version)} WAPE {formatValue(error.shadow_wape)}
                </dd>
              </>
            )}
          </dl>
          {!error.quality_ok && (
            <p className="small" style={{ marginTop: 8 }}>
              <Badge tone="bad">faulty inputs</Badge> That week failed quality checks, so the error alert ignores it.
            </p>
          )}
        </>
      ) : (
        <p className="small muted">No labels arrived this week.</p>
      )}
    </section>
  );
}
