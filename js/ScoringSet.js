import Adapt from 'core/js/adapt';
import Logging from 'core/js/logging';
import OfflineStorage from 'core/js/offlineStorage';
import scoring, {
  filterModels,
  getScaledScoreFromMinMax,
  getSubsets,
  getSubsetsByType,
  getSubsetsByModelId,
  getSubsetById,
  getSubSetByPath,
  getSubsetsByQuery,
  isAvailableInHierarchy,
  AdaptModelSet
} from './adapt-contrib-scoring';
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
class ScoringSet extends Backbone.Controller {

  initialize({
    _id = null,
    _type = null,
    title = '',
    _isScoreIncluded = false,
    _isCompletionRequired = false,
    _isContainer = false
  } = {}, subsetParent = null) {
    this._subsetParent = subsetParent;
    this._id = _id;
    this._type = _type;
    this._title = title;
    this._isScoreIncluded = _isScoreIncluded;
    this._isCompletionRequired = _isCompletionRequired;
    this._isContainer = _isContainer;
    // Only register root sets as subsets are dynamically created when required
    if (!this._subsetParent) this.register();
    this._setupListeners();
  }

  register() {
    scoring.register(this);
  }

  /**
   * @protected
   */
  _setupListeners() {
    if (OfflineStorage.ready) return this.restore();
    this.listenTo(Adapt, 'offlineStorage:ready', this.restore);
  }

  /**
   * Restore data from previous sessions
   * @listens Adapt#offlineStorage:ready
   */
  restore() {}

  init() {
    this._wasComplete = this.isComplete;
    this._wasPassed = this.isPassed;
  }

  /**
   * Executed on data changes
   */
  update() {
    const isComplete = this.isComplete;
    if (isComplete && !this._wasComplete) this.onCompleted();
    const isPassed = this.isPassed;
    if (isPassed && !this._wasPassed) this.onPassed();
    this._wasComplete = isComplete;
    this._wasPassed = isPassed;
    Adapt.trigger('scoring:set:update', this);
  }

  /**
   * Filter modules by intersection
   * @param {Backbone.Model} models
   * @returns {Array<Backbone.Model>}
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
    return this._isScoreIncluded;
  }

  /**
   * Returns whether the set needs to be completed
   * @returns {boolean}
   */
  get isCompletionRequired() {
    return this._isCompletionRequired;
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
   * A negative percentage correct is not possible with this function
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
   * Returns whether the set is completed
   * @returns {boolean}
   */
  get isComplete() {
    Logging.error(`isComplete must be overriden for ${this.constructor.name}`);
  }

  get isIncomplete() {
    return (this.isComplete === false);
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
   * Override this function to perform set specific completion tasks
   */
  onCompleted() {}

  /**
   * Override this function to perform specific passing tasks
   */
  onPassed() {}

}

Object.setPrototypeOf(AdaptModelSet.prototype, ScoringSet.prototype);

export default ScoringSet;
