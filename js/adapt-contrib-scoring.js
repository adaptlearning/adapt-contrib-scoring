import Adapt from 'core/js/adapt';
import Data from 'core/js/data';
import Logging from 'core/js/logging';
import AdaptModelSet from './AdaptModelSet';
import Passmark from './Passmark';
import {
  getSubsetById,
  getSubsetsByType,
  getSubsetsByModelId,
  getSubSetByPath,
  getSubsetsByQuery,
  getScaledScoreFromMinMax
} from './utils';
import './helpers';
import Backbone from 'backbone';
import _ from 'underscore';

export {
  filterModels,
  filterIntersectingHierarchy,
  hasIntersectingHierarchy,
  createIntersectionSubset,
  getRawSets,
  getSubsets,
  getSubsetById,
  getSubsetsByType,
  getSubsetsByModelId,
  getSubSetByPath,
  getSubsetsByQuery,
  getScaledScoreFromMinMax,
  isAvailableInHierarchy
} from './utils';

class Scoring extends Backbone.Controller {

  initialize() {
    this.listenTo(Data, {
      loading: this.onDataLoading,
      add: this._addAdaptModelSet,
      remove: this._removeAdaptModelSet
    });
    this.listenTo(Adapt, {
      'app:dataReady': this.onAppDataReady,
      'adapt:start': this.onAdaptStart
    });
  }

  init() {
    this.subsets.forEach(set => set.init());
    this._wasComplete = this.isComplete;
    this._wasPassed = this.isPassed;
  }

  /**
   * Register a configured root scoring set.
   * This is usually performed automatically upon ScoringSet instantiation.
   * @param {ScoringSet} newSet
   * @fires Adapt#{set.type}:register
   * @fires Adapt#scoring:register
   */
  register(newSet) {
    const hasDuplicatedId = this._rawSets.some(set => set.id === newSet.id);
    if (hasDuplicatedId) throw new Error(`Cannot register two sets with the same id: ${newSet.id}`);
    this._rawSets.push(newSet);
    Adapt.trigger(`${newSet.type}:register scoring:register`, newSet);
  }

  /**
   * Deregister a configured root scoring set
   * @param {ScoringSet} oldSet
   * @fires Adapt#{set.type}:deregister
   * @fires Adapt#scoring:deregister
   */
  deregister(oldSet) {
    const setIndex = this._rawSets.findIndex(set => set.id === oldSet.id);
    this._rawSets.splice(setIndex, 1);
    Adapt.trigger(`${oldSet.type}:deregister scoring:deregister`, oldSet);
  }

  /**
   * Force all registered sets to recalculate their states
   * @property {Scoring}
   * @fires Adapt#scoring:update
   */
  update() {
    const queuedChanges = [...new Set(this._queuedChanges)];
    const updateSubsets = !queuedChanges?.length
      ? this.subsets
      : queuedChanges.reduce((subsets, model) => subsets.concat(getSubsetsByModelId(model?.get('_id'))), []);
    updateSubsets.forEach(set => set.update());
    this._queuedChanges = [];
    if (!updateSubsets.length) return;
    const isComplete = this.isComplete;
    if (isComplete && !this._wasComplete) this.onCompleted();
    const isPassed = this.isPassed;
    if (isPassed && !this._wasPassed) this.onPassed();
    this._wasComplete = isComplete;
    this._wasPassed = isPassed;
    Adapt.trigger('scoring:update', this);
  }

  /**
   * Reset all subsets which can be reset
   * @fires Adapt#scoring:reset
   */
  reset() {
    this.subsets.forEach(set => set.canReset && set.reset());
    Adapt.trigger('scoring:reset', this);
  }

  /**
   * Returns registered root sets of type
   * @param {string} type
   * @returns {[ScoringSet]}
   */
  getSubsetsByType(type) {
    return getSubsetsByType(type);
  }

  /**
   * Returns registered root sets intersecting the given model id
   * @param {string} id
   * @returns {[ScoringSet]}
   */
  getSubsetsByModelId(id) {
    return getSubsetsByModelId(id);
  }

  /**
   * Returns sets or intersection sets by query
   * @param {string} query
   * @returns {[ScoringSet]}
   */
  getSubsetsByQuery(query) {
    return getSubsetsByQuery(query);
  }

  /**
   * Returns a registered root set by id
   * @param {string} id
   * @returns {ScoringSet}
   */
  getSubsetById(id) {
    return getSubsetById(id);
  }

  /**
   * Returns a root set or intersection set by path
   * @param {string|[string]} path
   * @returns {ScoringSet}
   */
  getSubsetByPath(path) {
    return getSubSetByPath(path);
  }

  get id() {
    return this._id;
  }

  get title() {
    return this._title;
  }

  /**
   * Returns whether the plugin is functioning as `Adapt.assessment`
   */
  get isBackwardCompatible() {
    return this._isBackwardCompatible;
  }

  /**
   * @private
   */
  get _compatibilityState() {
    const state = {
      isComplete: this.isComplete,
      isPercentageBased: this.passmark.isScaled,
      isPass: this.isPassed,
      maxScore: this.maxScore,
      minScore: this.minScore,
      score: this.score,
      scoreToPass: this.passmark.score,
      scoreAsPercent: this.scaledScore,
      correctCount: this.correctness,
      correctAsPercent: this.scaledCorrectness,
      correctToPass: this.passmark.correctness,
      questionCount: this.questions.length,
      assessmentsComplete: this.scoringSets.filter(set => set.isComplete).length,
      assessments: this.scoringSets.length,
      canRetry: this.canReset
    };
    return state;
  }

  /**
   * Returns root sets marked with `_isCompletionRequired`
   * @returns {[ScoringSet]}
   */
  get completionSets() {
    return this._rawSets.filter(({ isCompletionRequired }) => isCompletionRequired);
  }

  /**
   * Returns root sets marked with `_isScoreIncluded`
   * @returns {[ScoringSet]}
   */
  get scoringSets() {
    return this._rawSets.filter(({ isScoreIncluded }) => isScoreIncluded);
  }

  /**
   * Returns unique subset models
   * @returns {[Backbone.Model]}
   */
  get models() {
    const models = this.subsets.reduce((models, set) => models.concat(set.models), []);
    return [...new Set(models)];
  }

  /**
   * Returns unique subsets question models
   * @returns {[QuestionModel]}
   */
  get questions() {
    const questions = this.scoringSets.reduce((questions, set) => questions.concat(set.questions), []);
    return [...new Set(questions)];
  }

  /**
   * Returns registered root sets
   * @returns {[ScoringSet]}
   */
  get subsets() {
    return this._rawSets;
  }

  /**
   * Returns the minimum score of all `_isScoreIncluded` subsets
   * @returns {number}
   */
  get minScore() {
    return this.scoringSets.reduce((score, set) => score + set.minScore, 0);
  }

  /**
   * Returns the maximum score of all `_isScoreIncluded` subsets
   * @returns {number}
   */
  get maxScore() {
    return this.scoringSets.reduce((score, set) => score + set.maxScore, 0);
  }

  /**
   * Returns the score of all `_isScoreIncluded` subsets
   * @returns {number}
   */
  get score() {
    return this.scoringSets.reduce((score, set) => score + set.score, 0);
  }

  /**
   * Returns a percentage score relative to a positive minimum or zero and maximum values
   * @returns {number}
   */
  get scaledScore() {
    return getScaledScoreFromMinMax(this.score, this.minScore, this.maxScore);
  }

  /**
   * Returns the number of correctly answered questions
   * @returns {number}
   */
  get correctness() {
    return this.scoringSets.reduce((count, set) => count + set.correctness, 0);
  }

  /**
   * Returns the percentage of correctly answered questions
   * @returns {number}
   */
  get scaledCorrectness() {
    return getScaledScoreFromMinMax(this.correctness, 0, this.questions.length);
  }

  /**
   * Returns the passmark model
   * @returns {Passmark}
   */
  get passmark() {
    return this._passmark;
  }

  /**
   * Returns whether any root sets marked with `_isScoreIncluded` can be reset
   * @todo Add `canReset` to `ScoringSet`?
   * @returns {boolean}
   */
  get canReset() {
    return this.scoringSets.some(set => set?.canReset);
  }

  /**
   * Returns whether all root sets marked with `_isCompletionRequired` are completed
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
    //if (!this.isComplete) return false; // must be completed for a pass
    //if (!this.passmark.isEnabled && this.isComplete) return true; // always pass if complete and passmark is disabled
    const isEverySubsetPassed = this.scoringSets.every(set => set.isPassed)
    const isScaled = this.passmark.isScaled;
    const score = (isScaled) ? this.scaledScore : this.score;
    const correctness = (isScaled) ? this.scaledCorrectness : this.correctness;
    const isPassed = score >= this.passmark.score && correctness >= this.passmark.correctness;
    return this.passmark.requiresPassedSubsets ? isPassed && isEverySubsetPassed : isPassed;
  }

  /**
   * Returns whether any root sets marked with `_isScoreIncluded` are failed and cannot be reset
   * @todo Add `canReset` to `ScoringSet`?
   * @returns {boolean}
   */
  get isFailed() {
    return !this.isPassed && !this.canReset;
  }

  /**
   * @private
   */
  _setupBackwardCompatibility() {
    Adapt.assessment = {
      get: id => this.getSubsetById(id)?.model,
      getState: () => this._compatibilityState
    };
  }

  /**
   * @private
   * @param {Backbone.Model} model
   */
  _addAdaptModelSet(model) {
    new AdaptModelSet({ model });
  }

  /**
   * @private
   * @param {Backbone.Model} model
   */
  _removeAdaptModelSet(model) {
    const set = getSubsetById(model.get('_id'));
    this.deregister(set);
  }

  /**
   * @private
   */
  _setupListeners() {
    this._debouncedUpdate = _.debounce(this.update, 50);
    this._queuedChanges = [];
    this.listenTo(Data, 'change:_isAvailable change:_isInteractionComplete', this._updateQueue);
  }

  /**
   * @private
   */
  _removeListeners() {
    this.stopListening(Data, 'change:_isAvailable change:_isInteractionComplete', this._updateQueue);
  }

  /**
   * @private
   */
  _updateQueue(model) {
    this._queuedChanges.push(model);
    this._debouncedUpdate();
  }

  /**
   * @listens Data#loading
   */
  onDataLoading() {
    this._removeListeners();
    this._rawSets = [];
  }

  /**
   * @listens Adapt#app:dataReady
   */
  onAppDataReady() {
    this._config = Adapt.course.get('_scoring');
    this._id = this._config?._id;
    this._title = this._config?.title;
    this._passmark = new Passmark(this._config?._passmark);
    this._isBackwardCompatible = this._config?._isBackwardCompatible ?? false;
    if (this.isBackwardCompatible) this._setupBackwardCompatibility();
  }

  /**
   * @listens Adapt#adapt:start
   * @fires Adapt#assessment:restored
   * @fires Adapt#scoring:restored
   */
  onAdaptStart() {
    if (this.isBackwardCompatible) Adapt.trigger('assessment:restored', this._compatibilityState);
    Adapt.trigger('scoring:restored', this);
    // delay any listeners until all models have been restored
    this._setupListeners();
    this.init();
    this.update();
  }

  /**
   * @fires Adapt#assessment:complete
   * @fires Adapt#scoring:complete
   * @property {Scoring}
   */
  onCompleted() {
    if (this.isBackwardCompatible) Adapt.trigger('assessment:complete', this._compatibilityState);
    Adapt.trigger('scoring:complete', this);
    Logging.debug('scoring completed');
  }

  /**
   * @fires Adapt#scoring:pass
   * @property {Scoring}
   */
  onPassed() {
    Adapt.trigger('scoring:pass', this);
    Logging.debug('scoring passed');
  }

}

export default (Adapt.scoring = new Scoring());
