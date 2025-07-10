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
   */
  update() {
    const isComplete = this.isComplete;
    const isPassed = this.isPassed;
    if (isComplete && !this._wasComplete && this._wasAvailable) this.onCompleted();
    if (isPassed && !this._wasPassed && this._wasAvailable) this.onPassed();
    if (this.hasStatusChanged) this._setObjectiveStatus();
    this._wasAvailable = this.isAvailable;
    this._wasIncomplete = this.isIncomplete;
    this._wasComplete = isComplete;
    this._wasPassed = isPassed;
  }

  /**
   * Reset the set
   * @fires Adapt#scoring:[set.type]:reset
   * @fires Adapt#scoring:set:reset
   */
  reset() {
    if (this.subsetParent) return;
    Adapt.trigger(`scoring:${this.type}:reset scoring:set:reset`, this);
    Logging.debug(`${this.id} reset`);
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
   * Returns a unique array of models, filtered for `_isAvailable` and intersecting subsets hierarchies
   * Always finish by calling `this.filterModels(models)`
   * @returns {[Backbone.Model]}
   */
  get models() {
    Logging.error(`models must be overriden for ${this.constructor.name}`);
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
   * Returns all component models regardless of `_isAvailable`
   * @returns {[ComponentModel]}
   */
  get rawComponents() {
    return this.model.findDescendantModels('component');
  }

  /**
   * Returns all question models regardless of `_isAvailable`
   * @returns {[QuestionModel]}
   */
  get rawQuestions() {
    return this.model.findDescendantModels('question');
  }

  /**
   * Returns all presentation component models regardless of `_isAvailable`
   * @returns {[QuestionModel]}
   */
  get rawPresentationComponents() {
    return this.rawComponents.filter(model => !model.isTypeGroup('question'));
  }

  /**
   * Returns all `_isAvailable` component models
   * @returns {[ComponentModel]}
   */
  get components() {
    return this.models.reduce((components, model) => {
      model.isTypeGroup('component') ? components.push(model) : components.push(...model.findDescendantModels('component'));
      return components;
    }, []).filter(isAvailableInHierarchy);
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
    return this.components.filter(model => model.isTypeGroup('question'));
  }

  /**
   * Returns all `_isAvailable` presentation component models
   * @returns {[QuestionModel]}
   */
  get presentationComponents() {
    return this.components.filter(model => !model.isTypeGroup('question'));
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
    return this.questions.reduce((score, set) => score + set.minScore, 0);
  }

  /**
   * Returns the maxiumum score
   * @returns {number}
   */
  get maxScore() {
    return this.questions.reduce((score, set) => score + set.maxScore, 0);
  }

  /**
   * Returns the score
   * @returns {number}
   */
  get score() {
    return this.questions.reduce((score, set) => score + set.score, 0);
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
    Logging.debug(`${this.id} completed`);
    this._completeObjective();
  }

  /**
   * @fires Adapt#scoring:[set.type]:passed
   * @fires Adapt#scoring:set:passed
   */
  onPassed() {
    if (this.subsetParent) return;
    Adapt.trigger(`scoring:${this.type}:passed scoring:set:passed`, this);
    Logging.debug(`${this.id} passed`);
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
