import Adapt from 'core/js/adapt';
import Logging from 'core/js/logging';
import OfflineStorage from 'core/js/offlineStorage';
import COMPLETION_STATE from 'core/js/enums/completionStateEnum';
import {
  filterModels,
  getScaledScoreFromMinMax,
  getSubsets,
  getSubsetsByType,
  getSubsetsByModelId,
  getSubsetById,
  getSubSetByPath,
  getSubsetsByQuery,
  isAvailableInHierarchy
} from './utils';
import Backbone from 'backbone';
import _ from 'underscore';

/**
 * The class provides an abstract that describes a set of models which can be extended with custom
 * scoring and completion behaviour.
 * Derivative class instances should act as both a root set of models (test-blocks) and an
 * intersected set of models (retention-question-components vs test-blocks).
 * Set intersections are performed by comparing overlapping hierachies, such that a model will be
 * considered in both sets when it is equal to, a descendant of or an ancestor of a model in the intersecting
 * set. A test-block may contain a retention-question-component, a retention-question-component
 * may be contained in a test-block and a test-block may be equal to a test-block.
 * The last intersected set will always provide the returned set Class pertaining to its abstraction,
 * such that retention-question-components vs test-blocks would always give a subset of
 * test-blocks whereas test-blocks vs retention-question-components will always
 * give a subset of retention-question-components.
 * Intersected sets will always only include models from their prospective set.
 */
export default class ScoringSet extends Backbone.Controller {

  initialize({
    _id = null,
    _type = null,
    title = '',
    _isScoreIncluded = false,
    _isCompletionRequired = false
  } = {}, subsetParent = null) {
    this._subsetParent = subsetParent;
    this._id = _id;
    this._type = _type;
    this._title = title;
    this._isScoreIncluded = _isScoreIncluded;
    this._isCompletionRequired = _isCompletionRequired;
    this._modifiers = [];
    this.register();
    this._setupListeners();
  }

  /**
   * Register the set
   * @fires Adapt#scoring:[set.type]:register
   * @fires Adapt#scoring:set:register
   */
  register() {
    if (this.subsetParent) return;
    Adapt.scoring.register(this);
    Adapt.trigger(`scoring:${this.type}:register scoring:set:register`, this);
  }

  /**
   * @protected
   */
  _setupListeners() {
    if (this.subsetParent || this.type === 'adapt') return;
    this.listenTo(Adapt, 'questionView:submitted', this.onQuestionSubmitted);
    if (OfflineStorage.ready) return this.restore();
    this.listenTo(Adapt, 'offlineStorage:ready', this.restore);
  }

  /**
   * Restore data from previous sessions
   * @listens Adapt#offlineStorage:ready
   * @fires Adapt#scoring:[set.type]:restored
   * @fires Adapt#scoring:set:restored
   */
  restore() {
    if (this.subsetParent) return;
    Adapt.trigger(`scoring:${this.type}:restored scoring:set:restored`, this);
  }

  init() {
    this._setObjectiveStatus = _.debounce(this._setObjectiveStatus, 100);
    this._wasAvailable = this.isAvailable;
    this._wasIncomplete = this.isIncomplete;
    this._wasComplete = this.isComplete;
    this._wasPassed = this.isPassed;
    this._initializeObjective();
  }

  /**
   * Executed on data changes
   * @param {[Backbone.Model]} updatedModels
   */
  update(updatedModels) {
    const isComplete = this.isComplete;
    const isPassed = this.isPassed;
    if (isComplete && !this._wasComplete && this._wasAvailable) this.onCompleted();
    if (isPassed && !this._wasPassed && this._wasAvailable) this.onPassed();
    if (this.hasStatusChanged) this._setObjectiveStatus();
    this._wasAvailable = this.isAvailable;
    this._wasIncomplete = this.isIncomplete;
    this._wasComplete = isComplete;
    this._wasPassed = isPassed;
    updatedModels.forEach(model => this._addModifiers(model));
    this._logUpdate();
    this._modifiers = [];
  }

  /**
   * Reset the set
   * @fires Adapt#scoring:[set.type]:reset
   * @fires Adapt#scoring:set:reset
   */
  reset() {
    if (this.subsetParent) return;
    Adapt.trigger(`scoring:${this.type}:reset scoring:set:reset`, this);
    Logging.info(`${this.id} reset`);
    this._resetObjective();
  }

  /**
   * Filter modules by intersection
   * @param {Backbone.Model} models
   * @returns {[Backbone.Model]}
   */
  filterModels(models) {
    return filterModels(this, models);
  }

  /**
   * @param {string} setId
   * @returns {[ScoringSet]}
   */
  getSubsetById(setId) {
    return getSubsetById(setId, this);
  }

  /**
   * @param {string} setType
   * @returns {[ScoringSet]}
   */
  getSubsetsByType(setType) {
    return getSubsetsByType(setType, this);
  }

  /**
   * @param {string} modelId
   * @returns {[ScoringSet]}
   */
  getSubsetsByModelId(modelId) {
    return getSubsetsByModelId(modelId, this);
  }

  /**
   * @param {string|[string]} path
   * @returns {[ScoringSet]}
   */
  getSubsetByPath(path) {
    return getSubSetByPath(path, this);
  }

  /**
   * @param {string} query
   * @returns {[ScoringSet]}
   */
  getSubsetsByQuery(query) {
    return getSubsetsByQuery(query, this);
  }

  /**
   * Returns subsets populated by child models
   * @param {ScoringSet} set
   * @returns {[ScoringSet]}
   */
  getPopulatedSubset(subset) {
    return subset.filter(set => set.isPopulated);
  }

  /**
   * Returns the minimum score for the specified model
   * @param {Backbone.Model} model
   * @returns {number}
   */
  getMinScoreByModel(model) {
    if (!this.rawQuestions.includes(model)) return 0;
    return model.minScore;
  }

  /**
   * Returns the maxiumum score for the specified model
   * @param {Backbone.Model} model
   * @returns {number}
   */
  getMaxScoreByModel(model) {
    if (!this.rawQuestions.includes(model)) return 0;
    return model.maxScore;
  }

  /**
   * Returns the score for the specified model
   * @param {Backbone.Model} model
   * @returns {number}
   */
  getScoreByModel(model) {
    if (!this.rawQuestions.includes(model)) return 0;
    return model.score;
  }

  /**
   * Returns a percentage score for the specified model - relative to a positive minimum or zero and maximum values
   * @param {Backbone.Model} model
   * @returns {number}
   */
  getScaledScoreByModel(model) {
    if (!this.rawQuestions.includes(model)) return 0;
    return getScaledScoreFromMinMax(this.getScoreByModel(model), this.getMinScoreByModel(model), this.getMaxScoreByModel(model));
  }

  /**
   * Returns the parent set if a dynamically created query set
   */
  get subsetParent() {
    return this._subsetParent;
  }

  get subsetPath() {
    let subject = this;
    const path = [];
    while (subject) {
      path.push(subject);
      subject = subject.subsetParent;
    }
    return path.reverse();
  }

  get id() {
    return this._id;
  }

  get type() {
    return this._type;
  }

  get title() {
    return this._title;
  }

  get isScoreIncluded() {
    return !this.isOptional && this.isAvailable && this._isScoreIncluded;
  }

  /**
   * Returns whether the set needs to be completed
   * @returns {boolean}
   */
  get isCompletionRequired() {
    return !this.isOptional && this.isAvailable && this._isCompletionRequired;
  }

  /**
   * Returns all models regardless of `_isAvailable`
   * @returns {[Backbone.Model]}
   */
  get rawModels() {
    Logging.error(`rawModels must be overriden for ${this.constructor.name}`);
  }

  /**
   * Returns all component models regardless of `_isAvailable`
   * @returns {[ComponentModel]}
   */
  get rawComponents() {
    return this.rawModels.reduce((components, model) => {
      const models = model.isTypeGroup('component')
        ? [model]
        : model.findDescendantModels('component');
      return components.concat(models);
    }, []);
  }

  /**
   * Returns all question models regardless of `_isAvailable`
   * @returns {[QuestionModel]}
   */
  get rawQuestions() {
    return this.rawComponents.filter(model => model.isTypeGroup('question'));
  }

  /**
   * Returns all presentation component models regardless of `_isAvailable`
   * @returns {[QuestionModel]}
   */
  get rawPresentationComponents() {
    return this.rawComponents.filter(model => !model.isTypeGroup('question'));
  }

  /**
   * Returns a unique array of models, filtered for `_isAvailable` and intersecting subsets hierarchies
   * Always finish by calling `this.filterModels(models)`
   * @returns {[Backbone.Model]}
   */
  get models() {
    return this.filterModels(this.rawModels);
  }

  /**
   * Returns all `_isAvailable` component models
   * @returns {[ComponentModel]}
   */
  get components() {
    return this.rawComponents.filter(isAvailableInHierarchy);
  }

  /**
   * Returns all trackable components - excludes trickle etc.
   * @returns {[ComponentModel]}
   */
  get trackableComponents() {
    return this.components.filter(model => model.get('_isTrackable') !== false);
  }

  /**
   * Returns all `_isAvailable` question models
   * @returns {[QuestionModel]}
   */
  get questions() {
    return this.rawQuestions.filter(isAvailableInHierarchy);
  }

  /**
   * Returns all `_isAvailable` presentation component models
   * @returns {[ComponentModel]}
   */
  get presentationComponents() {
    return this.rawPresentationComponents.filter(isAvailableInHierarchy);
  }

  /**
   * Returns all prospective subsets
   * @returns {[ScoringSet]}
   */
  get subsets() {
    return getSubsets(this);
  }

  /**
   * Returns the minimum score
   * @returns {number}
   */
  get minScore() {
    return this.questions.reduce((score, model) => score + this.getMinScoreByModel(model), 0);
  }

  /**
   * Returns the maxiumum score
   * @returns {number}
   */
  get maxScore() {
    return this.questions.reduce((score, model) => score + this.getMaxScoreByModel(model), 0);
  }

  /**
   * Returns the score
   * @returns {number}
   */
  get score() {
    return this.questions.reduce((score, model) => score + this.getScoreByModel(model), 0);
  }

  /**
   * Returns a percentage score relative to a positive minimum or zero and maximum values
   * @returns {number}
   */
  get scaledScore() {
    return getScaledScoreFromMinMax(this.score, this.minScore, this.maxScore);
  }

  /**
   * Returns a score as a string to include "+" operator for positive scores
   * @returns {string}
   */
  get scoreAsstring() {
    const score = this.score;
    return (score > 0) ? `+${score.toString()}` : score.toString();
  }

  /**
   * Returns the number of correctly answered questions
   * @note Assumes the same number of questions are used in each attempt
   * @returns {number}
   */
  get correctness() {
    return this.questions.reduce((count, model) => count + (model.get('_isCorrect') ? 1 : 0), 0);
  }

  /**
   * Returns the percentage of correctly answered questions
   * @returns {number}
   */
  get scaledCorrectness() {
    return getScaledScoreFromMinMax(this.correctness, 0, this.questions.length);
  }

  /**
   * Returns whether the set can be reset
   * @returns {boolean}
   */
  get canReset() {
    return false;
  }

  /**
   * Returns the list of modifiers which impacted the last update
   * @returns {Array}
   */
  get modifiers() {
    return this._modifiers;
  }

  /**
   * Returns whether the set is optional
   * @returns {boolean}
   */
  get isOptional() {
    return false;
  }

  /**
   * Returns whether the set is available
   * @returns {boolean}
   */
  get isAvailable() {
    return true;
  }

  /**
   * Returns whether the set is started
   * @returns {boolean}
   */
  get isStarted() {
    return this.models.some(model => model.get('_isVisited'));
  }

  /**
   * Returns whether the set is started and incomplete
   * @returns {boolean}
   */
  get isIncomplete() {
    return this.isStarted && !this.isComplete;
  }

  /**
   * Returns whether the objective for the set is completed.
   * Depending on the set logic, this can differ to `_isComplete`.
   * @returns {boolean}
   */
  get isObjectiveComplete() {
    return this.isComplete;
  }

  /**
   * Returns whether the set is completed
   * @returns {boolean}
   */
  get isComplete() {
    Logging.error(`isComplete must be overriden for ${this.constructor.name}`);
  }

  /**
   * Returns whether the objective for the set is passed.
   * Depending on the set logic, this can differ to `isPassed`.
   * @returns {boolean}
   */
  get isObjectivePassed() {
    return this.isPassed;
  }

  /**
   * Returns whether the configured passmark has been achieved
   * @returns {boolean}
   */
  get isPassed() {
    Logging.error(`isPassed must be overriden for ${this.constructor.name}`);
  }

  get isFailed() {
    return (this.isPassed === false);
  }

  /**
   * Check whether the status has changed since the last `update`
   * @returns {boolean}
   */
  get hasStatusChanged() {
    return this.isAvailable !== this._wasAvailable ||
      this.isIncomplete !== this._wasIncomplete ||
      this.isComplete !== this._wasComplete ||
      this.isPassed !== this._wasPassed;
  }
  
  /**
   * Check to see if there are any child models
   * @returns {boolean}
   */
  get isPopulated() {
    return Boolean(this.models?.length);
  }

  get isNotPopulated() {
    return (this.isPopulated === false);
  }

  /**
   * Returns the data to log
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
    if (this.modifiers.length) data.modifiers = this.modifiers;
    return data;
  }

  /**
   * Return whether the logData has changed since the last update
   * @returns {boolean}
   */
  get hasLogDataChanged() {
    // delete previous modifiers entry before comparing logs for changes
    const clonedLastLogData = structuredClone(this._lastLogData ?? {});
    delete clonedLastLogData.modifiers;
    return !(_.isEqual(clonedLastLogData, this.logData));
  }

  /**
   * Add modifier details for how the set has been updated
   * @protected
   * @param {Backbone.Model} model
   */
  _addModifiers(model) {
    if (!this.hasLogDataChanged) return;
    const isAvailabilityChange = Object.hasOwn(model.changed, '_isAvailable');
    if (isAvailabilityChange) {
      this._addAvailabilityModifiers(model);
      return;
    }
    this._addCompletionModifiers(model);
  }

  /**
   * Add modifier details for how the set has been updated by availability changes
   * @protected
   * @param {Backbone.Model} model
   */
  _addAvailabilityModifiers(model) {
    const models = model.hasManagedChildren ? model.getChildren() : [model];
    const questions = filterIntersectingHierarchy(this.rawQuestions, models);
    questions.forEach(questionModel => {
      const isAvailable = isAvailableInHierarchy(questionModel);
      const minScore = this.getMinScoreByModel(questionModel);
      const maxScore = this.getMaxScoreByModel(questionModel);
      const score = this.getScoreByModel(questionModel);
      const data = {
        modelId: questionModel.get('_id'),
        minScore: isAvailable ? minScore : -minScore,
        maxScore: isAvailable ? maxScore : -maxScore
      };
      if (questionModel.get('_isSubmitted')) data.score = isAvailable ? score : -score;
      this.modifiers.push(data);
    });
  }

  /**
   * Add modifier details for how the set has been updated by completion changes
   * @protected
   * @param {Backbone.Model} model
   */
  _addCompletionModifiers(model) {
    this.modifiers.push({
      modelId: model.get('_id'),
      score: this.getScoreByModel(model)
    });
  }

  /**
   * Log the data as JSON following an update
   * @protected
   */
  _logUpdate() {
    if (!this.hasLogDataChanged) return;
    const logData = this.logData;
    Logging.info('scoring:update', JSON.stringify(logData));
    this._lastLogData = logData;
  }

  /**
   * Define the objective for reporting purposes
   * @protected
   */
  _initializeObjective() {
    if (this.subsetParent || this.isStarted) return;
    OfflineStorage.set('objectiveDescription', this.id, this.title);
    this._setObjectiveStatus();
  }

  /**
   * Reset the objective data
   * @protected
   */
  _resetObjective() {
    if (this.subsetParent || this.isObjectiveComplete || !this.hasStatusChanged) return;
    this._setObjectiveScore();
    this._setObjectiveStatus();
  }

  /**
   * Complete the objective.
   * Will update to the latest data/attempt unless overriden in a subset.
   * @protected
   */
  _completeObjective() {
    if (this.subsetParent) return;
    this._setObjectiveScore();
    this._setObjectiveStatus();
  }

  /**
   * Set the objective score
   * @protected
   */
  _setObjectiveScore() {
    if (this.subsetParent) return;
    OfflineStorage.set('objectiveScore', this.id, this.score, this.minScore, this.maxScore);
  }

  /**
   * Set the appropriate objective completion and success status.
   * Will update to the latest data/attempt, unless controlled accordingly in a subset.
   * @protected
   */
  _setObjectiveStatus() {
    if (this.subsetParent) return;
    const isAvailable = this.isAvailable;
    const isIncomplete = this.isIncomplete;
    const isComplete = this.isObjectiveComplete;
    const isPassed = this.isObjectivePassed;
    let completionStatus = COMPLETION_STATE.UNKNOWN.asLowerCase;
    let successStatus = COMPLETION_STATE.UNKNOWN.asLowerCase;
    if (isAvailable && !isIncomplete) completionStatus = COMPLETION_STATE.NOTATTEMPTED.asLowerCase;
    if (isAvailable && isIncomplete) completionStatus = COMPLETION_STATE.INCOMPLETE.asLowerCase;
    if (isAvailable && isComplete) {
      completionStatus = COMPLETION_STATE.COMPLETED.asLowerCase;
      if (this.passmark.isEnabled) successStatus = (isPassed ? COMPLETION_STATE.PASSED : COMPLETION_STATE.FAILED).asLowerCase;
    }
    OfflineStorage.set('objectiveStatus', this.id, completionStatus, successStatus);
  }

  /**
   * @fires Adapt#scoring:[set.type]:complete
   * @fires Adapt#scoring:set:complete
   */
  onCompleted() {
    if (this.subsetParent) return;
    Adapt.trigger(`scoring:${this.type}:complete scoring:set:complete`, this);
    Logging.info(`${this.id} completed`);
    this._completeObjective();
  }

  /**
   * @fires Adapt#scoring:[set.type]:passed
   * @fires Adapt#scoring:set:passed
   */
  onPassed() {
    if (this.subsetParent) return;
    Adapt.trigger(`scoring:${this.type}:passed scoring:set:passed`, this);
    Logging.info(`${this.id} passed`);
  }

  /**
   * @param {QuestionView} view
   * @listens Adapt#questionView:submitted
   */
  onQuestionSubmitted(view) {
    const model = view.model;
    if (!this.questions.includes(model)) return;
    model.addContextActivity(this.id, this.type, this.title);
  }

}
