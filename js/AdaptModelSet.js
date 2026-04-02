import ScoringSet from './ScoringSet';
import data from 'core/js/data';

/**
 * A set which represents each AdaptModel from the `core/js/data` API.
 * Used for set intersection queries only, not for scoring.
 */
export default class AdaptModelSet extends ScoringSet {

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

  /** @override */
  get isSubmitted() {
    return this.model.get('_isSubmitted');
  }

  /** @override */
  get isFailed() {
    return false;
  }

  /** @override */
  get isOptional() {
    return this.model.get('_isOptional');
  }

  /** @override */
  get isAvailable() {
    return this.model.get('_isAvailable');
  }

  get feedback() {
    if (!this.isSubmitted) return;
    return this.model.getFeedback();
  }

  /** @override */
  get objective() {
    if (!this.model.get('_recordObjective')) return;
    return super.objective;
  }

  /** @override */
  _logUpdate() {

  }

}
