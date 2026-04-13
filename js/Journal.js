import Logging from 'core/js/logging';
import {
  filterModelsByIntersectingModels,
  isModelAvailableInHierarchy
} from './utils/models';
import _ from 'underscore';
/** @typedef {import("./ScoringSet").default} ScoringSet */

/**
 * A journal for recording the updates to a set.
 */
export default class Journal {

  /**
   * @param {Object} options
   * @param {ScoringSet} options.set
   */
  constructor({ set } = {}) {
    this.set = set;
    this._pendingUpdateModifiers = [];
  }

  /**
   * Update the journal for the models pending updates.
   * @param {Set<Backbone.Model>} pendingUpdateModels
   */
  update(pendingUpdateModels) {
    pendingUpdateModels.forEach(model => this._addUpdateModifiers(model));
    this._write();
    this._pendingUpdateModifiers = [];
  }

  /**
   * Returns the minimum score for the specified model.
   * @param {Backbone.Model} model
   * @returns {number}
   */
  getMinScoreByModel(model) {
    if (!this.set.questions.includes(model)) return 0;
    return model.minScore;
  }

  /**
   * Returns the maximum score for the specified model.
   * @param {Backbone.Model} model
   * @returns {number}
   */
  getMaxScoreByModel(model) {
    if (!this.set.questions.includes(model)) return 0;
    return model.maxScore;
  }

  /**
   * Returns the score for the specified model.
   * @param {Backbone.Model} model
   * @returns {number}
   */
  getScoreByModel(model) {
    if (!this.set.questions.includes(model)) return 0;
    return model.score;
  }

  /**
   * Returns the list of modifiers which impacted the last update.
   * @returns {Array}
   */
  get pendingUpdateModifiers() {
    return this._pendingUpdateModifiers;
  }

  /**
   * Returns the set data to log.
   * @returns {object}
   */
  get setData() {
    return {
      id: this.set.id,
      type: this.set.type,
      minScore: this.set.minScore,
      maxScore: this.set.maxScore,
      score: this.set.score,
      scaledScore: this.set.scaledScore,
      isComplete: this.set.isComplete,
      isPassed: this.set.isPassed
    };
  }

  /**
   * Add modifier details for how the set has been updated.
   * @protected
   * @param {Backbone.Model} model
   */
  _addUpdateModifiers(model) {
    const isAvailabilityChange = Object.hasOwn(model.changed, '_isAvailable');
    if (isAvailabilityChange) {
      this._addAvailabilityModifiers(model);
      return;
    }
    this._addCompletionModifiers(model);
  }

  /**
   * Add modifier details for how the set has been updated by availability changes.
   * @protected
   * @param {Backbone.Model} model
   */
  _addAvailabilityModifiers(model) {
    const models = model.hasManagedChildren ? model.getChildren() : [model];
    const questions = filterModelsByIntersectingModels(this.set.questions, models);
    questions.forEach(questionModel => {
      const isAvailable = isModelAvailableInHierarchy(questionModel);
      const minScore = this.getMinScoreByModel(questionModel);
      const maxScore = this.getMaxScoreByModel(questionModel);
      const score = this.getScoreByModel(questionModel);
      const data = {
        modelId: questionModel.get('_id'),
        minScore: isAvailable ? minScore : -minScore,
        maxScore: isAvailable ? maxScore : -maxScore
      };
      if (questionModel.get('_isSubmitted')) data.score = isAvailable ? score : -score;
      this.pendingUpdateModifiers.push(data);
    });
  }

  /**
   * Add modifier details for how the set has been updated by completion changes.
   * @protected
   * @param {Backbone.Model} model
   */
  _addCompletionModifiers(model) {
    this.pendingUpdateModifiers.push({
      modelId: model.get('_id'),
      score: this.getScoreByModel(model)
    });
  }

  /**
   * Write the current state to the log if it has changed since the last update.
   * @protected
   */
  _write() {
    const setData = this.setData;
    const hasSetDataChanged = !(_.isEqual(this._lastSetData, setData));
    if (!hasSetDataChanged) return;
    const data = { ...setData };
    if (this.pendingUpdateModifiers.length) data.modifiers = this.pendingUpdateModifiers;
    Logging.info('scoring:update', JSON.stringify(data));
    this._lastSetData = setData;
  }

}
