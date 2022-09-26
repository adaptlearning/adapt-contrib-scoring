import Data from '../../../core/js/data';
import Handlebars from 'handlebars';
// import {
//   getSubsetById
// } from './utils';

Handlebars.registerHelper('set-score', (setId, context) => {
  if (!context) throw Error('No context for set-score helper.');
  // const data = context.data.root;
  // const modelId = data._id;
  // const score = null;
  // const set = getSubsetById(setId);
  // const score = set.models.find
  // const sets = getSubsetsByModelId(modelId);
  // sets.find(set => set.id === setId)
  // return score;
});

Handlebars.registerHelper('score', context => {
  if (!context) throw Error('No context for score helper.');
  const data = context.data.root;
  const modelId = data._id;
  const model = Data.findById(modelId);
  const score = model.score;
  return score;
});
