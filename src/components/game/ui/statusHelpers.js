export const getStabilityColorKey = (universe) => {
  const stability = universe?.currentState?.stabilityIndex ?? 1;
  if (stability > 0.6) return 'accent';
  if (stability > 0.3) return 'warn';
  return 'critical';
};

export const getStabilityLabel = (universe) => {
  const stability = universe?.currentState?.stabilityIndex ?? 1;
  if (stability > 0.8) return 'Excellent';
  if (stability > 0.6) return 'Good';
  if (stability > 0.4) return 'Fair';
  if (stability > 0.2) return 'Poor';
  return 'Critical';
};

export const getCosmicPhaseLabel = (phase) => {
  const phases = {
    dark_ages: 'Dark Ages',
    reionization: 'Reionization',
    galaxy_formation: 'Galaxy Formation',
    stellar_peak: 'Stellar Peak',
    gradual_decline: 'Gradual Decline',
    twilight_era: 'Twilight Era',
    degenerate_era: 'Degenerate Era',
  };
  return phases[phase] || phase || 'Unknown';
};

export const formatTrend = (trend) => {
  if (!trend || Math.abs(trend) < 0.01) return '→ stable';
  if (trend > 0.05) return '↑ improving rapidly';
  if (trend > 0.01) return '↑ improving';
  if (trend > -0.05) return '↓ declining';
  return '↓ declining rapidly';
};
