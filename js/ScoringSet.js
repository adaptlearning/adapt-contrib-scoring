import Adapt from 'core/js/adapt';
import Logging from 'core/js/logging';
import LifecycleSet from './LifecycleSet';
import Objective from './Objective';
import ScoringUpdateJournal from './ScoringUpdateJournal';
import {
  getScaledScoreFromMinMax
} from './utils/scoring';
import {
  sum
} from './utils/math';
import {
  hasHashChanged
} from './utils/hash';

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
   * Each set's influence scales with its point range when scaledScores are summed across sets.
   * @returns {number}
   */
  get scaledScore() {
    return getScaledScoreFromMinMax(this.score, this.minScore, this.maxScore);
  }

  /**
   * Returns the average scaledScore. For a single set this equals scaledScore.
   * Each set contributes equally regardless of its point range when aggregated.
   * @returns {number}
   */
  get averageScaledScore() {
    return this.scaledScore;
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
   * Returns whether the set is correct.
   * query example: `(isCorrect)` or `(isCorrect=false)`
   * @returns {boolean|null}
   */
  get isCorrect() {
    if (!this.isSubmitted) return null;
    return (this.correctness === this.maxCorrectness);
  }

  /**
   * Returns whether the set is partly correct.
   * query example: `(isPartlyCorrect)` or `(isPartlyCorrect=false)`
   * @returns {boolean|null}
   */
  get isPartlyCorrect() {
    if (!this.isSubmitted) return null;
    return this.correctness > 0 && this.correctness < this.maxCorrectness;
  }

  /**
   * Returns whether the set is incorrect.
   * query example: `(isIncorrect)` or `(isIncorrect=false)`
   * @returns {boolean|null}
   */
  get isIncorrect() {
    if (!this.isSubmitted) return null;
    return this.correctness === 0;
  }

  /**
   * Returns whether the set is submitted.
   * query example: `(isSubmitted)` or `(isSubmitted=false)`
   * @returns {boolean}
   */
  get isSubmitted() {
    const availableQuestions = this.availableQuestions;
    return availableQuestions.length > 0 && availableQuestions.every(model => model.get('_isSubmitted'));
  }

  /**
   * Returns whether the set is started.
   * query example: `(isStarted)` or `(isStarted=false)`
   * @returns {boolean}
   */
  get isStarted() {
    return this.availableModels.some(model => model.get('_isVisited'));
  }

  /**
   * Returns whether the set is completed.
   * query example: `(isComplete)` or `(isComplete=false)`
   * @returns {boolean}
   */
  get isComplete() {
    const availableModels = this.availableModels;
    return availableModels.length > 0 && availableModels.every(model => model.get('_isComplete'));
  }

  /**
   * Returns whether the set is incomplete.
   * query example: `(isIncomplete)` alias for `(isComplete=false)`
   * @returns {boolean}
   */
  get isIncomplete() {
    return this.isComplete === false;
  }

  /**
   * Returns whether a passmark is configured and enabled for this set.
   * @returns {boolean}
   */
  get hasPassmark() {
    return this.passmark?.isEnabled ?? false;
  }

  /**
   * Returns whether the configured passmark has been achieved.
   * Subclasses with a passmark override this to return a boolean verdict.
   * query example: `(isPassed)`
   * @returns {boolean|null}
   */
  get isPassed() {
    return null;
  }

  /**
   * Returns whether the configured passmark has been failed.
   * Returns null when no passmark is configured, false when incomplete or passed.
   * query example: `(isFailed)` alias for `(isComplete,isPassed=false)`
   * @returns {boolean|null}
   */
  get isFailed() {
    if (!this.hasPassmark) return null;
    return this.isComplete && this.isPassed === false;
  }

  /**
   * The journal for recording the updates to the set.
   * @returns {ScoringUpdateJournal}
   */
  get journal() {
    if (this.isIntersectedSet) return;
    return (this._journal = this._journal || new ScoringUpdateJournal({ set: this }));
  }

  /**
   * The objective object for the set. See SCORM cmi.objectives.
   * @returns {Objective}
   */
  get objective() {
    if (this.isIntersectedSet) return;
    return (this._objective = this._objective || new Objective({ set: this }));
  }

  /**
   * Update the current status hashes to help determine what has changed during the update phase of the lifecycle.
   * @protected
   */
  _setStatusHash() {
    const isAvailable = this.isAvailable;
    const isComplete = this.isComplete;
    const isPassed = this.isPassed;
    this._isAvailableChange = hasHashChanged(this, [isAvailable], '_isAvailableHash');
    this._isCompleteChange = hasHashChanged(this, [isComplete], '_isCompleteHash');
    this._isPassedChange = hasHashChanged(this, [isPassed], '_isPassedHash');
    this._isStatusChange = hasHashChanged(this, [
      isAvailable,
      this.isStarted,
      this.isIncomplete,
      isComplete,
      isPassed
    ], '_statusHash');
  }

  /** @override */
  async onInit() {
    if (this.isIntersectedSet) return;
    if (this.type !== 'adapt') {
      this.listenTo(Adapt, 'questionView:submitted', this.onQuestionSubmitted);
    }
    await super.onInit();
  }

  /** @override */
  async onRestore() {
    if (this.isIntersectedSet) return;
    this._setStatusHash();
    if (!this.isStarted) this.objective?.register();
    await super.onRestore();
  }

  /** @override */
  async onRestart() {
    if (this.isIntersectedSet) return;
    this.objective?.resetScore();
    await super.onRestart();
  }

  /** @override */
  async onUpdate() {
    if (this.isIntersectedSet) return;
    this._setStatusHash();
    if (this.isComplete && this._isCompleteChange && !this._isAvailableChange) await this.onCompleted();
    if (this.isPassed && this._isPassedChange && !this._isAvailableChange) await this.onPassed();
    if (this._isStatusChange) this.objective?.setStatus();
    await super.onUpdate();
  }

  /**
   * Is executed on lifecycle update phase when isComplete=true.
   * @fires Adapt#scoring:[set.type]:complete
   * @fires Adapt#scoring:set:complete
   */
  async onCompleted() {
    if (this.isIntersectedSet) return;
    const events = `scoring:${this.type}:complete scoring:set:complete`;
    Adapt.trigger(events, this);
    Logging.info(`${this.id} completed`);
    this.objective?.setScore();
  }

  /**
   * Is executed on lifecycle update phase when isPassed=true.
   * @fires Adapt#scoring:[set.type]:passed
   * @fires Adapt#scoring:set:passed
   */
  async onPassed() {
    if (this.isIntersectedSet) return;
    const events = `scoring:${this.type}:passed scoring:set:passed`;
    Adapt.trigger(events, this);
    Logging.info(`${this.id} passed`);
  }

  /**
   * @param {QuestionView} view
   * @listens Adapt#questionView:submitted
   */
  onQuestionSubmitted(view) {
    const model = view.model;
    if (!this.availableQuestions.includes(model)) return;
    model.addContextActivity(this.id, this.type, this.title);
  }

}
