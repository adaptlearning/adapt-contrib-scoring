import IntersectionSet from './IntersectionSet';
import data from 'core/js/data';

/**
 * A set which represents each AdaptModel from the `core/js/data` API.
 * Used for set intersection queries only, not for scoring.
 */
export default class AdaptModelSet extends IntersectionSet {

  initialize(options = {}) {
    super.initialize({
      _id: options._model.get('_id'),
      _type: 'adapt',
      _title: options._model.get('title'),
      _models: [options._model],
      ...options
    });
  }

  /**
   * Comparison function for type groups.
   * query example: `[modelTypeGroup=question]`
   * @param {string} group One of course|contentobject|menu|page|group|article|block|component|question
   * @returns {boolean}
   */
  modelTypeGroup(typeGroup) {
    return this.model.isTypeGroup(typeGroup);
  }

  /**
   * Comparison property for model types.
   * query example: `[modelType=block]`
   * @returns {string} One of course|menu|page|article|block|component
   */
  get modelType() {
    return this.model.get('_type');
  }

  /**
   * Comparison property for model component strings.
   * query example: `[modelComponent=mcq]`
   * @returns {string} One of mcq|gmcq|slider|graphic|... etc
   */
  get modelComponent() {
    return this.model.get('_component');
  }

  /** @override */
  get order() {
    if (!data.isReady) return 0;
    // Reverse order by ancestor distance such that children execute first and parents last
    return 100 - this.model.getAncestorModels(true).length;
  }

  /**
   * Returns whether the set is complete.
   * query example: `(isComplete)` or `(isComplete=false)`
   * @returns {boolean}
   */
  get isComplete() {
    return this.model.get('_isComplete');
  }

  /**
   * Returns whether the set is incomplete.
   * query example: `(isIncomplete)` alias for `(isComplete=false)`
   * @returns {boolean}
   */
  get isIncomplete() {
    return (this.isComplete === false);
  }

  /**
   * Returns whether the set is passed.
   * query example: `(isPassed)` alias for `(isComplete)`
   * @returns {boolean}
   */
  get isPassed() {
    return this.isComplete;
  }

  /**
   * Returns whether the set is isFailed.
   * query example: `(isFailed)`
   * @returns {boolean}
   */
  get isFailed() {
    return false;
  }

  /**
   * Returns whether the set is optional.
   * query example: `(isOptional)`
   * @returns {boolean}
   */
  get isOptional() {
    return this.model.get('_isOptional');
  }

  /**
   * Returns whether the set is available.
   * query example: `(_isAvailable)`
   * @returns {boolean}
   */
  get isAvailable() {
    return this.model.get('_isAvailable');
  }

}
