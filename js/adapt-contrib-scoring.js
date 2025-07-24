import Adapt from 'core/js/adapt';
import {
  getSubsetsByQuery
} from './utils/query';
import {
  filterSetsByType,
  filterSetsByIntersectingModelId,
  findSetById
} from './utils/sets';
import {
  getPathSetsIntersected
} from './utils/intersection';
import {
  isBackwardCompatible,
  setupBackwardCompatibility
} from './compatibility';
import './helpers';
import Backbone from 'backbone';
import Lifecycle from './Lifecycle';
import data from 'core/js/data';
import AdaptModelSet from './AdaptModelSet';
import IntersectionSet from './IntersectionSet';
import LifecycleSet from './LifecycleSet';
import ScoringSet from './ScoringSet';
import Objective from './Objective';
import State from './State';
import StateModels from './StateModels';
import StateSetModelChildren from './StateSetModelChildren';
import TotalSets from './TotalSets';

export * from './utils/hash';
export * from './utils/intersection';
export * from './utils/math';
export * from './utils/models';
export * from './utils/query';
export * from './utils/scoring';
export * from './utils/sets';
export {
  AdaptModelSet,
  IntersectionSet,
  LifecycleSet,
  ScoringSet,
  Objective,
  State,
  StateSetModelChildren,
  StateModels
};

export class Scoring extends Backbone.Controller {

  initialize() {
    // Create a LifeCycle instance for rendering lifecycle changes
    this.lifecycle = new Lifecycle({
      scoring: this
    });
    // Listen to relevant events for loading, restore and completion
    this.listenTo(data, {
      loading: this.onDataLoading
    });
    this.listenTo(Adapt, {
      'app:dataReady': this.onAppDataReady
    });
  }

  /**
   * Clear the sets
   * @listens Data#loading
   */
  onDataLoading() {
    this.clear();
  }

  /**
   * Configure the main scoring passmark with TotalSets and setup backward compatibility
   * for legacy adapt-contrib-assessment related components and extensions
   * @listens Adapt#app:dataReady
   */
  onAppDataReady() {
    this.total = new TotalSets({ model: Adapt.course });
    if (!this.total.isEnabled) return;
    setupBackwardCompatibility(this);
  }

  /**
   * Returns a boolean if adapt-contrib-assessment related compatibility is enabled
   * @return {boolean}
   */
  get isBackwardCompatible() {
    return isBackwardCompatible(this);
  }

  /**
   * Returns registered root sets
   * @returns {IntersectionSet[]}
   */
  get sets() {
    return this._sets;
  }

  /**
   * Removes all registered root sets
   */
  clear() {
    this._sets?.forEach(set => this.deregister(set));
    this._sets = [];
  }

  /**
   * Register a configured root scoring set.
   * This is usually performed automatically upon ScoringSet instantiation.
   * @param {ScoringSet} newSet
   * @fires Adapt#{set.type}:register
   * @fires Adapt#scoring:register
   */
  register(newSet) {
    const hasDuplicatedId = this.sets.some(set => set.id === newSet.id);
    if (hasDuplicatedId) throw new Error(`Cannot register two sets with the same id: ${newSet.id}`);
    this.sets.push(newSet);
    this.sets.sort((a, b) => a.order - b.order);
    Adapt.trigger(`${newSet.type}:register scoring:register`, newSet);
  }

  /**
   * Deregister a configured root scoring set
   * @param {ScoringSet} oldSet
   * @fires Adapt#{set.type}:deregister
   * @fires Adapt#scoring:deregister
   */
  deregister(oldSet) {
    const setIndex = this.sets.findIndex(set => set.id === oldSet.id);
    this.sets.splice(setIndex, 1);
    this.sets.sort((a, b) => a.order - b.order);
    Adapt.trigger(`${oldSet.type}:deregister scoring:deregister`, oldSet);
  }

  /**
   * Force all registered sets to recalculate their states
   * @fires Adapt#scoring:update
   */
  async update() {
    const sets = this.sets;
    if (!sets.length) return;
    await this.lifecycle.update(sets);
    Adapt.trigger('scoring:update', this);
  }

  /**
   * Reset all subsets which can be reset
   * @fires Adapt#scoring:reset
   */
  async reset() {
    const sets = this.sets;
    if (!sets.length) return;
    await this.lifecycle.reset();
    Adapt.trigger('scoring:reset', this);
  }

  /**
   * Returns a registered root set by id
   * @param {string} id
   * @returns {IntersectionSet}
   */
  getSetById(id) {
    return findSetById(this.sets, id);
  }

  /**
   * Returns registered root sets of type
   * @param {string} type
   * @returns {IntersectionSet[]}
   */
  getSetsByType(type) {
    return filterSetsByType(this.sets, type);
  }

  /**
   * Returns registered root sets intersecting the given model id
   * @param {string} id
   * @returns {IntersectionSet[]}
   */
  getSetsByIntersectingModelId(id) {
    return filterSetsByIntersectingModelId(this.sets, id);
  }

  /**
   * Returns a root set or intersection set by id path
   * example: id.id.id
   * @param {string|[string]} path
   * @returns {IntersectionSet}
   */
  getSubsetByPath(path) {
    const sets = getPathSetsIntersected(path);
    return sets;
  }

  /**
   * Returns sets or intersection sets by query
   * @param {string} query
   * @returns {IntersectionSet[]}
   */
  getSubsetsByQuery(query) {
    return getSubsetsByQuery(query);
  }

  /**
   * Returns a set or intersection set by query
   * @param {string} query
   * @returns {IntersectionSet}
   */
  getSubsetByQuery(query) {
    return getSubsetsByQuery(query)[0];
  }

}

export default (Adapt.scoring = new Scoring());
