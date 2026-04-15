import LifecycleUpdateJournal from './LifecycleUpdateJournal';
import {
  filterModelsByIntersectingModels,
  isModelAvailableInHierarchy
} from './utils/models';
import {
  sum
} from './utils/math';
import {
  getSubsetsByQuery
} from './utils/query';
/** @typedef {import("./TotalSets").default} TotalSets */
/** @typedef {import("./ScoringSet").default} ScoringSet */

export default class TotalLifecycleUpdateJournal extends LifecycleUpdateJournal {

  /**
   * @override
   * Using intersection queries doesn't log modifier scores correctly when models become unavailable.
   * Intersection queries only include available models - retrieve scores from other journals accordingly.
  */
  _addAvailabilityModifiers(model) {
    const models = model.hasManagedChildren ? model.getChildren() : [model];
    const sets = this.set.scoringSets.filter(set => this._pendingUpdateSets.has(set));
    sets.forEach(set => {
      const questions = filterModelsByIntersectingModels(set.questions, models);
      const isAvailable = isModelAvailableInHierarchy(model);
      const journal = set.journal;
      const minScore = sum(questions, questionModel => journal.getMinScoreByModel(questionModel));
      const maxScore = sum(questions, questionModel => journal.getMaxScoreByModel(questionModel));
      const score = sum(questions, questionModel => journal.getScoreByModel(questionModel));
      const data = {
        id: set.id,
        minScore: isAvailable ? minScore : -minScore,
        maxScore: isAvailable ? maxScore : -maxScore
      };
      if (score !== 0) data.score = isAvailable ? score : -score;
      this._pendingUpdateModifiers.push(data);
    });
  }

  /** @override */
  _addCompletionModifiers(model) {
    const sets = this._getScoringSetsByModel(model);
    sets.forEach(set => {
      this._pendingUpdateModifiers.push({
        id: set.id,
        score: set.score
      });
    });
  }

  /**
   * Returns the intersected `TotalSets` of the model.
   * @param {Backbone.Model} model
   * @returns {TotalSets}
   */
  _getTotalSetsByModelQuery(model) {
    return getSubsetsByQuery(`#${model.get('_id')} ${this.set.type}`)[0];
  }

  /**
   * Returns the intersected scoring sets of the model.
   * @param {Backbone.Model} model
   * @returns {ScoringSet[]}
   */
  _getScoringSetsByModel(model) {
    return this._getTotalSetsByModelQuery(model)?.scoringSets ?? [];
  }

}
