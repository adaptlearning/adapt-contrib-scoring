import Logging from 'core/js/logging';
import LifecycleUpdateJournal from './LifecycleUpdateJournal';
import {
  filterModelsByIntersectingModels,
  isModelAvailableInHierarchy
} from './utils/models';
import _ from 'underscore';
/** @typedef {import("./ScoringSet").default} ScoringSet */

/**
 * A journal for recording the models and sets that triggered set updates in the current lifecycle.
 */
export default class ScoringUpdateJournal extends LifecycleUpdateJournal {

  /**
   * Log the updates to the set based on the pending update models and sets, then clear the pending updates.
   */
  update() {
    const sources = [];
    for (const model of this.pendingUpdateModels) {
      const isAvailabilityChange = Object.hasOwn(model.changed, '_isAvailable');
      if (isAvailabilityChange) {
        // If the parent availability has changed, we log the score
        // changes for all current child questions in the set.
        const models = model.hasManagedChildren ? model.getChildren() : [model];
        const modelSetQuestions = filterModelsByIntersectingModels(this.set.questions, models);
        modelSetQuestions.forEach(questionModel => {
          const isAvailable = isModelAvailableInHierarchy(questionModel);
          const minScore = this.getMinScoreByModel(questionModel);
          const maxScore = this.getMaxScoreByModel(questionModel);
          const score = this.getScoreByModel(questionModel);
          // The score changes are logged as negative values
          // if the question is now unavailable.
          const data = {
            modelId: questionModel.get('_id'),
            minScore: isAvailable ? minScore : -minScore,
            maxScore: isAvailable ? maxScore : -maxScore
          };
          if (questionModel.get('_isSubmitted')) data.score = isAvailable ? score : -score;
          sources.push(data);
        });
        continue;
      }
      sources.push({
        modelId: model.get('_id'),
        score: this.getScoreByModel(model)
      });
    }
    const setData = this.setData;
    const hasSetDataChanged = !(_.isEqual(this._lastSetData, setData));
    if (hasSetDataChanged) {
      const data = { ...setData };
      if (sources.length) {
        data.sources = sources;
      }
      Logging.info('scoring:update', JSON.stringify(data));
      this._lastSetData = setData;
    }
    this.clear();
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

}
