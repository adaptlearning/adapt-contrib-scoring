import Handlebars from 'handlebars';
import {
  getSubsetsByQuery
} from './utils';

const helpers = {
  scoreQuery(query, context) {
    const modelId = context?.data?.root?._id;
    query = query.replace('this', `#${modelId}`);
    const sets = getSubsetsByQuery(query);
    return sets.reduce((score, set) => score + set.score, 0);
  }

  // score(context) {
  //   if (!context) throw Error('No context for score helper.');
  //   const root = context.data.root;
  //   const modelId = root._id;
  //   const model = data.findById(modelId);
  //   const score = model.score;
  //   return score;
  // }
};

for (const name in helpers) {
  Handlebars.registerHelper(name, helpers[name]);
}
