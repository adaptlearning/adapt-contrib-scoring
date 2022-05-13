import Adapt from 'core/js/adapt';
import Data from 'core/js/data';
import AssessmentSet from './AssessmentSet';
import AssessmentsSet from './AssessmentsSet';

class Assessment extends Backbone.Controller {

  initialize() {
    this.listenTo(Adapt, {
      'app:dataReady': this.onAppDataReady
    });
  }

  hasAssessment(model) {
    return this.getConfigByModel(model)?._isEnabled;
  }

  getConfigByModel(model) {
    return model.get('_assessment');
  }

  get assessmentModels() {
    return Data.filter(model => this.hasAssessment(model));
  }

  onAppDataReady() {
    // @todo: use this rather than Adapt.assessment below?
    Adapt.assessments = new AssessmentsSet();
    this.assessmentModels.forEach(model => new AssessmentSet({ model }));
  }

}

/**
 * @todo Is this confusing seeing as the AssessmentSet essentially acts as `Adapt.assessment` - remove?
 */
//export default (Adapt.assessment = new Assessment());
export default new Assessment();
