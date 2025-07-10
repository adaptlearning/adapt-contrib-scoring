import ScoringSet from './ScoringSet';
import {
  isAvailableInHierarchy
} from './utils';

export default class AdaptModelSet extends ScoringSet {

  initialize(options = {}, subsetParent = null) {
    this._model = options.model;
    super.initialize({
      ...options,
      _id: this.model.get('_id'),
      _type: 'adapt',
      title: this.model.get('title')
    }, subsetParent);
  }

  /**
   * Intentionally empty to override super Class
   * @override
   */
  _initializeObjective() {}

  /**
   * Intentionally empty to override super Class
   * @override
   */
  _resetObjective() {}

  /**
   * Intentionally empty to override super Class
   * @override
   */
  _completeObjective() {}

  /**
   * Intentionally empty to prevent super Class event triggers
   * @override
   */
  update() {}

  modelTypeGroup(group) {
    return this.model.isTypeGroup(group);
  }

  get modelType() {
    return this.model.get('_type');
  }

  get modelComponent() {
    return this.model.get('_component');
  }

  get model() {
    return this._model;
  }

  /**
   * @override
   */
  get rawModels() {
    return [this.model];
  }

  /**
   * @override
   */
  get isAvailable() {
    return isAvailableInHierarchy(this.model);
  }

  /**
   * @override
   */
  get isComplete() {
    return this.model.get('_isComplete');
  }

  /**
   * @override
   */
  get isPassed() {
    return null;
  }

  /**
   * Intentionally empty to prevent super Class event triggers
   * @override
   */
  onCompleted() {}

  /**
   * Intentionally empty to prevent super Class event triggers
   * @override
   */
  onPassed() {}
}
