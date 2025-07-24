import Data from 'core/js/data';
import Adapt from 'core/js/adapt';
import AdaptModelSet from './AdaptModelSet';
import {
  filterSetsByIntersectingModelId,
  filterSetsByLocalModelId,
  filterSetsByModelId,
  findSetById,
  getAllSets
} from './utils/sets';
import offlineStorage from 'core/js/offlineStorage';
import LifecycleRenderer from './LifecycleRenderer';
import wait from 'core/js/wait';
import AdaptModel from 'core/js/models/adaptModel';
import Backbone from 'backbone';

/** @typedef {import("../IntersectionSet").default} IntersectionSet */
/** @typedef {import("core/js/modelEvent").default} ModelEvent */
/** @typedef {import("core/js/location").default} Location */

/**
 * Lifecycle controller
 */
export default class Lifecycle extends Backbone.Controller {

  initialize({ scoring }) {
    this.scoring = scoring;
    this.listenTo(Data, {
      loading: this.onDataLoading,
      add: this.onDataAddAdaptModel,
      remove: this.onDataRemoveAdaptModel,
      'change:_isAvailable': this.onAdaptModelChange
    });
    this.listenTo(Adapt, {
      'scoring:register': this.onScoringSetRegister,
      'scoring:deregister': this.onScoringSetDeregister,
      'adapt:start': this.onAdaptStart,
      'router:location': this.onRouterLocation
    });
  }

  /**
   * Creates a new AdaptModelSet when a new AdaptModel is added to the data API
   * Listens to the reset events on the new model
   * @listens Data#add
   * @listens model#reset
   * @param {Backbone.Model} model
   */
  onDataAddAdaptModel(model) {
    new AdaptModelSet({ _model: model });
    this.listenTo(model, 'reset', (...args) =>
      this.onAdaptModelReset(model, ...args)
    );
  }

  /**
   * Removes the AdaptModelSet and stops listening when the model is removed from the data API
   * @listens Data#remove
   * @param {Backbone.Model} model
   */
  onDataRemoveAdaptModel(model) {
    const allSets = getAllSets();
    const oldSet = findSetById(allSets, model.get('_id'));
    if (!oldSet) return;
    this.scoring.deregister(oldSet);
    this.stopListening(oldSet);
    this.stopListening(model);
  }

  /**
   * Listens to a newly registered Set's reset and update events
   * @listens AdaptModelSet#reset
   * @listens AdaptModelSet#update
   * @param {InteractionSet} newSet
   */
  onScoringSetRegister(newSet) {
    this.listenTo(newSet, {
      reset: this.onScoringSetReset,
      update: this.onScoringSetUpdate
    });
  }

  /**
   * Stops listening to a deregistered set
   * @param {IntersectionSet} oldSet
   */
  onScoringSetDeregister(oldSet) {
    this.stopListening(oldSet);
  }

  /**
   * Begins the lifecycle of the registered sets and listens to bubbled Adapt events
   * @listens Adapt#adapt:start
   * @listens Adapt.course#bubble:change:_isInteractionComplete
   * @listens Adapt.course#bubble:change:_isActive
   * @listens Adapt.course#bubble:change:_isVisited
   */
  async onAdaptStart() {
    this.listenTo(Adapt.course, {
      'bubble:change:_isInteractionComplete bubble:change:_isActive bubble:change:_isVisited': this.onAdaptModelChangeBubble
    });
    wait.begin();
    await this.init();
    await this.onOfflineStorageReady();
    // only run update async so that restore, start and update
    // are batch processed together
    this.restore();
    this.start();
    await this.update(getAllSets());
    this._isStarted = true;
    wait.end();
  }

  /**
   * Waits for offline storage to be ready
   */
  async onOfflineStorageReady() {
    if (offlineStorage.ready) return;
    return new Promise(resolve => Adapt.once('offlineStorage:ready', resolve));
  }

  /**
   * Adds sets to the update phase which intersect the changed model
   * @param {Backbone.Model} model
   */
  async onAdaptModelChange(model) {
    if (!this._isStarted) return;
    const allSets = getAllSets();
    this.update(filterSetsByIntersectingModelId(allSets, model.get('_id')));
  }

  /**
   * Adds sets to the update phase which intersect the changed model
   * @param {ModelEvent} event
   */
  async onAdaptModelChangeBubble(event) {
    if (!this._isStarted) return;
    const adaptModel = event.deepPath.findLast(model => model instanceof AdaptModel);
    if (!adaptModel) return;
    const allSets = getAllSets();
    this.update(filterSetsByIntersectingModelId(allSets, adaptModel.get('_id')));
  }

  /**
   * Adds sets to the leave and visit phase which are local to the previous and current location
   * @param {Location} location
   */
  async onRouterLocation(location) {
    // run together for batch processing
    const allSets = getAllSets();
    const leaveSets = filterSetsByLocalModelId(allSets, location._previousId)
      .filter(set => set.isModelAvailableInHierarchy);
    this.leave(leaveSets);
    const visitSets = filterSetsByLocalModelId(allSets, location._currentId)
      .filter(set => set.isModelAvailableInHierarchy);
    this.visit(visitSets);
  }

  /**
   * Adds sets to the restart phase which are on the model id
   * @param {Backbone.Model} model
   */
  onAdaptModelReset(model) {
    // TODO: determine if we should restart the sets on this model id only or all descendant sets as well
    const sets = filterSetsByModelId(getAllSets(), model.get('_id'));
    this.restart(sets);
  }

  /**
   * Adds sets to the reset phase which are on the set.modelId
   * @param {IntersectionSet} set
   */
  onScoringSetReset(set) {
    // TODO: determine if we should restart the sets on this model id only or all descendant sets as well
    if (!set.model) return;
    const sets = filterSetsByModelId(getAllSets(), set.modelId);
    this.restart(sets);
  }

  /**
   * Adds sets to the update phase which intersect the set.modelId
   * @param {IntersectionSet} set
   */
  onScoringSetUpdate(set) {
    const sets = filterSetsByIntersectingModelId(getAllSets(), set.modelId);
    this.update(sets);
  }

  /**
   * Send all sets into the init phase
   */
  async init () {
    const sets = getAllSets();
    await this.renderer.render.init(sets);
  }

  /**
   * Send all sets into the restore phase
   * @fires Adapt#scoring:restored
   */
  async restore () {
    const sets = getAllSets();
    await this.renderer.render.restore(sets);
    Adapt.trigger('scoring:restored', this.scoring);
  }

  /**
   * Send all sets into the start phase
   * @fires Adapt#scoring:start
   */
  async start () {
    const sets = getAllSets();
    await this.renderer.render.start(sets);
    Adapt.trigger('scoring:start', this.scoring);
  }

  /**
   * Send all sets into the reset phase
   */
  async reset () {
    const sets = getAllSets();
    await this.renderer.render.reset(sets);
  }

  /**
   * Send givens sets into the restart phase
   */
  async restart (sets) {
    sets = sets.filter(set => !set.intersectionParent);
    await this.renderer.render.restart(sets);
  }

  /**
   * Send givens sets into the leave phase
   */
  async leave (sets) {
    sets = sets.filter(set => !set.intersectionParent);
    await this.renderer.render.leave(sets);
  }

  /**
   * Send givens sets into the visit phase
   */
  async visit (sets) {
    sets = sets.filter(set => !set.intersectionParent);
    await this.renderer.render.visit(sets);
  }

  /**
   * Send givens sets into the update phase
   * @fires Adapt#scoring:update
   */
  async update (sets) {
    sets = sets.filter(set => !set.intersectionParent);
    await this.renderer.render.update(sets);
    Adapt.trigger('scoring:update', this.scoring);
  }

  /**
   * Returns the renderer
   * @returns {LifecycleRenderer}
   */
  get renderer() {
    return renderer;
  }
}

const renderer = new LifecycleRenderer({
  // Interval at which set lifecycle events are grouped for execution
  fps: 30,
  // Order and function of lifecycle events
  lifecycleDefinition: {
    // init calls set.onInit, it is an initialisation lifecycle event
    async init(set) {
      await set.onInit?.();
    },
    // restore calls set.onRestore, it is an initialisation lifecycle event
    async restore(set) {
      set.wasRestored = Boolean(await set.onRestore?.());
    },
    // start calls set.onStart, only when wasRestored is false, it is an initialisation lifecycle event
    async start(set) {
      !set.wasRestored && await set.onStart?.();
    },
    // reset calls set.reset only from Adapt.scoring.reset(), it tries to reset all models based upon set.canReset
    async reset(set) {
      set.canReset && await set.reset?.();
    },
    // restart calls set.onStart when any intersecting model or set is reset
    async restart(set) {
      await set.onStart?.();
    },
    // leave calls set.onLeave when exiting an intersecting contentobject
    async leave(set) {
      await set.onLeave?.();
    },
    // visit calls set.onVisit when entering an intersecting contentobject
    async visit(set) {
      await set.onVisit?.();
    },
    // update calls set.onUpdate after all other lifecycle events have been executed
    async update(set) {
      await set.onUpdate?.();
    }
  }
});
