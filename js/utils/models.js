import Backbone from 'backbone';
import Data from 'core/js/data';
import {
  unique
} from './math';

/**
 * Returns a boolean at _isAvailable across the model and its ancestors
 * allowDetached returns true if the model is not in its parent.getChildren() collection
 * @param {Backbone.Model} model
 * @param {Object} [options]
 * @param {boolean} [options.allowDetached=false] If true, the model can be detached from its parent
 * @returns {boolean}
 */
export function isModelAvailableInHierarchy(model, { allowDetached = false } = {}) {
  const ancestors = model.getAncestorModels(true);
  return ancestors.every(model => {
    if (!model.get('_isAvailable')) return false;
    if (allowDetached) return true;
    return isModelAttached(model);
  });
}

/**
 * Returns a boolean if the model is in its parent.getChildren() collection
 * @param {Backbone.Model} model
 * @returns {boolean}
 */
function isModelAttached(model) {
  const parent = model.getParent();
  if (!parent) return true;
  const isModelAttached = parent.getChildren().has(model);
  return isModelAttached;
}

/**
 * Alternative version of getChildren that can also return detached children
 * Uses Data.findById(parentId) rather than model.getChildren()
 * @param {Backbone.Model} model
 * @param {Object} [options]
 * @param {boolean} [options.allowDetached=true] If false, the children cannot be detached from their parent
 * @returns {Backbone.Model[]}
 */
export function getModelChildren(model, { allowDetached = true } = {}) {
  const models = modelsByParentId[model.get('_id')].slice(0);
  if (!allowDetached) return models.filter(isModelAttached);
  return models;
}

/**
 * Alternative version of findDescendantModels that can also return detached children
 * Uses Data.findById(parentId) rather than model.getChildren()
 * @param {Backbone.Model} model
 * @param {string} typeGroup
 * @param {Object} [options]
 * @param {boolean} [options.allowDetached=true] If false, the children cannot be detached from their parent
 * @returns {Backbone.Model[]}
 */
export function findDescendantModels(model, typeGroup, { allowDetached = true } = {}) {
  const models = getAllDescendantModels(model)
    .filter(model => model.isTypeGroup(typeGroup));
  if (!allowDetached) return models.filter(isModelAttached);
  return models;
}

// Keep an index of the models by parent id
let modelsByParentId = {};
const observer = Object.assign({}, Backbone.Events);
function indexModelsByParentId() {
  modelsByParentId = Data.groupBy(model => model.get('_parentId'));
}
observer.listenTo(Data, {
  add: indexModelsByParentId,
  remove: indexModelsByParentId
});

/**
 * Return true only if modelsA directly or indirectly intersect with the modelsB
 * @param {Backbone.Model[]} modelsA
 * @param {Backbone.Model[]} modelsB
 * @returns {boolean}
 */
export function areModelsIntersectingModels(modelsA, modelsB) {
  if (!modelsA) return false;
  modelsA = unique(modelsA);
  if (!modelsB) return false;
  modelsB = unique(modelsB);
  const modelsBIds = modelsB.map(model => model.get('_id'));
  const modelsBDescendantIds = Object.keys(modelsB
    .flatMap(model => getAllDescendantModels(model))
    .groupBy(model => model.get('_id')));
  const modelsBAncestorIds = Object.keys(modelsB
    .flatMap(model => model.getAncestorModels())
    .groupBy(model => model.get('_id')));
  return modelsA.some(modelA => {
    const modelAId = modelA.get('_id');
    const isEqual = modelsBIds.includes(modelAId);
    if (isEqual) return true;
    const isDescendant = modelsBDescendantIds.includes(modelAId);
    if (isDescendant) return true;
    const isAncestor = modelsBAncestorIds.includes(modelAId);
    return isAncestor;
  });
}

/**
 * Return only modelsA that intersect with the modelsB
 * Equal intersection is when the first and second model are equal
 * Descendant intersection is when the first model is a descendant of the second
 * Ancestor intersection is when the first model is a ancestor of the second
 * Intersections identify models which have overlapping interests in the hierarchy
 * @param {Backbone.Model[]} modelsA
 * @param {Backbone.Model[]} modelsB
 * @returns {Backbone.Model[]}
 */
export function filterModelsByIntersectingModels(modelsA, modelsB) {
  if (!modelsA) return [];
  modelsA = unique(modelsA);
  if (!modelsB) return modelsA;
  modelsB = unique(modelsB);
  const modelsBIds = modelsB.map(model => model.get('_id'));
  const modelsBDescendantIds = Object.keys(modelsB
    .flatMap(model => getAllDescendantModels(model))
    .groupBy(model => model.get('_id')));
  const modelsBAncestorIds = Object.keys(modelsB
    .flatMap(model => model.getAncestorModels())
    .groupBy(model => model.get('_id')));
  return unique(modelsA.filter(modelA => {
    const modelAId = modelA.get('_id');
    const isEqual = modelsBIds.includes(modelAId);
    if (isEqual) return true;
    const isDescendant = modelsBDescendantIds.includes(modelAId);
    if (isDescendant) return true;
    const isAncestor = modelsBAncestorIds.includes(modelAId);
    return isAncestor;
  }));
}

/**
 * Alternative version of getAllDescendantModels, which also returns detached children
 * Uses Data.findById(parentId) rather than model.getChildren()
 * @param {Backbone.Model} model
 * @param {Object} [options]
 * @param {boolean} [options.isParentFirst=true]
 * @returns {Backbone.Model[]}
 */
export function getAllDescendantModels(model, { isParentFirst = true } = {}) {
  const descendants = [];
  const stack = [
    [model]
  ];
  const subject = [];
  while (stack.length) {
    const currentStackIndex = stack.length - 1;
    const parentIndex = currentStackIndex - 1;
    const currentStack = stack[currentStackIndex];
    const shouldMoveDown = (!currentStack.length);
    if (shouldMoveDown) {
      stack.pop();
      subject.pop();
      const hasParent = (parentIndex >= 0);
      if (isParentFirst || !hasParent) continue;
      // add child first parent
      const parent = subject[parentIndex];
      descendants.push(parent);
      continue;
    }
    const nextModel = currentStack.shift();
    subject[currentStackIndex] = nextModel;
    if (isParentFirst) {
      // add parent first
      descendants.push(nextModel);
    }
    const id = nextModel.get('_id');
    const children = (modelsByParentId[id] ?? []).slice(0);
    const hasChildren = Boolean(children.length);
    if (hasChildren) {
      stack.push(children);
      continue;
    }
    if (isParentFirst) continue;
    // add child first
    descendants.push(nextModel);
  }
  return descendants;
}
