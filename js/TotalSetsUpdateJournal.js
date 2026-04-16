import Logging from 'core/js/logging';
import LifecycleUpdateJournal from './ScoringUpdateJournal';
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

/**
 * A journal for recording the models and sets that triggered set updates in the current lifecycle.
 */
export default class TotalSetsUpdateJournal extends LifecycleUpdateJournal {

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
        const relevantSets = this.set.scoringSets.filter(set => this.pendingUpdateSets.has(set));
        relevantSets.forEach(set => {
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
          sources.push(data);
        });
        continue;
      }
      const modelIntersectedTotalSets = getSubsetsByQuery(`#${model.get('_id')} ${this.set.type}`)[0]?.scoringSets ?? [];
      modelIntersectedTotalSets.forEach(set => {
        sources.push({
          id: set.id,
          score: set.score
        });
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

}
