import OfflineStorage from 'core/js/offlineStorage';

/** @typedef {import("../LifecycleSet").default} LifecycleSet */

/**
 * Saves and restores state by { name: { id: 'data' } } in the offlineStorage API
 * Note: Can only save and restore arrays of arrays, arrays of only numbers and arrays of only booleans
 * i.e. [[1,2,3,4],[true,false,true,false]] or [true,false,true] etc
 */
export default class State {

  /**
   * @param {Object} options
   * @param {LifecycleSet} options.set
   * @param {string} [options.name=null]
   * @param {string} [options.id=null]
   */
  constructor({ set, name = null, id = null } = {}) {
    this.set = set;
    this._name = name;
    this._id = id;
  }

  /**
   * The namespace in offlineStorage under which to save the id property
   * @returns {string}
   */
  get name() {
    return this._name ?? this.set.type;
  }

  /**
   * The id against which to store the data in offlineStorage
   */
  get id() {
    return this._id ?? this.set.id;
  }

  /**
   * Returns the saved data
   * Note: Can only save and restore arrays of arrays, arrays of only numbers and arrays of only booleans
   * i.e. [[1,2,3,4],[true,false,true,false]] or [true,false,true] etc
   * @returns {any}
   */
  restore() {
    const storedData = OfflineStorage.get(this.name)?.[this.id];
    if (!storedData) return null;
    return OfflineStorage.deserialize(storedData);
  }

  /**
   * Saves the data
   * Note: Can only save and restore arrays of arrays, arrays of only numbers and arrays of only booleans
   * i.e. [[1,2,3,4],[true,false,true,false]] or [true,false,true] etc
   * @returns {boolean} If offlineStorage was updated
   */
  save (data) {
    const store = OfflineStorage.get(this.name) ?? {};
    const newValue = OfflineStorage.serialize(data);
    if (store[this.id] === newValue) return false;
    store[this.id] = newValue;
    OfflineStorage.set(this.name, store);
    return true;
  }

  /**
   * Clears the saved data in the namespace
   */
  clear() {
    const store = OfflineStorage.get(this.name) ?? {};
    delete store[this.id];
    OfflineStorage.set(this.name, store);
  }
}
