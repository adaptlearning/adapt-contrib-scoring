/** @typedef {import("./ScoringSet").default} ScoringSet */

/**
 * A journal for recording the models and sets that triggered set updates in the current lifecycle.
 */
export default class LifecycleUpdateJournal {

  /**
   * @param {Object} options
   * @param {ScoringSet} options.set
   */
  constructor({ set } = {}) {
    this.set = set;
    this.pendingUpdateModels = new Set();
    this.pendingUpdateSets = new Set();
  }

  /**
   * Add the model and intersecting sets which caused the set update to be triggered.
   * @param {Backbone.Model} model Source model
   * @param {ScoringSet[]} [sets] Intersecting sets
   */
  addPendingUpdate(model, sets) {
    this.pendingUpdateModels.add(model);
    sets?.forEach(set => this.pendingUpdateSets.add(set));
  }

  /**
   * Update lifecycle phase has ended
   */
  update() {
    this.clear();
  }

  /**
   * Clear for next pending updates.
   */
  clear() {
    this.pendingUpdateModels.clear();
    this.pendingUpdateSets.clear();
  }

}
