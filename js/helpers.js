import data from 'core/js/data';
import Handlebars from 'handlebars';
// import {
//   getSubsetById
// } from './utils';

const helpers = {
  'set-score'(setId, context) {
    if (!context) throw Error('No context for set-score helper.');
    // const data = context.data.root;
    // const modelId = data._id;
    // const score = null;
    // const set = getSubsetById(setId);
    // const score = set.models.find
    // const sets = getSubsetsByModelId(modelId);
    // sets.find(set => set.id === setId)
    // return score;
  },

  score(context) {
    if (!context) throw Error('No context for score helper.');
    const root = context.data.root;
    const modelId = root._id;
    const model = data.findById(modelId);
    const score = model.score;
    return score;
  }
};

for (const name in helpers) {
  Handlebars.registerHelper(name, helpers[name]);
}
