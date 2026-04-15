import LifecycleUpdateJournal from './LifecycleUpdateJournal';
import {
  getSubsetsByQuery
} from './utils/query';
/** @typedef {import("./TotalSets").default} TotalSets */

export default class TotalLifecycleUpdateJournal extends LifecycleUpdateJournal {

  /** @override */
  getMinScoreByModel(model) {
    if (!this.set.models.includes(model)) return 0;
    return this._getTotalSetsByModelQuery(model).minScore;
  }

  /** @override */
  getMaxScoreByModel(model) {
    if (!this.set.models.includes(model)) return 0;
    return this._getTotalSetsByModelQuery(model).maxScore;
  }

  /** @override */
  getScoreByModel(model) {
    if (!this.set.models.includes(model)) return 0;
    return this._getTotalSetsByModelQuery(model).score;
  }

  /**
   * Returns the intersected `TotalSets` of the model.
   * @param {Backbone.Model} model
   * @returns {TotalSets}
   */
  _getTotalSetsByModelQuery(model) {
    return getSubsetsByQuery(`#${model.get('_id')} ${this.set.type}`)[0];
  }

}
