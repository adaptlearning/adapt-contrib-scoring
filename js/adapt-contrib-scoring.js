import Backbone from 'backbone';
import Adapt from 'core/js/adapt';
import data from 'core/js/data';
import {
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
  getStateObjectsByQuery,
  getScaledScoreFromMinMax,
  isAvailableInHierarchy
} from './utils';

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
  getStateObjectsByQuery,
  getScaledScoreFromMinMax,
  isAvailableInHierarchy
};

/**
 * API for creating completion and scoring model sets
 */
class Scoring extends Backbone.Controller {

  initialize() {
    /**
     * All registered sets
     * @type {ScoringSet}
     */
    this._rawSets = [];
    this.listenTo(Adapt, 'adapt:start', this.onAdaptStart);
  }

  onAdaptStart() {
    // delay any listeners until all data has been restored
    this._setupListeners();
    this.init();
    this.update();
  }

  _setupListeners() {
    this._debouncedUpdate = _.debounce(this.update, 50);
    this._queuedChanges = [];
    const updateQueue = model => {
      this._queuedChanges.push(model);
      this._debouncedUpdate();
    };
    this.listenTo(data, 'change:_isAvailable change:_isInteractionComplete', updateQueue);
  }

  init() {
    this.subsets.forEach(set => set.init());
  }

  /**
   * Force all registered sets to recalculate their states
   * @fires Adapt#scoring:update
   * @property {Scoring}
   */
  update() {
    const updateSubsets = !this._queuedChanges?.length
      ? this.subsets
      : this._queuedChanges.reduce((updateSubsets, model) => updateSubsets.concat(getSubsetsByModelId(model?.get('_id'))), []);
    const containersLastSorted = updateSubsets.sort((a, b) => (a._isContainer && 1) - (b._isContainer && 1));
    containersLastSorted.forEach(set => set.update());
    this._queuedChanges.length = 0;
    if (!updateSubsets.length) return;
    Adapt.trigger('scoring:update', this);
  }

  /**
   * Register a configured root scoring set
   * This is usual performed automatically upon ScoringSet instantiation
   * @param {ScoringSet} newSet
   */
  register(newSet) {
    const hasDuplicatedId = Boolean(this._rawSets.find(set => set.id === newSet.id));
    if (hasDuplicatedId) throw new Error(`Cannot register two sets with the same id: ${newSet.id}`);
    this._rawSets.push(newSet);
    Adapt.trigger(`${newSet.type}:register`, newSet);
  }

  /**
   * Return all root sets marked with `_isCompletionRequired`
   * @returns {[ScoringSet]}
   */
  get completionSets() {
    return this._rawSets.filter(({ isCompletionRequired }) => isCompletionRequired);
  }

  /**
   * Return all root sets marked with `_isScoreIncluded`
   * @returns {[ScoringSet]}
   */
  get scoringSets() {
    return this._rawSets.filter(({ isScoreIncluded }) => isScoreIncluded);
  }

  /**
   * Returns all unique subset models
   * @todo Use `new Set` to create unique models?
   * @returns {[Backbone.Model]}
   */
  get models() {
    const models = this.subsets.reduce((models, set) => models.concat(set.models), []);
    return _.uniq(models, model => model.get('_id'));
  }

  /**
   * Returns all registered root sets
   * @returns {[ScoringSet]}
   */
  get subsets() {
    return this._rawSets;
  }

  /**
   * Returns all registered root sets of type
   * @param {string} type
   * @returns {[ScoringSet]}
   */
  getSubsetsByType(type) {
    return getSubsetsByType(type);
  }

  /**
   * Returns all registered root sets intersecting the given model id
   * @param {string} id
   * @returns {[ScoringSet]}
   */
  getSubsetsByModelId(id) {
    return getSubsetsByModelId(id);
  }

  /**
   * Returns a registered root sets by id
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

  /**
   * Returns sets or intersection sets by query
   * @param {string} query
   * @returns {ScoringSet}
   */
  getSubsetsByQuery(query) {
    return getSubsetsByQuery(query);
  }

  /**
   * @param {string} query
   * @returns {[object]}
   */
  getStateObjectsByQuery(query) {
    return getStateObjectsByQuery(query);
  }

  /**
   * Returns the sum of all `_isScoreIncluded` root models `minScore` values
   * @returns {number}
   */
  get minScore() {
    return this.scoringSets.reduce((minScore, set) => minScore + set.minScore, 0);
  }

  /**
   * Returns the sum of all `_isScoreIncluded` root models `maxScore` values
   * @returns {number}
   */
  get maxScore() {
    return this.scoringSets.reduce((maxScore, set) => maxScore + set.maxScore, 0);
  }

  /**
   * Returns the sum of all `_isScoreIncluded` root models score values
   * @returns {number}
   */
  get score() {
    return this.scoringSets.reduce((score, set) => score + set.score, 0);
  }

  /**
   * Returns the percentage position of score between `minScore` and `maxScore`
   * @returns {number}
   */
  get scaledScore() {
    return getScaledScoreFromMinMax(this.score, this.minScore, this.maxScore);
  }

  /**
   * Returns a boolean indication if all root sets marked with `_isCompletionRequired` are completed
   * @returns {boolean}
   */
  get isComplete() {
    return !this.completionSets.find(set => !set.isComplete);
  }

}

export default (Adapt.scoring = new Scoring());
