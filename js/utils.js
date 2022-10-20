import Adapt from 'core/js/adapt';
import data from 'core/js/data';

/** @typedef {import("./ScoringSet").default} ScoringSet */

/**
 * Returns set model arrays by applying standard uniqueness, `_isAvailable` and subset intersection filters
 * @param {ScoringSet} set
 * @param {[Backbone.Models]} models
 * @returns {[Backbone.Models]}
 */
export function filterModels(set, models) {
  if (!models) return null;
  models = [...new Set(models)];
  if (set.subsetParent?.models) {
    // Return only this set's items intersecting with or with intersecting descendants or ancestors from the parent list
    models = filterIntersectingHierarchy(models, set.subsetParent.models);
  }
  return models.filter(isAvailableInHierarchy);
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
 * @returns {boolean}
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
export function createIntersectionSubset(sets, filters = null) {
  const subsetParent = sets[0];
  const columnFilters = filters?.[0];
  if (columnFilters && !applyFilters(columnFilters, subsetParent)) {
    return null;
  }
  if (sets.length === 1) return subsetParent;
  return sets.slice(1).reduce((subsetParent, set, index) => {
    if (!subsetParent) return null;
    if (!set) return subsetParent;
    const Class = Object.getPrototypeOf(set).constructor;
    const queryInstance = new Class(set, subsetParent);
    const columnFilters = filters?.[index + 1];
    if (columnFilters && !applyFilters(columnFilters, queryInstance)) {
      return null;
    }
    return queryInstance;
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
 * @param {string} type
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
 * @param {string} id
 * @param {ScoringSet} [subsetParent]
 * @returns {[ScoringSet]}
 */
export function getSubsetsByModelId(id, subsetParent = undefined) {
  const models = [data.findById(id)];
  let sets = getRawSets(subsetParent).filter(set => hasIntersectingHierarchy(set.models, models));
  if (subsetParent) {
    // Create intersection sets between the found sets and the subsetParent
    sets = sets.map(set => createIntersectionSubset([subsetParent, set]));
  }
  return sets;
}

/**
 * Returns the root set by id or the intersection from the subsetParent by id
 * @param {string} id
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
 * @param {[string]|string} path
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

/**
 * Returns the percentage position of score between a positive minScore or zero and maxScore
 * A negative percentage correct is not possible with this function
 * @param {number} score
 * @param {number} minScore
 * @param {number} maxScore
 * @returns {number}
 */
export function getScaledScoreFromMinMax(score, minScore, maxScore) {
  // Ensure minScore cannot be less than zero as negtive percentage correct makes no sense
  if (minScore < 0) minScore = 0;
  const range = maxScore - minScore;
  const relativeScore = score - minScore;
  return Math.round((relativeScore / range) * 100);
}

/**
 * @param {Backbone.Model} model
 * @returns {boolean}
 */
export function isAvailableInHierarchy(model) {
  return model.getAncestorModels(true).every(model => model.get('_isAvailable'));
}

/**
 * Returns an array of all combinations of the matrix row values
 * @param {[[any]]} matrix
 * @returns {[any]}
 */
export function matrixMultiply (matrix) {
  if (matrix.length === 0) return [];
  const partLengths = matrix.map(part => part.length); // how large each row is
  if (partLengths.some(length => length === 0)) return []; // cannot multiply an empty row
  const subPartIndices = '0'.repeat(matrix.length).split('').map(Number); // how far we've gone in each row
  let isEnded = false;
  const sumsToPerform = [];
  while (isEnded === false) {
    sumsToPerform.push(subPartIndices.reduce((sum, subPartIndex, partIndex) => {
      sum.push(matrix[partIndex][subPartIndex]);
      return sum;
    }, []));
    isEnded = !subPartIndices.some((subPartIndex, partIndex) => {
      subPartIndex++;
      if (subPartIndex < partLengths[partIndex]) {
        subPartIndices[partIndex] = subPartIndex;
        return true;
      }
      subPartIndices[partIndex] = 0;
      return false;
    });
  }
  return sumsToPerform;
}

const majorPartRegExp = /([^ []*(?:[[(]{1}[^\])]+[\])]{1})*)/g;
const attributePartRegEx = /[[(]{1}[^\])]+[\])]{1}/g;
/**
 * Takes a subset intersection query string and transforms it into an array of filter objects
 * @param {string} query
 * @returns {[[{}]]}
 */
export function parseQuery(query = '') {
  const queryMajors = query.split(majorPartRegExp).map(section => section?.trim()).filter(Boolean);
  const filterParts = queryMajors.map(queryMajor => {
    const attributeQueryParts = queryMajor.match(attributePartRegEx);
    const openingQueryPart = queryMajor.replace(attributePartRegEx, '');
    const majorFilterPart = [];
    if (openingQueryPart[0] === '#') {
      // select by id
      majorFilterPart.push({
        id: openingQueryPart.slice(1)
      });
    } else if (openingQueryPart) {
      // select by type
      majorFilterPart.push({
        type: openingQueryPart
      });
    }
    if (attributeQueryParts) {
      const multiplyAttributeParts = attributeQueryParts.filter(part => part[0] === '[').map(attributeQueryPart => {
        const attributeQueryPartMiddle = attributeQueryPart.slice(1, -1);
        const attributeQueryPartSections = attributeQueryPartMiddle.split(',').map(section => section.trim()).filter(Boolean);
        const attributeFilterPart = attributeQueryPartSections.map(section => {
          if (section[0] === '#') {
            return { id: section.slice(1) };
          }
          const [name, value] = section.split('=').map(section => section.trim()).filter(Boolean);
          return { [name]: value };
        });
        return attributeFilterPart;
      });
      const filterAttributeParts = attributeQueryParts.filter(part => part[0] === '(').map(attributeQueryPart => {
        const attributeQueryPartMiddle = attributeQueryPart.slice(1, -1);
        const attributeQueryPartSections = attributeQueryPartMiddle.split(',').map(section => section.trim()).filter(Boolean);
        const attributeFilterPart = attributeQueryPartSections.map(section => {
          if (section[0] === '#') {
            return { id: section.slice(1) };
          }
          const [name, value] = section.split('=').map(section => section.trim()).filter(Boolean);
          return { [name]: value };
        });
        return attributeFilterPart;
      });
      const flattenedFilterAttributeObjects = filterAttributeParts.map(part => Object.assign({}, ...part));
      const multipliedAttributeParts = matrixMultiply([majorFilterPart, ...multiplyAttributeParts].filter(item => item?.length));
      const flattenedMultiplyObjects = multipliedAttributeParts.map(query => Object.assign({}, ...query));
      flattenedMultiplyObjects.push(flattenedFilterAttributeObjects);
      return flattenedMultiplyObjects;
    }
    majorFilterPart.push([]);
    return majorFilterPart;
  });
  return filterParts;
}

export function applyFilter(filter, set) {
  for (const k in filter) {
    const setValue = set[k];
    const filterValue = filter[k];
    if (typeof setValue === 'function') {
      if (!setValue.call(set, filterValue)) return false; // check for modelTypeGroup('question')
      continue;
    }
    if (filterValue === undefined) {
      if (!setValue) return false; // check for Boolean(isComplete)
    } else if (String(setValue) !== String(filterValue)) {
      return false; // check for id==='a-05'
    }
  }
  return true;
}

export function applyFilters(filters, set) {
  return filters.every(filter => applyFilter(filter, set));
}

/**
 * Takes a subset intersection query string and returns the resultant intersected subsets
 * @param {string} query
 * @param {ScoringSet} [subsetParent]
 * @returns {[ScoringSet]}
 */
export function getSubsetsByQuery(query, subsetParent = undefined) {
  const allSubsets = getSubsets(subsetParent);
  const parsedQueryMatrix = parseQuery(query);
  const subsetQueryMatrix = parsedQueryMatrix.map(row => {
    const selectionFilters = row.slice(0, -1);
    return selectionFilters
      .map((selectionFilter) => {
        // Apply modelIdFilter
        const hasModelIdFilter = Object.prototype.hasOwnProperty.call(selectionFilter, 'modelId');
        const filterSubsets = !hasModelIdFilter
          ? allSubsets
          : getSubsetsByModelId(selectionFilter.modelId, subsetParent);
        if (hasModelIdFilter) delete selectionFilter.modelId;
        // Return only filtered sets
        return filterSubsets.filter(set => applyFilter(selectionFilter, set));
      })
      .flat();
  });
  const intersectionQueryLists = matrixMultiply(subsetQueryMatrix);
  let columnInclusionFilters = parsedQueryMatrix.map(row => row.lastItem);
  if (subsetParent) columnInclusionFilters = [[]].concat(columnInclusionFilters);
  const intersectedSubsets = intersectionQueryLists.map(intersectionQueryList => {
    if (subsetParent) return createIntersectionSubset([subsetParent, ...intersectionQueryList], columnInclusionFilters);
    return createIntersectionSubset(intersectionQueryList, columnInclusionFilters);
  }).filter(Boolean);
  return intersectedSubsets;
}
