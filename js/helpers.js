import Handlebars from 'handlebars';
import {
  getSubsetsByQuery
} from './utils/query';
import {
  sum
} from './utils/math';
import {
  getScaledScoreFromMinMax,
  getAverageScaledScore
} from './utils/scoring';
/** @typedef {import("./IntersectionSet").default} IntersectionSet */

// Global handlebars helpers

/**
 * Returns the intersected subsets of the intersection query string for the handlebars context.
 * @see {@link ../INTERSECTION_QUERY.md INTERSECTION_QUERY}
 * @param {string} query
 * @param {*} context
 * @returns {IntersectionSet[]}
 */
export function getSubsetsFromQueryContext(query, context) {
  if (!context) throw Error('No context for getSubsetsFromQueryContext helper.');
  const modelId = context?.data?.root?._id;
  if (modelId) query = query.replace(/\bthis\b/g, modelId);
  return getSubsetsByQuery(query);
}

const helpers = {
  /**
   * Returns the intersected subsets of the intersection query string.
   * @see {@link ../INTERSECTION_QUERY.md INTERSECTION_QUERY}
   * @example <ul>{{#each (subsetsQuery '[modelId=this](isScoreIncluded)')}}<li>{{{this._title}}}</li>{{/each}}</ul> - list all sets which intersect this model and are included in the total
   * @example <ul>{{#each (subsetsQuery '[isScoreIncluded](isPassed)')}}<li>{{{this._title}}}</li>{{/each}}</ul> - list all passed sets which are included in the total
   * @param {string} query
   * @param {*} context
   * @returns {IntersectionSet[]}
   */
  subsetsQuery(query, context) {
    return getSubsetsFromQueryContext(query, context);
  },

  /**
   * Returns the summed score for the intersected subsets of the intersection query string.
   * @see {@link ../INTERSECTION_QUERY.md INTERSECTION_QUERY}
   * @example {{{scoreQuery '#this'}}} - score for this model
   * @example {{{scoreQuery '#this total'}}} - summed score for sets which intersect this model and are included in the total
   * @example {{{scoreQuery 'assessment'}}} - summed score for all assessments
   * @example {{{scoreQuery 'total'}}} - score for `TotalSets`
   * @param {string} query
   * @param {*} context
   * @returns {number}
   */
  scoreQuery(query, context) {
    const sets = getSubsetsFromQueryContext(query, context);
    return sum(sets, 'score');
  },

  /**
   * Returns the scaledScore for the intersected subsets of the intersection query string.
   * @see {@link ../INTERSECTION_QUERY.md INTERSECTION_QUERY}
   * @example {{{scaledScoreQuery '#this'}}} - scaledScore for this model
   * @example {{{scaledScoreQuery '#this total'}}} - scaledScore for sets which intersect this model and are included in the total
   * @example {{{scoreQuery 'assessment'}}} - summed scaledScore for all assessments
   * @example {{{scaledScoreQuery 'total'}}} - scaledScore for `TotalSets`
   * @param {string} query
   * @param {*} context
   * @returns {number}
   */
  scaledScoreQuery(query, context) {
    const sets = getSubsetsFromQueryContext(query, context);
    const score = sum(sets, 'score');
    const minScore = sum(sets, 'minScore');
    const maxScore = sum(sets, 'maxScore');
    return getScaledScoreFromMinMax(score, minScore, maxScore);
  },

  /**
   * Returns the average scaledScore for the intersected subsets of the intersection query string.
   * @see {@link ../INTERSECTION_QUERY.md INTERSECTION_QUERY}
   * @example {{{averageScaledScoreQuery '#this'}}} - avaerage scaledScore for this model
   * @example {{{averageScaledScoreQuery '#this total'}}} - average scaledScore for sets which intersect this model and are included in the total
   * @example {{{averageScaledScoreQuery 'assessment'}}} - average scaledScore for all assessments
   * @example {{{averageScaledScoreQuery 'total'}}} - average scaledScore for `TotalSets`
   * @param {string} query
   * @param {*} context
   * @returns {number}
   */
  averageScaledScoreQuery(query, context) {
    const sets = getSubsetsFromQueryContext(query, context);
    return getAverageScaledScore(sets);
  }
};

for (const name in helpers) {
  Handlebars.registerHelper(name, helpers[name]);
}
