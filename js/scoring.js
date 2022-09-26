import Adapt from '../../../core/js/adapt';
import Data from '../../../core/js/data';
import {
  getSubsetById,
  getSubsetsByType,
  getSubsetsByModelId,
  getSubSetByPath,
  getScaledScoreFromMinMax
} from './utils';

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

    this.listenTo(Adapt, {
      'adapt:start': this.onAdaptStart
    });
  }

  /**
   * @todo Any data change causes all sets to update. Should this be limited to changes to each sets intersecting data?
   * @todo Limit to components only - Assessments use blocks so wouldn't work?
   * @todo Exclude `_isOptional` models - wouldn't factor in role selector changes etc.?
   */
  _setupListeners() {
    const debouncedUpdate = _.debounce(this.update, 100);

    this.listenTo(Data, {
      'change:_isAvailable': debouncedUpdate,
      // 'bubble:change:_isInteractionComplete': debouncedUpdate
      'change:_isInteractionComplete': debouncedUpdate
    });
  }

  init() {
    this.subsets.forEach(set => set.init());
  }

  /**
   * Force all registered sets to recalculate their states
   * @todo Add a different event if the score was changed rather than recalculated?
   * @fires Adapt#scoring:update
   * @property {Scoring}
   */
  update() {
    this.subsets.forEach(set => set.update());
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
   * @param {String} type
   * @returns {[ScoringSet]}
   */
  getSubsetsByType(type) {
    return getSubsetsByType(type);
  }

  /**
   * Returns all registered root sets intersecting the given model id
   * @param {String} id
   * @returns {[ScoringSet]}
   */
  getSubsetsByModelId(id) {
    return getSubsetsByModelId(id);
  }

  /**
   * Returns a registered root sets by id
   * @param {String} id
   * @returns {ScoringSet}
   */
  getSubsetById(id) {
    return getSubsetById(id);
  }

  /**
   * Returns a root set or intersection set by path
   * @param {String|[String]} path
   * @returns {ScoringSet}
   */
  getSubsetByPath(path) {
    return getSubSetByPath(path);
  }

  /**
   * Returns the sum of all `_isScoreIncluded` root models `minScore` values
   * @returns {Number}
   */
  get minScore() {
    return this.scoringSets.reduce((minScore, set) => minScore + set.minScore, 0);
  }

  /**
   * Returns the sum of all `_isScoreIncluded` root models `maxScore` values
   * @returns {Number}
   */
  get maxScore() {
    return this.scoringSets.reduce((maxScore, set) => maxScore + set.maxScore, 0);
  }

  /**
   * Returns the sum of all `_isScoreIncluded` root models score values
   * @returns {Number}
   */
  get score() {
    return this.scoringSets.reduce((score, set) => score + set.score, 0);
  }

  /**
   * Returns the percentage position of score between `minScore` and `maxScore`
   * @returns {Number}
   */
  get scaledScore() {
    return getScaledScoreFromMinMax(this.score, this.minScore, this.maxScore);
  }

  /**
   * Returns a boolean indication if all root sets marked with `_isCompletionRequired` are completed
   * @returns {Boolean}
   */
  get isComplete() {
    return !this.completionSets.find(set => !set.isComplete);
  }

  onAdaptStart() {
    // delay any listeners until all data has been restored
    this._setupListeners();
    this.init();
    this.update();
  }

}

export default (Adapt.scoring = new Scoring());
