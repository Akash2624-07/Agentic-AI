import type { FeatureEvidence } from '../../api/types';
import { featureLabel } from '../../lib/features';
import { formatPercent, formatValue } from '../../lib/format';
import { Badge } from '../Badge';

const bold = (flagged: boolean) => (flagged ? { fontWeight: 700 } : undefined);

const dash = <span className="muted">-</span>;

export function FeatureEvidenceTable({ features }: { features: FeatureEvidence[] }) {
  if (!features.length) return null;
  const flagged = features.filter((feature) => feature.flags.length);
  return (
    <section>
      <div className="section-title">Input evidence per feature</div>
      <p className="small muted" style={{ marginBottom: 8 }}>
        {flagged.length
          ? `${flagged.length} feature${flagged.length > 1 ? 's' : ''} flagged.`
          : 'No feature flagged.'}
        {
          ' PSI applies to weather features, unseen to calendar features. KS p-values are evidence only (≈0 almost every week at 168 rows).'
        }
      </p>
      <div className="table-wrap card" style={{ boxShadow: 'none' }}>
        <table className="t" style={{ fontSize: 12.5 }}>
          <thead>
            <tr>
              <th>Feature</th>
              <th className="r" title="Missing or out-of-valid-domain share (fails above 5%)">
                Quality
              </th>
              <th className="r" title="PSI / calibrated threshold (drifted above 1)">
                PSI ratio
              </th>
              <th className="r" title="Share of calendar values the model never trained on (drifted above 5%)">
                Unseen
              </th>
              <th className="r" title="|change in weekly mean| / training std (jump above 3)">
                Jump
              </th>
              <th className="r" title="Kolmogorov-Smirnov p-value, evidence only">
                KS p
              </th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {features.map((feature) => {
              const quality = Math.max(feature.missing ?? 0, feature.out_of_domain ?? 0);
              return (
                <tr
                  key={feature.feature}
                  className={
                    feature.flags.includes('quality') || feature.flags.includes('jump')
                      ? 'fault-row'
                      : feature.flags.length
                        ? 'flag-row'
                        : undefined
                  }
                >
                  <td style={{ fontWeight: 600 }}>{featureLabel(feature.feature)}</td>
                  <td className="r" style={bold(quality > 0.05)}>
                    {quality === 0 ? <span className="muted">0</span> : formatPercent(quality, quality < 0.1 ? 1 : 0)}
                    {(feature.missing ?? 0) > 0.05 && <span className="tiny muted"> missing</span>}
                    {(feature.out_of_domain ?? 0) > 0.05 && <span className="tiny muted"> out of range</span>}
                  </td>
                  <td
                    className="r"
                    style={bold((feature.psi_ratio ?? 0) > 1)}
                    title={
                      feature.psi === null
                        ? undefined
                        : `PSI ${formatValue(feature.psi)} / threshold ${formatValue(feature.psi_threshold)}`
                    }
                  >
                    {feature.psi_ratio === null ? dash : formatValue(feature.psi_ratio)}
                  </td>
                  <td className="r" style={bold((feature.unseen ?? 0) > 0.05)}>
                    {feature.unseen === null ? dash : formatPercent(feature.unseen)}
                  </td>
                  <td className="r" style={bold((feature.jump ?? 0) > 3)}>
                    {feature.jump === null ? dash : formatValue(feature.jump)}
                  </td>
                  <td className="r muted">{formatValue(feature.ks_pvalue)}</td>
                  <td>
                    <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                      {feature.flags.map((flag) => (
                        <Badge key={flag} tone={flag === 'quality' ? 'bad' : flag === 'jump' ? 'serious' : 'info'}>
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
