import Adapt from 'core/js/adapt';
import Logging from 'core/js/logging';
import State from './State';
import IntersectionSet from './IntersectionSet';

/**
 * Set at which intersections and queries can be performed.
 * Set at which lifecycle phases, callbacks and triggers can be utilised.
 */
export default class LifecycleSet extends IntersectionSet {

  /**
   * State object for the set.
   * Note: Can only save and restore arrays of arrays, arrays of only numbers and arrays of only booleans
   * i.e. [[1,2,3,4],[true,false,true,false]] or [true,false,true] etc
   * @type {State}
   */
  get state() {
    if (this.isIntersectedSet) return;
    return (this._state = this._state || new State({ set: this }));
  }

  /**
   * Signifies if onRestored returned true/false
   * @returns {boolean}
   */
  get wasRestored() {
    return this._wasRestored;
  }

  set wasRestored(value) {
    this._wasRestored = value;
  }

  /**
   * Called after initialize on every model
   */
  async onInit() {}

  /**
   * Called after init on every model
   * Restore data from previous sessions
   * @fires Adapt#scoring:[set.type]:restored
   * @fires Adapt#scoring:set:restored
   * @returns {Boolean} Signify if the set was restored or not
   */
  async onRestore() {
    if (this.isIntersectedSet) return;
    Adapt.trigger(`scoring:${this.type}:restored scoring:set:restored`, this);
  }

  /**
   * Called on each set after onRestore, only if onRestore returns false
   * Called on each set after a reset or intersecting set or model is reset
   */
  async onStart() {}

  /**
   * Called on each local set when its contentobject is visited
   */
  async onVisit() {}

  /**
   * Called on each local set when its contentobject is left
   */
  async onLeave() {}

  /**
   * Called on each set when any intersecting model has changes to
   * _isAvailable, _isActive, _isVisited or _isInteractionComplete or
   * an intersecting set called `.update()`
   */
  async onUpdate() {}

  /**
   * Add this set and all set intersecting the modelId to the update phase
   * @fires Adapt#scoring:[set.type]:update
   * @fires Adapt#scoring:set:update
   */
  async update() {
    if (this.isIntersectedSet) return;
    Adapt.trigger(`scoring:${this.type}:update scoring:set:update`, this);
    Logging.debug(`${this.id} update`);
    this.trigger('update', this);
  }

  /**
   * Resets the set and restarts all sets on the modelId
   * @fires Adapt#scoring:[set.type]:reset
   * @fires Adapt#scoring:set:reset
   */
  async reset() {
    if (this.isIntersectedSet) return;
    Adapt.trigger(`scoring:${this.type}:reset scoring:set:reset`, this);
    Logging.debug(`${this.id} reset`);
    this.trigger('reset', this);
  }

}
