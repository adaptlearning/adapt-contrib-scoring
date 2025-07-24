import State from 'extensions/adapt-contrib-scoring/js/State';
import data from 'core/js/data';
/** @typedef {import("core/js/models/adaptModel").default} AdaptModel */

/**
 * An extension of State
 * Save and restore a collection of models
 */
export default class StateModels extends State {

  /**
   * Returns the saved models
   * Note: Uses trackingPosition which can be disrupted by change the order or substance of sub tracking id elements,
   * such as changing the order of or the components in their block if the tracking id is on the blocks
   * @returns {AdaptModel[]}
   */
  restore() {
    const models = super.restore()?.map(trackingPosition => data.findByTrackingPosition(trackingPosition)) ?? [];
    if (!models?.length) return null;
    return models;
  }

  /**
   * Saves the given models
   * Note: Uses trackingPosition which can be disrupted by change the order or substance of sub tracking id elements,
   * such as changing the order of or the components in their block if the tracking id is on the blocks
   * @param {AdaptModel[]} models
   */
  save(models) {
    models = models.filter(model => model.get('_isTrackable') !== false);
    const hasModels = (models.length > 0);
    const data = hasModels
      ? models.map(model => model.trackingPosition)
      : null;
    return super.save(data);
  }

}
