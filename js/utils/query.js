import {
  getAllSets,
  filterSetsByIntersectingModelId
} from './sets';
import {
  createIntersectedSet,
  isWhereMatch
} from './intersection';
import {
  matrixMultiply,
  unique
} from './math';

const queryColumnRegEx = /([^ []*(?:[[(]{1}[^\])]+[\])]{1})*)/g;
const queryColumnAttributeRegEx = /[[(]{1}[^\])]+[\])]{1}/g;

/**
 * Takes a subset intersection query string and returns the resultant intersected subsets
 * See (intersection query document)[../../INTERSECTION_QUERY.md]
 * @param {string} query
 * @returns {IntersectionSet[]}
 */
export function getSubsetsByQuery(query) {
  const allSets = getAllSets();
  const columns = parseQuery(query);
  const columnsSelects = columns.map(({ selects }) => selects);
  const columnsFilters = columns.map(({ filters }) => filters);
  const columnsSets = columnsSelects.map(columnSelects =>
    columnSelects.flatMap(selectWhere => {
    // Apply modelId rule as an intersection rather than a literal
      const hasModelIdRule = Object.hasOwn(selectWhere, 'modelId');
      const selectSubsets = !hasModelIdRule
        ? allSets
        : filterSetsByIntersectingModelId(allSets, selectWhere.modelId);
      if (hasModelIdRule) {
        selectWhere = { ...selectWhere };
        delete selectWhere.modelId;
      }
      // Return only filtered sets
      return selectSubsets.filter(set => isWhereMatch(set, selectWhere));
    })
  );
  const intersections = matrixMultiply(columnsSets);
  const intersectedSubsets = unique(intersections.map(columnsSet => {
    return createIntersectedSet(columnsSet, { filters: columnsFilters });
  }).filter(Boolean));
  return intersectedSubsets;
}

/**
 * Takes a subset intersection query string and transforms it into an array of select and filter objects
 * See (intersection query document)[../../INTERSECTION_QUERY.md]
 * @param {string} query
 * @returns {Object[][]}
 */
function parseQuery(query = '') {
  const columns = query.split(queryColumnRegEx).map(column => column?.trim()).filter(Boolean);
  const parsedColumns = columns.map(column => {
    const primarySelects = [];
    const firstQueryPart = column.replace(queryColumnAttributeRegEx, '');
    const isIdSelector = (firstQueryPart[0] === '#');
    if (isIdSelector) {
      // Select by id
      primarySelects.push({
        id: firstQueryPart.slice(1)
      });
    } else if (firstQueryPart) {
      // Select by type
      primarySelects.push({
        type: firstQueryPart
      });
    }
    const attributeQueryParts = column.match(queryColumnAttributeRegEx);
    if (!attributeQueryParts) {
      return {
        selects: primarySelects,
        filters: []
      };
    }
    const multiplyByObjects = parseQueryAttributes(attributeQueryParts, '[');
    // Multiply the primary select by id or type, by the select by attributes
    const multipliedObjects = matrixMultiply([primarySelects, ...multiplyByObjects].filter(item => item?.length));
    const combinedMultipliedSelects = multipliedObjects.map(objects => Object.assign({}, ...objects));
    // Separate the filter attributes for after the selects are performed
    const filterObjects = parseQueryAttributes(attributeQueryParts, '(');
    const filters = filterObjects.map(objects => Object.assign({}, ...objects));
    return {
      selects: combinedMultipliedSelects,
      filters
    };
  });
  return parsedColumns;
}

/**
 * Parses query attributes and returns attribute name: value pair objects.
 * See (intersection query document)[../../INTERSECTION_QUERY.md]
 * @param {string} attributeQueryParts
 * @param {string} startCharacter
 * @returns {Object[]}
 */
function parseQueryAttributes (attributeQueryParts, startCharacter) {
  return attributeQueryParts.filter(part => part[0] === startCharacter).map(attributeQueryPart => {
    const attributeQueryPartMiddle = attributeQueryPart.slice(1, -1);
    const attributeQueryPartSections = attributeQueryPartMiddle.split(',').map(section => section.trim()).filter(Boolean);
    return attributeQueryPartSections.map(section => {
      if (section[0] === '#') return { id: section.slice(1) };
      const [name, value] = section.split('=').map(section => section.trim()).filter(Boolean);
      return { [name]: value };
    });
  });
}
