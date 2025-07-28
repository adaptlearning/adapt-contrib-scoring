import offlineStorage from 'core/js/offlineStorage';
import COMPLETION_STATE from 'core/js/enums/completionStateEnum';

/** @typedef {import("../IntersectionSet").default} IntersectionSet */

/**
 * Registers an objective with the offlineStorage API.
 * see SCORM cmi.objectives
 */
export default class Objective {

  /**
   * @param {Object} options
   * @param {IntersectionSet} options.set
   */
  constructor({ set } = {}) {
    this.set = set;
    this.id = this.set.id;
    this.description = this.set.title;
  }

  /**
   * Define the objective for reporting purposes.
   */
  init() {
    const completionStatus = COMPLETION_STATE.NOTATTEMPTED.asLowerCase;
    offlineStorage.set('objectiveDescription', this.id, this.description);
    if (this.set.isComplete) return;
    offlineStorage.set('objectiveStatus', this.id, completionStatus);
  }

  /**
   * Reset the objective data.
   */
  reset() {
    if (this.set.isComplete) return;
    const completionStatus = COMPLETION_STATE.INCOMPLETE.asLowerCase;
    offlineStorage.set('objectiveScore', this.id, this.set.score, this.set.minScore, this.set.maxScore);
    offlineStorage.set('objectiveStatus', this.id, completionStatus);
  }

  /**
   * Complete the objective.
   * TODO: Always updates to latest data - is this desired?
   */
  complete() {
    const completionStatus = COMPLETION_STATE.COMPLETED.asLowerCase;
    const successStatus = (this.set.isPassed ? COMPLETION_STATE.PASSED : COMPLETION_STATE.FAILED).asLowerCase;
    offlineStorage.set('objectiveScore', this.id, this.set.score, this.set.minScore, this.set.maxScore);
    offlineStorage.set('objectiveStatus', this.id, completionStatus, successStatus);
  }

}
