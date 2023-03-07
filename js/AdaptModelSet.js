import ScoringSet from './ScoringSet';

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
  get models() {
    return [this.model];
  }

  /**
   * @override
   */
  get isComplete() {
    return this._model.get('_isComplete');
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

