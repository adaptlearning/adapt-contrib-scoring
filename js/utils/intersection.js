import {
  getAllSets,
  findSetById
} from './sets';

/** @typedef {import("../IntersectionSet").default} IntersectionSet */

/**
 * Return an intersection of all of the sets along a path.
 * @param {[string]|string} path
 * @returns {IntersectionSet}
 */
export function getPathSetsIntersected(path) {
  if (typeof path === 'string') {
    // Allow 'id.id.id' style lookup
    path = path.split('.');
  }
  // Fetch all of the sets named in the path in order
  const allSets = getAllSets();
  const sets = path.map(id => findSetById(allSets, id));
  return createIntersectedSet(sets);
}

/**
 * Returns a cloned intersection subset from the given array of sets.
 * Reduces from left to right, returning the class of the furthest right most set.
 * It makes a pipe of parent-child relations which reduce the models in the next subset.
 * @param {IntersectionSet[]} sets Chain of sets to intersect
 * @param {Object} [options]
 * @param {Object[][]} [options.filters=null] Part of query interface. An array of arrays of where objects to match at each intersection step. isComplete, isPopulated, etc
 * @returns {IntersectionSet}
 */
export function createIntersectedSet(sets, { filters = null } = {}) {
  const firstSet = sets[0];
  const firstWheres = filters?.[0];
  if (firstWheres && !isWhereMatch(firstSet, firstWheres)) {
    // Return null when initial set is excluded by where
    return null;
  }
  const isOnlyOneSet = (sets.length === 1);
  if (isOnlyOneSet) return firstSet;
  const intersectionParent = firstSet;
  const subsets = sets.slice(1);
  const intersectionModel = subsets.reduce((intersectionParent, subset, index) => {
    if (!intersectionParent) return null;
    if (!subset) return intersectionParent;
    const queryInstance = subset.intersect(intersectionParent);
    const wheres = filters?.[index + 1];
    if (wheres && !isWhereMatch(queryInstance, wheres)) {
      // Return null when intersecting set is excluded by where object
      return null;
    }
    return queryInstance;
  }, intersectionParent);
  return intersectionModel;
}

/**
 * Match a set against all where objects.
 * [{
 *   modelTypeGroup: 'question',
 *   isComplete: undefined,
 *   isPopulated: false,
 *   id: 'a-05
 * }]
 * @param {IntersectionSet} set
 * @param {Object[]|Object} wheres
 * @returns {boolean}
 */
export function isWhereMatch(set, wheres) {
  if (!Array.isArray(wheres)) wheres = [wheres];
  // return false if not matching every
  for (const where of wheres) {
    for (const k in where) {
      const setValue = set[k];
      const whereValue = where[k];
      const isFunction = (typeof setValue === 'function');
      const isTruthy = (whereValue === undefined);
      const isStringComparison = (!isFunction && !isTruthy);
      if (isFunction) {
        // i.e. check for modelTypeGroup('question')
        const resolvedSetValue = setValue.call(set, whereValue);
        if (!resolvedSetValue) return false;
      } else if (isTruthy) {
        // i.e. check for Boolean(isComplete)
        if (!setValue) return false;
      } else if (isStringComparison) {
        // i.e. check for id==='a-05'
        if (String(setValue) !== String(whereValue)) return false;
      }
    }
  }
  return true;
}
