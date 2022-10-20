import data from 'core/js/data';

export default class AdaptModelSet {
  constructor({
    _id,
    model = null
  }, subsetParent) {
    model = model ?? data.findById(_id);
    const id = _id ?? model.get('_id');
    this._id = id;
    this._type = 'adapt';
    this._model = model;
    this._models = [model];
    this._subsetParent = subsetParent;
  }

  get modelType() {
    return this._model.get('_type');
  }

  get modelComponent() {
    return this._model.get('_component');
  }

  modelTypeGroup(group) {
    return this._model.isTypeGroup(group);
  }

  get models() {
    return this._models;
  }

  get isComplete() {
    return this._model.get('_isComplete');
  }

  get isPassed() {
    return null;
  }
}

// Is extended by ScoringSet later
