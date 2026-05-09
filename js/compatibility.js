import Adapt from 'core/js/adapt';
import {
  findSetById
} from './utils/sets';
/** @typedef {import("./adapt-contrib-scoring").Scoring} Scoring */
/** @typedef {import("./TotalSets").default} TotalSets */

// Compatibility layer for adapt-contrib-assessment components and extensions

/**
 * Returns whether the plugin is functioning as `Adapt.assessment`
 * @returns {boolean}
 */
export function isBackwardCompatible(scoring) {
  return scoring.total._config?._isBackwardCompatible ?? false;
}

/**
 * Polyfill for Adapt.assessment.
 * @param {Scoring} scoring
 */
export function setupBackwardCompatibility(scoring) {
  if (!isBackwardCompatible(scoring)) return;
  Adapt.assessment = {
    get: id => {
      return findSetById(Adapt.scoring.sets, id)?.model;
    },
    getState: () => getCompatibilityState(scoring.total)
  };
  Adapt
    .off('scoring:total:restored', onScoringRestored)
    .on('scoring:total:restored', onScoringRestored);
  Adapt
    .off('scoring:total:complete', onScoringComplete)
    .on('scoring:total:complete', onScoringComplete);
}

/**
 * Polyfill for assessmentState.
 * @param {TotalSets} total
 */
export function getCompatibilityState(total) {
  const state = {
    isComplete: total.isComplete,
    isPercentageBased: total.passmark.isScaled,
    isPass: total.isPassed ?? total.isComplete,
    maxScore: total.maxScore,
    minScore: total.minScore,
    score: total.score,
    scoreToPass: total.passmark.score,
    scoreAsPercent: total.scaledScore,
    correctCount: total.correctness,
    correctAsPercent: total.scaledCorrectness,
    correctToPass: total.passmark.correctness,
    questionCount: total.availableQuestions.length,
    assessmentsComplete: total.scoringSets.filter(set => set.isComplete).length,
    assessments: total.scoringSets.length,
    canRetry: total.canReset
  };
  return state;
}

/**
 * Polyfill for triggering assessment:restored event.
 * @param {TotalSets} total
 * @fires Adapt#assessment:restored
 */
function onScoringRestored(total) {
  Adapt.trigger('assessment:restored', getCompatibilityState(total));
}

/**
 * Polyfill for triggering assessment:complete event.
 * @param {TotalSets} total
 * @fires Adapt#assessment:complete
 */
function onScoringComplete(total) {
  Adapt.trigger('assessment:complete', getCompatibilityState(total));
}
