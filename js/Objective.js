import offlineStorage from 'core/js/offlineStorage';
import COMPLETION_STATE from 'core/js/enums/completionStateEnum';
/** @typedef {import("./ScoringSet").default} ScoringSet */

/**
 * Registers an objective with the offlineStorage API.
 * see SCORM cmi.objectives
 */
export default class Objective {

  /**
   * @param {Object} options
   * @param {ScoringSet} options.set
   */
  constructor({ set } = {}) {
    this.set = set;
    this.id = this.set.id;
    this.description = this.set.title;
  }

  /**
   * Define the objective for reporting purposes.
   * Set initial status.
   */
  register() {
    offlineStorage.set('objectiveDescription', this.id, this.description);
    this.setStatus();
  }

  /**
   * Set the objective score.
   */
  setScore() {
    offlineStorage.set('objectiveScore', this.id, this.set.score, this.set.minScore, this.set.maxScore);
  }

  /**
   * Reset the objective score.
   * Depending on the set logic, this may be overriden to prevent resets.
   */
  resetScore() {
    this.setScore();
  }

  /**
   * Set the appropriate objective completion and success status.
   * Will update to the latest data/attempt, unless overriden accordingly in a set.
   */
  setStatus() {
    const isAvailable = this.set.isAvailable;
    const isStarted = this.set.isStarted;
    const isIncomplete = this.set.isIncomplete;
    const isComplete = this.isComplete;
    const isPassed = this.isPassed;
    let completionStatus = COMPLETION_STATE.UNKNOWN.asLowerCase;
    let successStatus = COMPLETION_STATE.UNKNOWN.asLowerCase;
    if (isAvailable && !isStarted) completionStatus = COMPLETION_STATE.NOTATTEMPTED.asLowerCase;
    if (isAvailable && isStarted && isIncomplete) completionStatus = COMPLETION_STATE.INCOMPLETE.asLowerCase;
    if (isAvailable && isComplete) {
      completionStatus = COMPLETION_STATE.COMPLETED.asLowerCase;
      if (this.set.hasPassmark) successStatus = (isPassed ? COMPLETION_STATE.PASSED : COMPLETION_STATE.FAILED).asLowerCase;
    }
    offlineStorage.set('objectiveStatus', this.id, completionStatus, successStatus);
  }

  /**
   * Returns whether the objective for the set is completed.
   * Depending on the set logic, this can differ to set completion.
   * @returns {boolean}
   */
  get isComplete() {
    return this.set.isComplete;
  }

  /**
   * Returns whether the objective for the set is passed.
   * Depending on the set logic, this can differ to whether the set was passed.
   * @returns {boolean|null}
   */
  get isPassed() {
    return this.set.isPassed;
  }

}
