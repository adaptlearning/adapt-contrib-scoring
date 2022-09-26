import Adapt from '../../../core/js/adapt';

/** @typedef {import("./ScoringSet").default} ScoringSet */

/**
 * Returns set model arrays by applying standard uniqueness, `_isAvailable` and subset intersection filters
 * @param {ScoringSet} set
 * @param {[Backbone.Models]} models
 * @returns {[Backbone.Models]}
 */
export function filterModels(set, models) {
  if (!models) return null;
  // @todo: use Set to remove duplicates?
  // models = [...new Set(models)];
  models = _.uniq(models, model => model.get('_id'));

  if (set.subsetParent && set.subsetParent.models) {
    // Return only this set's items intersecting with or with intersecting descendants or ancestors from the parent list
    models = filterIntersectingHierarchy(models, set.subsetParent.models);
  }

  return models.filter(model => model.get('_isAvailable'));
}

/**
 * Returns the percentage position of score between minScore and maxScore
 * @param {Number} score
 * @param {Number} minScore
 * @param {Number} maxScore
 * @returns {Number}
 */
export function getScaledScoreFromMinMax(score, minScore, maxScore) {
  const range = maxScore - minScore;
  const relativeScore = score - minScore;
  return Math.round((relativeScore / range) * 100);
}

/**
 * Returns models from listA which are present in listB, are descendents of listB or have listB models as descendents
 * @param {[Backbone.Model]} listA
 * @param {[Backbone.Model]} listB
 * @returns {[Backbone.Model]}
 */
export function filterIntersectingHierarchy(listA, listB) {
  const listBModels = listB.reduce((allDescendents, model) => allDescendents.concat([model], model.getAllDescendantModels()), []);
  const listBModelsIndex = _.indexBy(listBModels, model => model.get('_id'));

  return listA.filter(model => {
    const isADescendentOfB = listBModelsIndex[model.get('_id')];
    if (isADescendentOfB) return true;
    const listAModels = [model].concat(model.getAllDescendantModels());
    const listAModelsIndex = _.indexBy(listAModels, model => model.get('_id'));
    const isBDescendentOfA = Boolean(Object.keys(listAModelsIndex).find(key => listBModelsIndex[key]));
    if (isBDescendentOfA) return true;
    return false;
  });
}

/**
 * Return a boolean to indicate if any model from listA is present in listB, is a descendents of listB or has listB models as descendents
 * @param {[Backbone.Model]} listA
 * @param {[Backbone.Model]} listB
 * @returns {Boolean}
 */
export function hasIntersectingHierarchy(listA, listB) {
  const listBModels = listB.reduce((allDescendents, model) => allDescendents.concat([model], model.getAllDescendantModels()), []);
  const listBModelsIndex = _.indexBy(listBModels, model => model.get('_id'));

  return Boolean(listA.find(model => {
    const isADescendentOfB = listBModelsIndex[model.get('_id')];
    if (isADescendentOfB) return true;
    const listAModels = [model].concat(model.getAllDescendantModels());
    const listAModelsIndex = _.indexBy(listAModels, model => model.get('_id'));
    const isBDescendentOfA = Boolean(Object.keys(listAModelsIndex).find(key => listBModelsIndex[key]));
    if (isBDescendentOfA) return true;
    return false;
  }));
}

/**
 * Returns a subset from the given sets, reduces from left to right, returning the class of the furthest right most set
 * This effectively makes a pipe of parent-child related sets which use each parent in turn to reduce the models in the next subset
 * @param {[ScoringSet]} sets
 * @returns {ScoringSet}
 */
export function createIntersectionSubset(sets) {
  const subsetParent = sets[0];

  return sets.slice(1).reduce((subsetParent, set) => {
    if (!set) return subsetParent;
    const Class = Object.getPrototypeOf(set).constructor;
    return new Class(set, subsetParent);
  }, subsetParent);
}

/**
 * Returns all sets or all sets without the specified excludeParent
 * @param {ScoringSet} [excludeParent]
 */
export function getRawSets(excludeParent = null) {
  return excludeParent ?
    Adapt.scoring.subsets.filter(set => !(set.id === excludeParent.id && set.type === excludeParent.type)) :
    Adapt.scoring.subsets;
}

/**
 * Returns all root set or the intersection sets from subsetParent
 * @param {ScoringSet} subsetParent
 * @returns {[ScoringSet]}
 */
export function getSubsets(subsetParent = undefined) {
  let sets = getRawSets(subsetParent);

  if (subsetParent) {
    // Create intersection sets between the found sets and the subsetParent
    sets = sets.map(set => createIntersectionSubset([subsetParent, set]));
  }

  return sets;
}

/**
 * Returns all root set of type or the intersection sets from subsetParent of type
 * @param {String} type
 * @param {ScoringSet} [subsetParent]
 * @returns {[ScoringSet]}
 */
export function getSubsetsByType(type, subsetParent = undefined) {
  let sets = getRawSets(subsetParent).filter(set => type === set.type);

  if (subsetParent) {
    // Create intersection sets between the found sets and the subsetParent
    sets = sets.map(set => createIntersectionSubset([subsetParent, set]));
  }

  return sets;
}

/**
 * Returns all root sets or the intersection sets from subsetParent which also intersect the given model
 * @param {String} id
 * @param {ScoringSet} [subsetParent]
 * @returns {[ScoringSet]}
 */
export function getSubsetsByModelId(id, subsetParent = undefined) {
  // @todo: elsewhere data is used to find models
  const models = [Adapt.findById(id)];
  let sets = getRawSets(subsetParent).filter(set => hasIntersectingHierarchy(set.models, models));

  if (subsetParent) {
    // Create intersection sets between the found sets and the subsetParent
    sets = sets.map(set => createIntersectionSubset([subsetParent, set]));
  }

  return sets;
}

/**
 * Returns the root set by id or the intersection from the subsetParent by id
 * @param {String} id
 * @param {ScoringSet} [subsetParent]
 * @returns {ScoringSet}
 */
export function getSubsetById(id, subsetParent = undefined) {
  const sets = getRawSets(subsetParent);
  let set = sets.find(set => id === set.id);

  if (subsetParent) {
    // Create an intersection set between the found set and the subsetParent
    set = createIntersectionSubset([subsetParent, set]);
  }

  return set;
}

/**
 * Create intersection subset from an id path
 * @param {[String]|String} path
 * @param {ScoringSet} [subsetParent]
 * @returns {ScoringSet}
 */
export function getSubSetByPath(path, subsetParent = undefined) {
  if (typeof path === 'string') {
    // Allow 'id.id.id' style lookup
    path = path.split('.');
  }

  // Fetch all of the sets named in the path in order
  const sets = path.map(id => getSubsetById(id));

  if (subsetParent) {
    // Add subsetParent as the starting set
    sets.unshift(subsetParent);
  }

  // Create an intersection set from all found sets in order
  return createIntersectionSubset(sets);
}
