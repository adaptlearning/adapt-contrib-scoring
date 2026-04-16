import Adapt from 'core/js/adapt';
import data from 'core/js/data';
import {
  getSubsetsByQuery
} from './utils/query';
import {
  getSetById,
  getSetsByType,
  getSetsByIntersectingModelId
} from './utils/sets';
import {
  getPathSetsIntersected
} from './utils/intersection';
import {
  isBackwardCompatible,
  setupBackwardCompatibility
} from './compatibility';
import './helpers';
import Lifecycle from './Lifecycle';
import AdaptModelSet from './AdaptModelSet';
import IntersectionSet from './IntersectionSet';
import LifecycleSet from './LifecycleSet';
import ScoringSet from './ScoringSet';
import Objective from './Objective';
import LifecycleUpdateJournal from './LifecycleUpdateJournal';
import State from './State';
import StateModels from './StateModels';
import StateSetModelChildren from './StateSetModelChildren';
import Passmark from './Passmark';
import TotalSets from './TotalSets';
import Backbone from 'backbone';

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
  LifecycleUpdateJournal,
  State,
  StateSetModelChildren,
  StateModels,
  Passmark
};

/**
 * Scoring API based upon making sets of questions with custom scoring, correctness
 * and completion behaviour.
 */
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
   * Clear the sets.
   * @listens Data#loading
   */
  onDataLoading() {
    this.clear();
  }

  /**
   * Configure the main scoring passmark with TotalSets and setup backward compatibility
   * for legacy adapt-contrib-assessment related components and extensions.
   * @listens Adapt#app:dataReady
   */
  onAppDataReady() {
    this.total = new TotalSets({ model: Adapt.course });
    if (!this.total.isEnabled) return;
    setupBackwardCompatibility(this);
  }

  /**
   * Returns a boolean if adapt-contrib-assessment related compatibility is enabled.
   * @return {boolean}
   */
  get isBackwardCompatible() {
    return isBackwardCompatible(this);
  }

  /**
   * Returns registered sets.
   * @returns {IntersectionSet[]}
   */
  get sets() {
    return this._sets;
  }

  /**
   * Removes all registered sets.
   */
  clear() {
    this._sets?.forEach(set => this.deregister(set));
    this._sets = [];
  }

  /**
   * Register a configured scoring set.
   * This is usually performed automatically upon IntersectionSet instantiation.
   * @param {IntersectionSet} newSet
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
   * Deregister a configured scoring set.
   * @param {IntersectionSet} oldSet
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
   * Force all registered sets to recalculate their states.
   * @fires Adapt#scoring:update via lifecycle
   */
  async update() {
    const sets = this.sets;
    if (!sets.length) return;
    await this.lifecycle.update(sets);
  }

  /**
   * Reset all registered sets which can be reset.
   * @fires Adapt#scoring:reset via lifecycle
   */
  async reset() {
    const sets = this.sets;
    if (!sets.length) return;
    await this.lifecycle.reset();
  }

  /**
   * Returns a registered set by id.
   * @param {string} id
   * @returns {IntersectionSet}
   */
  getSetById(id) {
    return getSetById(id);
  }

  /**
   * Returns registered sets of type.
   * @param {string} type
   * @returns {IntersectionSet[]}
   */
  getSetsByType(type) {
    return getSetsByType(type);
  }

  /**
   * Returns registered sets intersecting the given model id.
   * @param {string} id
   * @returns {IntersectionSet[]}
   */
  getSetsByIntersectingModelId(id) {
    return getSetsByIntersectingModelId(id);
  }

  /**
   * Returns a registered set or intersection set by id path.
   * example: id.id.id
   * @param {string|[string]} path
   * @returns {IntersectionSet}
   */
  getSubsetByPath(path) {
    return getPathSetsIntersected(path);
  }

  /**
   * Returns registered sets or intersection sets by query.
   * @param {string} query
   * @returns {IntersectionSet[]}
   */
  getSubsetsByQuery(query) {
    return getSubsetsByQuery(query);
  }

}

export default (Adapt.scoring = new Scoring());
