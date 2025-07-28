/**
 * Returns the percentage position (between -100-100) of score between minScore and maxScore.
 * @param {number} score
 * @param {number} minScore
 * @param {number} maxScore
 * @returns {number}
 */
export function getScaledScoreFromMinMax(score, minScore, maxScore) {
  // range split into negative/positive ranges (rather than min-max normalization) depending on score
  // this gives a negative range of -100 to 0 where -100 is the min score
  // and a positive range of 0 to 100 where 100 is the max score
  // -50% and +50% can therefore represent different absolute quantities of score
  const range = (score < 0) ? Math.abs(minScore) : maxScore;
  if (!range) return 0;
  return Math.round((score / range) * 100);
}
