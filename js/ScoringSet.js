import Adapt from 'core/js/adapt';
import Logging from 'core/js/logging';
import LifecycleSet from './LifecycleSet';
import {
  getScaledScoreFromMinMax
} from './utils/scoring';
import {
  sum
} from './utils/math';
import Objective from './Objective';

/**
 * The class provides an abstract that describes a set of models which can be extended with custom
 * scoring and completion behaviour.
 * Derivative class instances should act as both a root set of models (test-blocks) and an
 * intersected set of models (retention-question-components vs test-blocks).
 * Set intersections are performed by comparing overlapping hierarchies, such that a model will be
 * considered in both sets when it is equal to, a descendant of or an ancestor of a model in the intersecting
 * set. A test-block may contain a retention-question-component, a retention-question-component
 * may be contained in a test-block and a test-block may be equal to a test-block.
 * The last intersected set will always provide the returned set Class pertaining to its abstraction,
 * such that retention-question-components vs test-blocks would always give a subset of
 * test-blocks whereas test-blocks vs retention-question-components will always
 * give a subset of retention-question-components.
 * Intersected sets will always only include models from their prospective set.
 */

/**
 * Set at which intersections and queries can be performed.
 * Set at which lifecycle phases, callbacks and triggers can be utilised.
 * Set at which scoring, correctness and completion calculations can be performed.
 */
export default class ScoringSet extends LifecycleSet {

  /**
   * @param {Object} [options]
   * @param {string} [options._id=null] Unique set id
   * @param {string} [options._type=null] Type of set
   * @param {string} [options._title=null] Set title
   * @param {Backbone.Model} [options._model=null] Model of set configuration or orientation
   * @param {Backbone.Model[]} [options._models=null] Models which belong to the set
   * @param {string} [options.title=null] Human readable alternative for _title
   * @param {Backbone.Model} [options.model=null] Human readable alternative for _model
   * @param {Backbone.Model[]} [options.models=null] Human readable alternative for _models
   * @param {IntersectionSet} [options.intersectionParent=null] System defined intersection parent
   * @param {boolean} [options._isScoreIncluded=false]
   * @param {boolean} [options._isCompletionRequired=false]
   */
  initialize(options = {}) {
    super.initialize(options);
    const {
      _isScoreIncluded = false,
      _isCompletionRequired = false
    } = options;
    this.isScoreIncluded = _isScoreIncluded;
    this.isCompletionRequired = _isCompletionRequired;
  }

  /** @override */
  get order() {
    return 500;
  }

  /**
   * Returns whether the set should be included in the total score.
   * @returns {boolean}
   */
  get isScoreIncluded() {
    return !this.isOptional && this.isAvailable && this._isScoreIncluded;
  }

  set isScoreIncluded(value) {
    this._isScoreIncluded = value;
  }

  /**
   * Returns whether the set needs to be completed.
   * @returns {boolean}
   */
  get isCompletionRequired() {
    return !this.isOptional && this.isAvailable && this._isCompletionRequired;
  }

  set isCompletionRequired(value) {
    this._isCompletionRequired = value;
  }

  /**
   * Returns the minimum score.
   * @returns {number}
   */
  get minScore() {
    return sum(this.availableQuestions, 'minScore');
  }

  /**
   * Returns the maximum score.
   * @returns {number}
   */
  get maxScore() {
    return sum(this.availableQuestions, 'maxScore');
  }

  /**
   * Returns the score.
   * @returns {number}
   */
  get score() {
    return sum(this.availableQuestions, 'score');
  }

  /**
   * Returns a percentage score relative to a positive minimum or zero and maximum values.
   * @returns {number}
   */
  get scaledScore() {
    return getScaledScoreFromMinMax(this.score, this.minScore, this.maxScore);
  }

  /**
   * Returns a score as a string to include "+" operator for positive scores.
   * @returns {string}
   */
  get scoreAsString() {
    const score = this.score;
    return (score > 0) ? `+${score.toString()}` : score.toString();
  }

  /**
   * Returns the number of correctly answered available questions.
   * @note Assumes the same number of questions are used in each attempt
   * @returns {number}
   */
  get correctness() {
    return sum(this.availableQuestions, model => (model.get('_isCorrect') ? 1 : 0));
  }

  /**
   * Returns the number of available questions.
   * @returns {number}
   */
  get maxCorrectness() {
    return this.availableQuestions.length;
  }

  /**
   * Returns the percentage of correctly answered questions.
   * @returns {number}
   */
  get scaledCorrectness() {
    return getScaledScoreFromMinMax(this.correctness, 0, this.maxCorrectness);
  }

  /**
   * Returns whether the set is completed.
   * query example: `(isComplete)` or `(isComplete=false)`
   * @returns {boolean}
   */
  get isComplete() {
    return this.model.get('_isComplete');
  }

  /**
   * Returns whether the set is incomplete.
   * query example: `(isIncomplete)` alias for `(isComplete=false)`
   * @returns {boolean}
   */
  get isIncomplete() {
    return (this.isComplete === false);
  }

  /**
   * Returns whether the configured passmark has been achieved.
   * query example: `(isPassed)`
   * @returns {boolean}
   */
  get isPassed() {
    Logging.error(`isPassed must be overridden for ${this.constructor.name}`);
  }

  /**
   * Returns whether the configured passmark has been failed.
   * query example: `(isFailed)` alias for `(isComplete,isPassed=false)`
   * @returns {boolean}
   */
  get isFailed() {
    return (this.isComplete && this.isPassed === false);
  }

  /**
   * The objective object for the set. See SCORM cmi.objectives.
   * @returns {Objective}
   */
  get objective() {
    if (this.isIntersectedSet) return;
    return (this._objective = this._objective || new Objective({ set: this }));
  }

  /** @override */
  async onInit() {
    if (this.isIntersectedSet) return;
    this.objective?.init();
    super.onInit();
  }

  /** @override */
  async onRestore() {
    if (this.isIntersectedSet) return;
    this._wasComplete = this.isComplete;
    this._wasPassed = this.isPassed;
    super.onRestore();
  }

  /** @override */
  async onUpdate() {
    if (this.isIntersectedSet) return;
    const isComplete = this.isComplete;
    if (isComplete && !this._wasComplete) this.onCompleted();
    const isPassed = this.isPassed;
    if (isPassed && !this._wasPassed) this.onPassed();
    this._wasComplete = isComplete;
    this._wasPassed = isPassed;
    super.onUpdate();
  }

  /**
   * Is executed on lifecycle update phase when isComplete=true.
   * @fires Adapt#scoring:[set.type]:complete
   * @fires Adapt#scoring:set:complete
   */
  async onCompleted() {
    if (this.isIntersectedSet) return;
    Adapt.trigger(`scoring:${this.type}:complete scoring:set:complete`, this);
    Logging.debug(`${this.id} completed`);
    this.objective?.complete();
  }

  /**
   * Is executed on lifecycle update phase when isPassed=true.
   * @fires Adapt#scoring:[set.type]:passed
   * @fires Adapt#scoring:set:passed
   */
  async onPassed() {
    if (this.isIntersectedSet) return;
    Adapt.trigger(`scoring:${this.type}:passed scoring:set:passed`, this);
    Logging.debug(`${this.id} passed`);
  }

  /** @override */
  async reset() {
    if (this.isIntersectedSet) return;
    super.reset();
    this.objective?.reset();
  }
}
