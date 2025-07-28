/**
 * Turn any JSON into a semi-unique hash string, representing a state.
 * @param {any} dataToHash
 * @returns {string}
 */
export function hash(dataToHash) {
  const text = JSON.stringify(dataToHash);
  let hash = 5381;
  let index = text.length;
  while (index) hash = (hash * 33) ^ text.charCodeAt(--index);
  return String(hash >>> 0);
}

/**
 * Useful for determining if a state has changed from a series of JSON variables.
 * Store the latest hash of dataToHash at subject[_subjectKey] = hash.
 * On subsequent call, return true/false indicating that the data has changed.
 * @param {Object} subject The object on which to store the previous hash
 * @param {any} dataToHash Any JSON to hash as a state
 * @param {string} [subjectKey="_hash"]
 * @returns {boolean}
 */
export function hasHashChanged(subject, dataToHash, subjectKey = '_previousHash') {
  const hashed = hash(dataToHash);
  if (subject[subjectKey] === hashed) return false;
  subject[subjectKey] = hashed;
  return true;
}
