import Adapt from 'core/js/adapt';
import Data from 'core/js/data';
import {
  areModelsIntersectingModels
} from './models';
import {
  unique
} from './math';

/** @typedef {import("../IntersectionSet").default} IntersectionSet */

/**
 * Returns all sets or all sets without the specified excludeParent.
 * @param {Object} [options]
 * @param {IntersectionSet} [options.excludeParent=null]
 * @returns {IntersectionSet[]}
 */
export function getAllSets({ excludeParent = null } = {}) {
  if (!excludeParent) return Adapt.scoring.sets;
  return Adapt.scoring.sets.filter(set => !(set.id === excludeParent.id && set.type === excludeParent.type));
}

/**
 * Filters sets by type.
 * @param {IntersectionSet[]} sets
 * @param {string} type
 * @returns {IntersectionSet[]}
 */
export function filterSetsByType(sets, type) {
  return unique(sets.filter(set => type === set.type));
}

/**
 * Filter sets which models intersect the given model id.
 * This is useful for update behaviour on a model change.
 * @param {IntersectionSet[]} sets
 * @param {string} id
 * @returns {IntersectionSet[]}
 */
export function filterSetsByIntersectingModelId(sets, id) {
  if (!id) return [];
  const model = Data.findById(id);
  if (!model) return [];
  const models = [model];
  return unique(sets.filter(set => areModelsIntersectingModels([set.model, ...set.models].filter(Boolean), models)));
}

/**
 * Filter sets which models intersect the given models.
 * @param {IntersectionSet[]} sets
 * @param {string} id
 * @returns {IntersectionSet[]}
 */
export function filterSetsByIntersectingModels(sets, models) {
  if (!sets?.length) return [];
  if (!models?.length) return [];
  sets = unique(sets);
  models = unique(models);
  return sets.filter(set => areModelsIntersectingModels([set.model, ...set.models].filter(Boolean), models));
}

/**
 * Filter sets which live on the given model.
 * This is useful for resetting behaviour over a given model id.
 * @param {IntersectionSet[]} sets
 * @param {string} id
 * @returns {IntersectionSet[]}
 */
export function filterSetsByModelId(sets, id) {
  return unique(sets.filter(set => set.modelId === id));
}

/**
 * Filter sets which are descendants from the given model, but also only inside the relevant content object.
 * This is useful for finding visit and leave subsets on a content object.
 * @param {IntersectionSet[]} sets
 * @param {string} id
 * @returns {IntersectionSet[]}
 */
export function filterSetsByLocalModelId(sets, id) {
  if (!id) return [];
  const model = Data.findById(id);
  if (!model) return [];
  const localContentObject = model.isTypeGroup('contentobject') ? model : model.findAncestor('contentobject');
  return unique(sets.filter(({ model, modelId }) => {
    if (!model) return false;
    const isGivenModel = (modelId === id);
    if (isGivenModel) return true;
    // Do not include any other content object
    const isContentObject = model.isTypeGroup('contentobject');
    if (isContentObject) return false;
    // Only include models which are in the localContentObject
    const modelContentObject = model.findAncestor('contentobject');
    const isInLocalContentObject = (modelContentObject.get('_id') === localContentObject.get('_id'));
    if (!isInLocalContentObject) return false;
    // The models must be a descendant of the given model
    const isDescendantOfGivenModel = model.getAncestorModels().some(model => model.get('_id') === id);
    return isDescendantOfGivenModel;
  }));
}

/**
 * Finds a set by id.
 * @param {IntersectionSet[]} sets
 * @param {string} id
 * @returns {IntersectionSet}
 */
export function findSetById(sets, id) {
  return sets.find(set => id === set.id);
}
