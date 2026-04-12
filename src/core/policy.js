// Trust-policy presets for action-level gating.
// Pure helpers: no network and no side effects.

const RISK_LEVELS = ['low', 'medium', 'high'];

export const TRUST_POLICY_PRESETS = {
  strict: {
    low: { minScore: 70, minConfidence: 0.5, allowRatings: ['high', 'medium'] },
    medium: { minScore: 80, minConfidence: 0.6, allowRatings: ['high'] },
    high: { minScore: 90, minConfidence: 0.75, allowRatings: ['high'] },
  },
  balanced: {
    low: { minScore: 55, minConfidence: 0.35, allowRatings: ['high', 'medium'] },
    medium: { minScore: 65, minConfidence: 0.45, allowRatings: ['high', 'medium'] },
    high: { minScore: 75, minConfidence: 0.55, allowRatings: ['high'] },
  },
  growth: {
    low: { minScore: 40, minConfidence: 0.25, allowRatings: ['high', 'medium', 'low'] },
    medium: { minScore: 55, minConfidence: 0.35, allowRatings: ['high', 'medium'] },
    high: { minScore: 70, minConfidence: 0.5, allowRatings: ['high', 'medium'] },
  },
};

function normalizeRisk(risk = 'medium') {
  const v = String(risk).toLowerCase();
  if (!RISK_LEVELS.includes(v)) throw new Error(`invalid risk level: ${risk}`);
  return v;
}

function resolvePreset(preset = 'balanced') {
  if (typeof preset === 'string') {
    const p = TRUST_POLICY_PRESETS[preset];
    if (!p) throw new Error(`unknown preset: ${preset}`);
    return p;
  }
  if (preset && typeof preset === 'object') return preset;
  throw new Error('invalid preset');
}

// report shape expected from getReputation() success envelope.
export function evaluateTrustPolicy(report, { preset = 'balanced', risk = 'medium' } = {}) {
  if (!report || report.ok !== true) {
    return {
      allow: false,
      reason: 'invalid_report',
      decision: { action: 'block', needsReview: true },
    };
  }

  const selectedRisk = normalizeRisk(risk);
  const policy = resolvePreset(preset);
  const rule = policy[selectedRisk];
  if (!rule) throw new Error(`missing rule for risk=${selectedRisk}`);

  const scorePass = Number(report.score) >= Number(rule.minScore ?? 0);
  const confidencePass = Number(report.confidence) >= Number(rule.minConfidence ?? 0);
  const ratingPass = Array.isArray(rule.allowRatings)
    ? rule.allowRatings.includes(report.rating)
    : true;

  const allow = Boolean(scorePass && confidencePass && ratingPass);
  const decision = allow
    ? { action: 'allow', needsReview: false }
    : (report.rating === 'unknown'
      ? { action: 'sandbox', needsReview: true }
      : { action: 'block', needsReview: true });

  return {
    allow,
    reason: allow ? 'threshold_met' : 'threshold_not_met',
    decision,
    checks: {
      score: { actual: report.score, min: rule.minScore, pass: scorePass },
      confidence: { actual: report.confidence, min: rule.minConfidence, pass: confidencePass },
      rating: { actual: report.rating, allow: rule.allowRatings, pass: ratingPass },
    },
    applied: { preset: typeof preset === 'string' ? preset : 'custom', risk: selectedRisk },
  };
}
