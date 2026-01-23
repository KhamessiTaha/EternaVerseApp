export const getStabilityStatus = (universe) => {
  const stability = universe?.currentState?.stabilityIndex || 1;
  if (stability > 0.8) return { text: 'Excellent', color: 'text-green-400', icon: '✓' };
  if (stability > 0.6) return { text: 'Good', color: 'text-lime-400', icon: '○' };
  if (stability > 0.4) return { text: 'Fair', color: 'text-yellow-400', icon: '△' };
  if (stability > 0.2) return { text: 'Poor', color: 'text-orange-400', icon: '!' };
  return { text: 'Critical', color: 'text-red-400', icon: '⚠' };
};

export const getCosmicPhase = (universe) => {
  const phase = universe?.currentState?.cosmicPhase || 'unknown';
  const phases = {
    dark_ages: { text: 'Dark Ages', icon: '🌑' },
    reionization: { text: 'Reionization', icon: '🌓' },
    galaxy_formation: { text: 'Galaxy Formation', icon: '🌌' },
    stellar_peak: { text: 'Stellar Peak', icon: '⭐' },
    gradual_decline: { text: 'Gradual Decline', icon: '🌅' },
    twilight_era: { text: 'Twilight Era', icon: '🌆' },
    degenerate_era: { text: 'Degenerate Era', icon: '🌃' }
  };
  return phases[phase] || { text: phase, icon: '❓' };
};