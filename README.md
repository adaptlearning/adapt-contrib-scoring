# adapt-contrib-scoring

An extension to expose an API for a collection of scoring sets used throughout the content. In addition to collating all marked sets, to determine the completion of required sets and an overall score, this plugin provides the abstract scoring set logic from which other plugins can extend to create new sets.

## Scoring sets

A scoring set consists of a collection of models from which scores (`minScore`, `maxScore`, `score`, `scaledScore`, `correctness`, `scaledCorrectness`), completion and passing statuses can be derived. Each set is only responsible for values derived from it's models, and has no perception of those from other scoring sets. A set may be a collection of content, such as an [assessment](https://github.com/adaptlearning/adapt-contrib-scoringAssessment); a collection of scores assigned directly to content; a collection of other scoring sets.

Each plugin will register a new set type with the Scoring API, and identify its associations with other models, along with any extended functionality specific to that plugin. This will allow sets to be evaluated for any intersections within the course structure by comparing overlapping hierachies. Scoring sets allow multiple scores to be categorised as required, providing the ability to evaluate user performance across different areas.

### Attributes

Scoring sets should be modular in the JSON configuration, with each set added as its own object. Each scoring set requires the following base attributes for configuration:

**\_id** (string): Unique ID for the scoring set. Referenced by other plugins when using the Scoring API.

**title** (string): A title for the set. Not required, but exposed should it be used for reporting purposes.

**_isScoreIncluded** (boolean): Determines whether the set should be included in the overall score.

**_isCompletionRequired** (boolean): Determines whether the set should be included in the completion checks.

### Events

The following events are triggered for each scoring set:

**Adapt#scoring:[set.type]:register**<br>
**Adapt#scoring:set:register**<br>
**Adapt#scoring:[set.type]:restored**<br>
**Adapt#scoring:set:restored**<br>
**Adapt#scoring:[set.type]:complete**<br>
**Adapt#scoring:set:complete**<br>
**Adapt#scoring:[set.type]:passed**<br>
**Adapt#scoring:set:passed**<br>
**Adapt#scoring:[set.type]:reset**<br>
**Adapt#scoring:set:reset**

## Usage

The API is exposed on the `Adapt` object to aid browser console use, but more typically should be imported by a plugin when required:
```JavaScript
  import Scoring from 'extensions/adapt-contrib-scoring/js/adapt-contrib-scoring';
```

In addition to retrieving all registered sets and their properties, the API can be used to query and filter sets via utility methods. Please see the JSDoc comments for details regarding these methods. Whilst each set is only self-aware, an intersection of scoring sets can be retrieved and evaluated by summing each set for a specified attribute. The most powerful of the utility methods is `getSubsetsByQuery`, which returns intersecting sets according to the query attributes - see https://github.com/adaptlearning/adapt-contrib-scoring/pull/3 for details regarding query syntax.

## Attributes

The attributes listed below are used in *course.json* to configure the overall scoring, and are properly formatted as JSON in [*example.json*](https://github.com/adaptlearning/adapt-contrib-scoring/blob/master/example.json).

**\_id** (string): A human-readable ID for this object. Not required, but exposed should it be required for reporting purposes.

**title** (string): A title for this object. Not required, but exposed should it be used for reporting purposes.

**\_passmark** (object): The settings used to configure the passmark. Contains the following attributes:

 * **\_isEnabled** (boolean): Determines whether a passmark is required. The default is `true`.

 * **\_requiresPassedSubsets** (boolean): Determines whether all `_isScoreIncluded` scoring sets need to be passed. Used in conjunction with `_score` and `_correctness`. The default is `false`.

 * **\_score** (number): Determines the score required to pass. The default is `60`.

 * **\_correctness** (number): Determines the correctness required to pass The default is `60`.

 * **\_isScaled** (boolean): Determines whether `_score` and `_correctness` are to be used as raw or percentage values. The default is `true`.

**\_isBackwardCompatible** (boolean): Determines whether to use legacy assessment events and state for backward compatibility with other plugins.

## Events

The following events are triggered:

**Adapt#scoring:update**<br>
**Adapt#scoring:reset**<br>
**Adapt#scoring:restored**<br>
**Adapt#scoring:complete**<br>
**Adapt#scoring:pass**

For backward compatibility the following events are triggered if `"_isBackwardCompatible": true`:

**Adapt#assessment:restored**<br>
**Adapt#assessment:complete**

----------------------------
**Framework versions:** >=5.31.31<br>
**Author / maintainer:** Adapt Core Team with [contributors](https://github.com/adaptlearning/adapt-contrib-scoring/graphs/contributors)
