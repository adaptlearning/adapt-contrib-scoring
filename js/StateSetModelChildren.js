import StateModels from './StateModels';
/** @typedef {import("core/js/models/adaptModel").default} AdaptModel */

/**
 * An extension of StateModels.
 * Saves and restores the collection of children from the set model.
 * Shares a space under offlineStorage ch[modelId] so that multiple
 * plugins can coordinate on the model children.
 */
export default class StateSetModelChildren extends StateModels {

  /**
   * Define a shared children namespace of 'ch' in offlineStorage
   * @returns {string}
   */
  get name() {
    return 'ch';
  }

  /**
   * Use the set.modelId for each model children
   * @returns {string}
   */
  get id() {
    return this.set.modelId;
  }

  /**
   * Restores the set.model.getChildren()
   * @returns {boolean} If restore had models
   */
  restore() {
    const models = super.restore();
    if (!models) return false;
    this.set.model.getChildren().reset(models);
    return true;
  }

  /**
   * Saves the set.model.getChildren()
   * @returns {boolean} If offlineStorage has been updated
   */
  save() {
    const models = this.set.model.getChildren().toArray();
    return super.save(models);
  }

}
