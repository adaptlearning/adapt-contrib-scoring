import wait from 'core/js/wait';
import Backbone from 'backbone';
// eslint-disable-next-line no-unused-vars
import Logging from 'core/js/logging';

/** @typedef {import("../IntersectionSet").default} IntersectionSet */

/**
 * Transforms a lifecycle definition into fps batched, phase queues, where the
 * queues are executed in phase and definition order at each cycle
 */
export default class LifecycleRenderer extends Backbone.Controller {

  /**
   * @param {Object} options
   * @param {Object} options.lifecycleDefinition Object of async key function pairs
   * @param {number} options.fps Frames per second of batched cycles
   */
  initialize({
    lifecycleDefinition,
    fps
  } = {}) {
    this.PHASE_NAMES = Object.keys(lifecycleDefinition);
    this.PHASE_HANDLERS = lifecycleDefinition;
    this.phaseQueuedSets = {};
    this.hasStartedWaiting = false;
    this._render = {};
    this._batchRenderId = 0;
    const renderer = this.startBatchRender.bind(this);
    // Throttle gives lifecycle executions batches a reasonable size
    this.startBatchRender = _.throttle(() => {
      if (this.areQueuesEmpty) return;
      // requestAnimationFrame means that changes are rendered with the browser allowing for smooth updates
      requestAnimationFrame(renderer);
    }, 1000 / fps);
    this.createRenderFunctionsAndQueues();
  }

  /**
   * Returns an object of dynamically created named queue addition functions
   * @returns {Object}
   */
  get render() {
    return this._render;
  }

  /**
   * Creates the named queue addition functions
   */
  createRenderFunctionsAndQueues() {
    for (const name of this.PHASE_NAMES) {
      this.phaseQueuedSets[name] = [];
      this.render[name] = this.addNonDuplicatePhaseQueueSets.bind(this, name);
      // alternative immediate renderer
      // this.render[name] = this.renderImmediatePhaseSets.bind(this, name);
    }
  }

  /**
   * Returns the sets in the phase queue
   * @param {string} phaseName
   * @returns {IntersectionSet[]}
   */
  getPhaseQueueSets(phaseName) {
    return this.phaseQueuedSets[phaseName];
  }

  /**
   * Add the sets to the relevant phase queue if they're not in there already
   * Starts the batch renderer
   * @param {string} phaseName
   * @param {IntersectionSet} sets
   */
  async addNonDuplicatePhaseQueueSets (phaseName, sets) {
    if (!sets?.length) return;
    const phaseSets = this.getPhaseQueueSets(phaseName);
    const missingSets = sets.filter(set => !phaseSets.includes(set));
    if (!missingSets?.length) return;
    this.startAdaptWait();
    phaseSets.push(...missingSets);
    this.startBatchRender();
    await this.onBatchRendered();
  };

  /**
   * Force adapt to wait
   */
  startAdaptWait() {
    if (this.hasStartedWaiting) return;
    wait.begin();
    this.hasStartedWaiting = true;
  }

  /**
   * Render the batch
   * @fires this#rendered
   */
  async startBatchRender () {
    this._batchRenderId++;
    if (isNaN(this._batchRenderId)) this._batchRenderId = 0;
    while (!this.tryEndAdaptWait()) {
      // Fetch the next phase with entries for execution
      const phaseName = this.PHASE_NAMES.find(phaseName => this.getPhaseQueueSets(phaseName)?.length);
      if (!phaseName) break;
      const handler = this.PHASE_HANDLERS[phaseName];
      const phaseSets = this.getPhaseQueueSets(phaseName);
      if (!phaseSets?.length) continue;
      const sets = phaseSets?.slice(0);
      phaseSets.length = 0;
      sets.sort((a, b) => a.order - b.order);
      // to see which phases and sets are firing and in which batches
      // eslint-disable-next-line no-unused-vars
      Logging.debug(`lifecycle batch(${this._batchRenderId}) render, phase:`, phaseName, '  for:', sets.map(set => set.id).join(','));
      for (const set of sets) {
        await handler(set);
      }
    }
    this.trigger('rendered');
  }

  /**
   * Tries to stop adapt from waiting after all of the queues are empty
   * @returns {boolean} Signifying if waiting has ended
   */
  tryEndAdaptWait() {
    if (!this.areQueuesEmpty) return false;
    this.hasStartedWaiting = false;
    wait.end();
    return true;
  }

  /**
   * Returns true/false if the queues are empty
   * @returns {Boolean}
   */
  get areQueuesEmpty() {
    return Object.values(this.phaseQueuedSets).every(queue => !queue.length);
  }

  /**
   * Resolves when the next batch has been rendereds
   */
  async onBatchRendered() {
    return new Promise(resolve => this.once('rendered', resolve));
  }

  /**
   * This function is not used, but it is here to demonstrate what immediate
   * vs batched rendering looks like
   * It renders phases on the sets immediately, rather than deduplicating and
   * batch processing them, it results in many more event calls but should give
   * otherwise identical behaviour (assuming the sets behave properly)
   */
  async renderImmediatePhaseSets (phaseName, sets) {
    if (!sets?.length) return;
    sets.sort((a, b) => a.order - b.order);
    // To see which phases and sets are firing
    Logging.debug('lifecycle immediate render, phase:', phaseName, '  for:', sets.map(set => set.id).join(','));
    for (const set of sets) {
      await this.PHASE_HANDLERS[phaseName](set);
    }
    wait.end();
  }

}
