import Adapt from 'core/js/adapt';
import {
  getAllSets,
  filterSetsByType,
  filterSetsByIntersectingModelId,
  findSetById
} from './utils/sets';
import {
  isModelAvailableInHierarchy,
  findDescendantModels,
  getModelChildren,
  filterModelsByIntersectingModels
} from './utils/models';
import {
  createIntersectedSet
} from './utils/intersection';
import {
  unique
} from './utils/math';
import Backbone from 'backbone';
import Logging from 'core/js/logging';

/**
 * Assign a unique id to the set if none is given.
 * @param {IntersectionSet} set
 */
function assignAutoId(set) {
  if (set.id) return;
  if (!set.type && !set.modelId) {
    Logging.error(`Cannot register a scoring set with no id or type or modelId ${set.constructor.name}`);
  }
  const prefix = set.type || set.modelId || 'unknown';
  // Find unused index "prefix-1"
  const allSets = getAllSets();
  let index = 0;
  let id = '';
  while ((id = prefix + '-' + index++) && allSets.find(set => set.id === id));
  set.id = id;
  Logging.debug(`Created id ${set.id} for ${set.constructor.name}`);
}

/**
 * Set at which intersections and queries can be performed.
 */
export default class IntersectionSet extends Backbone.Controller {

  /**
   * @param {Object} options
   * @param {string} [options._id=null] Unique set id
   * @param {string} [options._type=null] Type of set
   * @param {string} [options._title=null] Set title
   * @param {Backbone.Model} [options._model=null] Model of set configuration or orientation
   * @param {Backbone.Model[]} [options._models=null] Models which belong to the set
   * @param {string} [options.title=null] Human readable alternative for _title
   * @param {Backbone.Model} [options.model=null] Human readable alternative for _model
   * @param {Backbone.Model[]} [options.models=null] Human readable alternative for _models
   * @param {IntersectionSet} [options.intersectionParent=null] System defined intersection parent
   */
  initialize({
    // To help with cloning, option names should reflect the enumerable properties on the instance
    _id = null,
    _type = null,
    _title = '',
    _model = null,
    _models = null,
    // There are a few human readable alternatives for easily confused properties
    title = '',
    model = null,
    models = null,
    // When creating an intersected clone, a parent is needed
    intersectionParent = null
  } = {}) {
    this.intersectionParent = intersectionParent;
    this.id = _id;
    this.type = _type;
    // Make sure to use the human readable alternatives where the enumerable ones are not provided
    this.title = _title ?? title;
    (_model ?? model) && (this.model = _model ?? model);
    (_models ?? models) && (this.models = _models ?? models);
    // Do not register intersected sets
    if (this.isIntersectedSet) return;
    this.register();
  }

  /**
   * Create a clone of this instance, intersected over the intersectionParent.
   * This will reduce this.models by intersecting with the intersectionParent.models.
   * @param {IntersectionSet} intersectionParent
   * @returns {IntersectionSet}
   */
  intersect(intersectionParent) {
    // Create a clone of this instance, assign the clone an intersectionParent by which to
    // filter its models accordingly
    // Only the enumerable instance properties of this instance are passed through to the clone
    // i.e. _id, _type, _title, _model, _models not id, type, title, model, models
    const Class = Object.getPrototypeOf(this).constructor;
    const options = { ...this, intersectionParent };
    return new Class(options);
  }

  /**
   * Register the set.
   * @private
   * @fires Adapt#scoring:[set.type]:register
   * @fires Adapt#scoring:set:register
   */
  register() {
    // Only register root sets, intersection subsets are dynamically created when required
    if (this.isIntersectedSet) return;
    assignAutoId(this);
    Adapt.scoring.register(this);
    Adapt.trigger(`scoring:${this.type}:register scoring:set:register`, this);
  }

  /**
   * Unique id for this set. Will be automatically generated if not set.
   * query example: `#id` or `[#id]` or `[id=id]`
   * @returns {string}
   */
  get id() {
    return this._id;
  }

  set id(value) {
    this._id = value;
  }

  /**
   * Returns the set type.
   * query example: `type` or `[type=type]`
   * @returns {string}
   */
  get type() {
    return this._type;
  }

  set type(value) {
    this._type = value;
  }

  /**
   * Returns the set title.
   * @returns {string}
   */
  get title() {
    return this._title;
  }

  set title(value) {
    this._title = value;
  }

  /**
   * Lifecycle processing order.
   * @returns {number}
   */
  get order() {
    return 400;
  }

  /**
   * Returns whether the set is enabled.
   * query example: `(isEnabled)` or `(isEnabled=false)`
   * @returns {boolean}
   */
  get isEnabled() {
    return true;
  }

  /**
   * Returns whether the set is optional.
   * query example: `(isOptional)` or `(isOptional=false)`
   * @returns {boolean}
   */
  get isOptional() {
    return false;
  }

  /**
   * Returns whether the set is available.
   * query example: `(isAvailable)` or `(isAvailable=false)`
   * @returns {boolean}
   */
  get isAvailable() {
    return true;
  }

  /**
   * Returns whether the set's model is available in the model hierarchy.
   * @return {boolean}
   */
  get isModelAvailableInHierarchy() {
    return isModelAvailableInHierarchy(this.model);
  }

  /**
   * Check to see if there are any child models.
   * query example: `(isPopulated)` or `(isPopulated=false)`
   * @returns {boolean}
   */
  get isPopulated() {
    // TODO: do these need to be over this.availableModels instead ?
    return Boolean(this.models?.length);
  }

  /**
   * Check to see if there are any child models.
   * query example: `(isNotPopulated)` alias for `(isPopulated=false)`
   * @returns {boolean}
   */
  get isNotPopulated() {
    return (this.isPopulated === false);
  }

  /**
   * Returns all intersected subsets.
   * @returns {IntersectionSet[]}
   */
  get intersectedSubsets() {
    let sets = getAllSets({ excludeParent: this });
    sets = sets.map(set => createIntersectedSet([this, set]));
    return sets;
  }

  /**
   * Returns all intersected subsets that contain models.
   * @returns {IntersectionSet[]}
   */
  get populatedIntersectedSubsets() {
    return this.intersectedSubsets.filter(set => set.isPopulated);
  }

  /**
   * Returns the parent set over which this set is intersected.
   * @returns {IntersectionSet|null}
   */
  get intersectionParent() {
    return this._intersectionParent;
  }

  set intersectionParent(value) {
    this._intersectionParent = value;
  }

  /**
   * Is an intersected clone.
   * @returns {boolean}
   */
  get isIntersectedSet() {
    return Boolean(this.intersectionParent);
  }

  /**
   * If an intersected set, returns this set including its ancestors.
   * @returns {IntersectionSet[]}
   */
  get subsetPath() {
    let subject = this;
    const path = [];
    while (subject) {
      path.push(subject);
      subject = subject.intersectionParent;
    }
    return path.reverse();
  }

  /**
   * The config or origin model at which the set is oriented.
   * @returns {Backbone.Model}
   */
  get model() {
    return this._model;
  }

  set model(value) {
    this._model = value;
  }

  /**
   * The config or origin model id, used for querying.
   * query example: `[modelId=modelId]`
   * @returns {string}
   */
  get modelId() {
    return this.model?.get('_id');
  }

  /**
   * Returns a unique array of subject models, filtered according to hierarchy intersections
   * with the intersectionParent.models.
   * By default will return the children and detached models of this.model.
   * If this.model is set, then the overridden models will be used.
   * @returns {Backbone.Model[]}
   */
  get models() {
    const models = this._models ?? getModelChildren(this._model, { allowDetached: true });
    return this.filterModels(models, this.intersectionParent?.models);
  }

  set models(value) {
    this._models = value;
  }

  /**
   * Returns models filtered according to hierarchy intersections with the intersectionParent.models.
   * @param {Backbone.Model[]} models
   * @returns {Backbone.Model[]}
   */
  filterModels(models) {
    return unique(filterModelsByIntersectingModels(models, this.intersectionParent?.models));
  }

  /**
   * Returns all `_isAvailable` models, excluding detached models.
   * @returns {ComponentModel[]}
   */
  get availableModels() {
    return this.models.filter(isModelAvailableInHierarchy);
  }

  /**
   * Returns all component models regardless of `_isAvailable`.
   * @returns {ComponentModel[]}
   */
  get components() {
    return this.models.reduce((components, model) => {
      const models = model.isTypeGroup('component')
        ? [model]
        : findDescendantModels(model, 'component');
      return components.concat(models);
    }, []);
  }

  /**
   * Returns all `_isAvailable` component  models, excluding detached models.
   * @returns {ComponentModel[]}
   */
  get availableComponents() {
    return this.components.filter(isModelAvailableInHierarchy);
  }

  /**
   * Returns all question models regardless of `_isAvailable`.
   * @returns {QuestionModel[]}
   */
  get questions() {
    return this.components.filter(model => model.isTypeGroup('question'));
  }

  /**
   * Returns all `_isAvailable` question models, excluding detached models.
   * @returns {QuestionModel[]}
   */
  get availableQuestions() {
    return this.questions.filter(isModelAvailableInHierarchy);
  }

  /**
   * Returns all presentation component models regardless of `_isAvailable`.
   * @returns {QuestionModel[]}
   */
  get presentationComponents() {
    return this.components.filter(model => !model.isTypeGroup('question'));
  }

  /**
   * Returns all `_isAvailable` presentation component models, excluding detached models.
   * @returns {QuestionModel[]}
   */
  get availablePresentationComponents() {
    return this.presentationComponents.filter(isModelAvailableInHierarchy);
  }

  /**
   * Returns all trackable components - excludes trickle etc.
   * @returns {ComponentModel[]}
   */
  get trackableComponents() {
    return this.components.filter(model => model.get('_isTrackable') !== false);
  }

  /**
   * Returns all `_isAvailable` trackable components - excludes trickle etc, excluding detached models.
   * @returns {ComponentModel[]}
   */
  get availableTrackableComponents() {
    return this.trackableComponents.filter(isModelAvailableInHierarchy);
  }

  /**
   * Returns intersected subsets by id.
   * @param {string} setId
   * @returns {IntersectionSet[]}
   */
  getSubsetById(setId) {
    const sets = getAllSets({ excludeParent: this });
    const set = findSetById(sets, setId);
    if (!set) return null;
    return createIntersectedSet([this, set]);
  }

  /**
   * Returns intersected subsets by type.
   * @param {string} setType
   * @returns {IntersectionSet[]}
   */
  getSubsetsByType(setType) {
    let sets = getAllSets({ excludeParent: this });
    sets = filterSetsByType(sets, setType);
    sets = sets.map(set => createIntersectedSet([this, set]));
    return sets;
  }

  /**
   * Returns intersected subsets by modelId.
   * @param {string} modelId
   * @returns {IntersectionSet[]}
   */
  getSubsetsByIntersectingModelId(modelId) {
    let sets = getAllSets({ excludeParent: this });
    sets = filterSetsByIntersectingModelId(sets, modelId);
    sets = sets.map(set => createIntersectedSet([this, set]));
    return sets;
  }
}
