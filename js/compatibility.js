import Adapt from 'core/js/adapt';
import {
  findSetById
} from './utils/sets';

/** @typedef {import("./adapt-contrib-scoring").Scoring} Scoring */

// Compatibility layer for adapt-contrib-assessment components and extensions

/**
 * Returns whether the plugin is functioning as `Adapt.assessment`
 * @returns {boolean}
 */
export function isBackwardCompatible(scoring) {
  return scoring.total._config?._isBackwardCompatible ?? false;
}

/**
 * Polyfill for Adapt.assessment
 * @param {Scoring} scoring
 */
export function setupBackwardCompatibility(scoring) {
  if (!isBackwardCompatible(scoring)) return;
  Adapt.assessment = {
    get: id => {
      return findSetById(Adapt.scoring.sets, id)?.model;
    },
    getState: () => getCompatibilityState(scoring)
  };
  Adapt
    .off('scoring:restored', onScoringRestored)
    .on('scoring:restored', onScoringRestored);
  Adapt
    .off('scoring:complete', onScoringComplete)
    .on('scoring:complete', onScoringComplete);
}

/**
 * Polyfill for assessmentState
 * @param {Scoring} scoring
 */
export function getCompatibilityState(scoring) {
  const state = {
    isComplete: scoring.total.isComplete,
    isPercentageBased: scoring.total.passmark.isScaled,
    isPass: scoring.total.isPassed,
    maxScore: scoring.total.maxScore,
    minScore: scoring.total.minScore,
    score: scoring.total.score,
    scoreToPass: scoring.total.passmark.score,
    scoreAsPercent: scoring.total.scaledScore,
    correctCount: scoring.total.correctness,
    correctAsPercent: scoring.total.scaledCorrectness,
    correctToPass: scoring.total.passmark.correctness,
    questionCount: scoring.total.availableQuestions.length,
    assessmentsComplete: scoring.total.scoringSets.filter(set => set.isComplete).length,
    assessments: scoring.total.scoringSets.length,
    canRetry: scoring.total.canReset
  };
  return state;
}

/**
 * Polyfill for triggering assessment:restored event
 * @param {Scoring} scoring
 * @fires Adapt#assessment:restored
 */
function onScoringRestored(scoring) {
  Adapt.trigger('assessment:restored', getCompatibilityState(scoring));
}

/**
 * Polyfill for triggering assessment:complete event
 * @param {Scoring} scoring
 * @fires Adapt#assessment:complete
 */
function onScoringComplete(scoring) {
  Adapt.trigger('assessment:complete', getCompatibilityState(scoring));
}
