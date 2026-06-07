const COMPETITION_SCORE_MAP = {
  LOW: 30,
  MEDIUM: 60,
  HIGH: 90,
  낮음: 30,
  중간: 60,
  높음: 90
};

export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

export function parseNaverNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const text = String(value).trim();
  if (text.includes('<')) return 5;

  const parsed = Number(text.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeSearchVolume(totalSearch) {
  if (!totalSearch) return 0;
  return clamp((Math.log10(totalSearch + 1) / Math.log10(100000 + 1)) * 100);
}

export function normalizeCtr(ctr) {
  return clamp((Number(ctr) / 10) * 100);
}

export function getCompetitionScore(competition) {
  const key = String(competition || '').trim().toUpperCase();
  return COMPETITION_SCORE_MAP[key] || COMPETITION_SCORE_MAP[String(competition || '').trim()] || 50;
}

export function normalizeDepth(averageDepth) {
  return clamp((Number(averageDepth) / 15) * 100);
}

function calculateVolumeCompetitionAdjustment(totalSearch, competitionScore) {
  const volumeScore = normalizeSearchVolume(totalSearch);

  if (volumeScore >= 70 && competitionScore >= 80) return 100;
  if (volumeScore < 25 && competitionScore >= 80) return 85;
  if (volumeScore >= 50 && competitionScore >= 60) return 70;
  return clamp((volumeScore + competitionScore) / 2);
}

export function calculateSaturationScore({ competition, averageDepth, totalSearch }) {
  const competitionScore = getCompetitionScore(competition);
  const depthScore = normalizeDepth(averageDepth);
  const adjustmentScore = calculateVolumeCompetitionAdjustment(totalSearch, competitionScore);

  return Math.round(clamp(competitionScore * 0.6 + depthScore * 0.25 + adjustmentScore * 0.15));
}

export function calculateEfficiencyScore({
  totalSearch,
  averageCtr,
  competition,
  mobileRatio,
  saturationScore
}) {
  const volumeScore = normalizeSearchVolume(totalSearch);
  const ctrScore = normalizeCtr(averageCtr);
  const competitionReverseScore = 100 - getCompetitionScore(competition);
  const saturationReverseScore = 100 - saturationScore;

  return Math.round(
    clamp(
      volumeScore * 0.35 +
        ctrScore * 0.25 +
        competitionReverseScore * 0.2 +
        clamp(mobileRatio) * 0.1 +
        saturationReverseScore * 0.1
    )
  );
}
