/**
 * Returns only unique items
 * @param {any[]} items
 * @returns {any[]}
 */
export function unique(items) {
  return [...new Set(items)];
}

/**
 * Performs addition on the property `by` of the items, either by string or by function return value
 * @param {Object[]} items A list of items from which to sum a property or function result
 * @param {string|Function} by The name of the property to sum or a function returning the value to sum
 * @returns {number}
 */
export function sum(items, by) {
  switch (typeof by) {
    case 'string':
      return items.reduce((sum, item) => (sum + (item[by] ?? 0)), 0);
    case 'function':
      return items.reduce((sum, item, index) => (sum + (by(item, index) ?? 0)), 0);
  }
}

/**
 * Returns an array of all combinations of the column row values
 * [
 *  [1,2], [4,5], [6,7,8]
 * ] = [
 *  [1,4,6],
 *  [2,4,6],
 *  [1,5,6],
 *  [2,5,6],
 *  [1,4,7],
 *  [2,4,7],
 *  [1,5,7],
 *  [2,5,7],
 *  [1,4,8],
 *  [2,4,8],
 *  [1,5,8],
 *  [2,5,8]
 * ]
 * @param {any[][]} columns
 * @returns {any[][]}
 */
export function matrixMultiply(columns) {
  if (columns.length === 0) return [];
  const partLengths = columns.map(part => part.length); // how large each row is
  const hasAnEmptyRow = partLengths.some(length => !length);
  if (hasAnEmptyRow) return []; // Cannot multiply an empty row
  const columnRowIndexes = new Array(columns.length).fill(0); // how far we've gone in each row
  let isEnded = false;
  const combinationToPerform = [];
  while (isEnded === false) {
    combinationToPerform.push(columnRowIndexes.reduce((rowToPerform, rowIndex, columnIndex) => {
      rowToPerform.push(columns[columnIndex][rowIndex]);
      return rowToPerform;
    }, []));
    isEnded = !columnRowIndexes.some((rowIndex, columnIndex) => {
      rowIndex++;
      if (rowIndex < partLengths[columnIndex]) {
        columnRowIndexes[columnIndex] = rowIndex;
        return true;
      }
      columnRowIndexes[columnIndex] = 0;
      return false;
    });
  }
  return combinationToPerform;
}
