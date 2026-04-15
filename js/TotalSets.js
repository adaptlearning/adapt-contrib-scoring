import Adapt from 'core/js/adapt';
import Passmark from './Passmark';
import ScoringSet from './ScoringSet';
import {
  createIntersectedSet
} from './utils/intersection';
import {
  filterSetsByIntersectingModels
} from './utils/sets';
import {
  unique,
  sum
} from './utils/math';

/**
 * A set of sets, it can sum the scores of the root or intersecting sets.
 *
 * It extends `ScoringSet` with the caveat that it sums properties from root or
 * intersecting scoring sets and completion sets rather than root or intersecting models.
 *
 * It represents the overall completion, score, correctness, pass and fail of the course.
 */
export default class TotalSets extends ScoringSet {

  /**
   * @param {Object} [options]
   * @param {Backbone.Model} [options._model=null] Model of set configuration
   * @param {Backbone.Model} [options.model=null] Human readable alternative for _model
   * @param {IntersectionSet} [options.intersectionParent=null] System defined intersection parent
   */
  initialize(options = {}) {
    this._config = (options._model ?? options.model).get('_scoring');
    super.initialize({
      ...options,
      _id: this._config._id || 'total',
      _title: this._config.title || 'Total score',
      _type: 'total',
      _isScoreIncluded: false,
      _isCompletionRequired: false
    });
    this._passmark = new Passmark(this._config?._passmark);
  }

  /** @override */
  get order() {
    return 600;
  }

  /**
   * Returns all models from sets marked with `_isScoreIncluded` or `_isCompletionRequired`, filtered and intersected where appropriate.
   * @override
   * @returns {Backbone.Model[]}
   */
  get models() {
    const allScoringSets = Adapt.scoring.sets.filter(({ isScoreIncluded }) => isScoreIncluded);
    const allCompletionSets = Adapt.scoring.sets.filter(({ isCompletionRequired }) => isCompletionRequired);
    const models = unique([
      ...allScoringSets.flatMap(({ models }) => models),
      ...allCompletionSets.flatMap(({ models }) => models)
    ]);
    return this.filterModels(models);
  }

  /**
   * Returns all sets marked with `_isScoreIncluded` which intersect the models.
   * @returns {ScoringSet[]}
   */
  get scoringSets() {
    const allScoringSets = Adapt.scoring.sets.filter(({ isScoreIncluded }) => isScoreIncluded);
    const sets = filterSetsByIntersectingModels(allScoringSets, this.models);
    if (this.isIntersectedSet) {
      return sets.map(set => createIntersectedSet([this, set]));
    }
    return sets;
  }

  /**
   * Returns all sets marked with `_isCompletionRequired` which intersect the models.
   * @returns {ScoringSet[]}
   */
  get completionSets() {
    const allCompletionSets = Adapt.scoring.sets.filter(({ isCompletionRequired }) => isCompletionRequired);
    const sets = filterSetsByIntersectingModels(allCompletionSets, this.models);
    if (this.isIntersectedSet) {
      return sets.map(set => createIntersectedSet([this, set]));
    }
    return sets;
  }

  /**
   * Returns the minimum score of all `_isScoreIncluded` subsets.
   * @override
   * @returns {number}
   */
  get minScore() {
    return sum(this.scoringSets, 'minScore');
  }

  /**
   * Returns the maximum score of all `_isScoreIncluded` subsets.
   * @override
   * @returns {number}
   */
  get maxScore() {
    return sum(this.scoringSets, 'maxScore');
  }

  /**
   * Returns the score of all `_isScoreIncluded` subsets.
   * @override
   * @returns {number}
   */
  get score() {
    return sum(this.scoringSets, 'score');
  }

  /**
   * Returns the number of correctly answered available questions.
   * @override
   * @returns {number}
   */
  get correctness() {
    return sum(this.scoringSets, 'correctness');
  }

  /**
   * Returns the number of available questions.
   * @override
   * @returns {number}
   */
  get maxCorrectness() {
    return sum(this.scoringSets, 'maxCorrectness');
  }

  /**
   * Returns the passmark model.
   * @returns {Passmark}
   */
  get passmark() {
    return this._passmark;
  }

  /**
   * Returns whether all root sets marked with `_isCompletionRequired` are completed.
   * @override
   * @returns {boolean}
   */
  get isComplete() {
    return this.completionSets.every(set => set.isComplete);
  }

  /**
   * Returns whether the configured passmark has been achieved for `_isScoreIncluded` sets.
   * If _passmark._requiresPassedSubsets then all scoring subsets have to be passed.
   * @override
   * @returns {boolean}
   */
  get isPassed() {
    // if (!this.isComplete) return false; // must be completed for a pass
    // if (!this.passmark.isEnabled && this.isComplete) return true; // always pass if complete and passmark is disabled
    const isEverySubsetPassed = this.scoringSets.every(set => set.isPassed);
    const isScaled = this.passmark.isScaled;
    const score = (isScaled) ? this.scaledScore : this.score;
    const correctness = (isScaled) ? this.scaledCorrectness : this.correctness;
    const isPassed = score >= this.passmark.score && correctness >= this.passmark.correctness;
    return this.passmark.requiresPassedSubsets ? isPassed && isEverySubsetPassed : isPassed;
  }

  /**
   * Returns whether any root sets marked with `_isScoreIncluded` are failed and cannot be reset.
   * @override
   * @todo Add `canReset` to `ScoringSet`?
   * @returns {boolean}
   */
  get isFailed() {
    return this.isComplete && !this.isPassed && !this.canReset;
  }

  /**
   * Returns whether any root sets marked with `_isScoreIncluded` can be reset.
   * @override
   * @returns {boolean}
   */
  get canReset() {
    return this.scoringSets.some(set => set?.canReset);
  }

}
