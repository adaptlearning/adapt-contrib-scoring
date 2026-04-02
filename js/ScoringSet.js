import Adapt from 'core/js/adapt';
import Logging from 'core/js/logging';
import LifecycleSet from './LifecycleSet';
import Objective from './Objective';
import {
  getScaledScoreFromMinMax
} from './utils/scoring';
import {
  sum
} from './utils/math';
import {
  filterModelsByIntersectingModels,
  isModelAvailableInHierarchy
} from './utils/models';
import {
  hasHashChanged
} from './utils/hash';
import _ from 'underscore';

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
    this._pendingUpdateModels = [];
    this._pendingUpdateModifiers = [];
  }

  /**
   * Returns the minimum score for the specified model
   * @param {Backbone.Model} model
   * @returns {number}
   */
  getMinScoreByModel(model) {
    if (!this.questions.includes(model)) return 0;
    return model.minScore;
  }

  /**
   * Returns the maxiumum score for the specified model
   * @param {Backbone.Model} model
   * @returns {number}
   */
  getMaxScoreByModel(model) {
    if (!this.questions.includes(model)) return 0;
    return model.maxScore;
  }

  /**
   * Returns the score for the specified model
   * @param {Backbone.Model} model
   * @returns {number}
   */
  getScoreByModel(model) {
    if (!this.questions.includes(model)) return 0;
    return model.score;
  }

  /**
   * Returns a percentage score for the specified model - relative to a positive minimum or zero and maximum values
   * @param {Backbone.Model} model
   * @returns {number}
   */
  getScaledScoreByModel(model) {
    if (!this.questions.includes(model)) return 0;
    return getScaledScoreFromMinMax(this.getScoreByModel(model), this.getMinScoreByModel(model), this.getMaxScoreByModel(model));
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
    return this.availableModels.every(model => model.get('_isSubmitted'));
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
    return this.availableModels.every(model => model.get('_isComplete'));
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
   * Returns whether the configured passmark has been achieved.
   * query example: `(isPassed)`
   * @returns {boolean}
   */
  get isPassed() {
    return this.isComplete;
  }

  /**
   * Returns whether the configured passmark has been failed.
   * query example: `(isFailed)` alias for `(isComplete,isPassed=false)`
   * @returns {boolean|null}
   */
  get isFailed() {
    if (!this.isSubmitted) return null;
    return (this.isPassed === false);
  }

  /**
   * Returns the list of modifiers which impacted the last update.
   * @returns {Array}
   */
  get pendingUpdateModifiers() {
    return this._pendingUpdateModifiers;
  }

  /**
   * Returns the data to log.
   * @returns {object}
   */
  get logData() {
    const data = {
      id: this.id,
      type: this.type,
      minScore: this.minScore,
      maxScore: this.maxScore,
      score: this.score,
      scaledScore: this.scaledScore,
      isComplete: this.isComplete,
      isPassed: this.isPassed
    };
    if (this.pendingUpdateModifiers.length) data.modifiers = this.pendingUpdateModifiers;
    return data;
  }

  /**
   * Return whether the logData has changed since the last update.
   * @returns {boolean}
   */
  get hasLogDataChanged() {
    // delete previous modifiers entry before comparing logs for changes
    const clonedLastLogData = structuredClone(this._lastLogData ?? {});
    delete clonedLastLogData.modifiers;
    return !(_.isEqual(clonedLastLogData, this.logData));
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

  /**
   * Add a model as having triggered this set's next update.
   * @param {Backbone.Model} model
   */
  addPendingUpdateModel(model) {
    if (this._pendingUpdateModels.includes(model)) return;
    this._pendingUpdateModels.push(model);
  }

  /**
   * Add modifier details for how the set has been updated.
   * @protected
   * @param {Backbone.Model} model
   */
  _addUpdateModifiers(model) {
    if (!this.hasLogDataChanged) return;
    const isAvailabilityChange = Object.hasOwn(model.changed, '_isAvailable');
    if (isAvailabilityChange) {
      this._addAvailabilityModifiers(model);
      return;
    }
    this._addCompletionModifiers(model);
  }

  /**
   * Add modifier details for how the set has been updated by availability changes.
   * @protected
   * @param {Backbone.Model} model
   */
  _addAvailabilityModifiers(model) {
    const models = model.hasManagedChildren ? model.getChildren() : [model];
    const questions = filterModelsByIntersectingModels(this.questions, models);
    questions.forEach(questionModel => {
      const isAvailable = isModelAvailableInHierarchy(questionModel);
      const minScore = this.getMinScoreByModel(questionModel);
      const maxScore = this.getMaxScoreByModel(questionModel);
      const score = this.getScoreByModel(questionModel);
      const data = {
        modelId: questionModel.get('_id'),
        minScore: isAvailable ? minScore : -minScore,
        maxScore: isAvailable ? maxScore : -maxScore
      };
      if (questionModel.get('_isSubmitted')) data.score = isAvailable ? score : -score;
      this.pendingUpdateModifiers.push(data);
    });
  }

  /**
   * Add modifier details for how the set has been updated by completion changes.
   * @protected
   * @param {Backbone.Model} model
   */
  _addCompletionModifiers(model) {
    this.pendingUpdateModifiers.push({
      modelId: model.get('_id'),
      score: this.getScoreByModel(model)
    });
  }

  /**
   * Log the data as JSON following an update.
   * @protected
   */
  _logUpdate() {
    if (!this.hasLogDataChanged) return;
    const logData = this.logData;
    Logging.info('scoring:update', JSON.stringify(logData));
    this._lastLogData = logData;
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
    super.onRestore();
  }

  /** @override */
  async onRestart() {
    if (this.isIntersectedSet) return;
    this.objective?.resetScore();
    super.onRestart();
  }

  /** @override */
  async onUpdate() {
    if (this.isIntersectedSet) return;
    this._setStatusHash();
    if (this.isComplete && this._isCompleteChange && !this._isAvailableChange) await this.onCompleted();
    if (this.isPassed && this._isPassedChange && !this._isAvailableChange) await this.onPassed();
    if (this._isStatusChange) this.objective?.setStatus();
    this._pendingUpdateModels.forEach(model => this._addUpdateModifiers(model));
    this._logUpdate();
    this._pendingUpdateModels = [];
    this._pendingUpdateModifiers = [];
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
