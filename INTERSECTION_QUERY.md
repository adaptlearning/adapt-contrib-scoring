# Intersection query syntax

## Preamble

### What is an intersection
* Equal intersection is when the first and second model are equal
* Descendant intersection is when the first model is a descendant of the second
* Ancestor intersection is when the first model is a ancestor of the second
* Intersections identify models which have overlapping interests in the hierarchy

### Query API
```js
const queryString = "#a-300 #performance"
Adapt.scoring.getSubsetsByQuery(queryString)
Adapt.scoring.getSubsetByQuery(queryString)
const pathString = "a-300.performance"
Adapt.scoring.getSubsetByPath(pathString)
```

### IntersectionSet
All sets representing any a collection of models are likely to extend the most basic interface `IntersectionSet`. 

It is possible to use these literal attributes for queries on `IntersectionSet`:
* `#setId` or `[id=setId]` or `[#setId]` the set with id `setId`, ids are unique
* `setType` or `[type=setType]` all sets with type `setType`
* `(isEnabled)` or `(isEnabled=true)` and `(isEnabled=false)` filtered by `isEnabled`
* `(isOptional)` or `(isOptional=true)` and `(isOptional=false)` filtered by `isOptional`
* `(isAvailable)` or `(isAvailable=true)` and `(isAvailable=false)` filtered by `isAvailable`
* `(isModelAvailableInHierarchy)` or `(isModelAvailableInHierarchy=true)` and `(isModelAvailableInHierarchy=false)` filtered by `isModelAvailableInHierarchy`, this returns true if the set is `_isAvailable` and not detached from the hierarchy
* `(isPopulated)` or `(isPopulated=true)` and `(isPopulated=false)` filtered by `isPopulated`, this returns true if the set has `models`.
* `(isNotPopulated)` is an alias for `(isPopulated=false)`

These intersection attributes are available for querying all set instances:
* `[modelId=a-300]` will select all sets intersecting model `a-300`

### AdaptModelSet
The `AdaptModelSet` instances allow selections and intersections over the Adapt models.

For each `AdaptModel`, in the `core/js/data` API, there is a corresponding `AdaptModelSet`. Each set inherits the same `id`, `model` and `modelId` from its `AdaptModel` and has `models` of `[model]`. These sets inherit all of the query attributes from `IntersectionSet`.

These literal attributes are available for query on `AdaptModelSet` instances:
* `#a-300` or `[id=a-300]` or `[#a-300]` the set with id `a-300`, ids are unique
* `adapt` or `[type=adapt]` all sets with type `adapt`
* `[modelTypeGroup=course|contentobject|menu|page|group|article|block|component|question]` all sets with the specified typegroup
* `[modelType=course|menu|page|article|block|component]` all sets with the specified type
* `(isComplete)` or `(isComplete=true)` and `(isComplete=false)` filtered by `isComplete`
* `(isIncomplete)` is an alias for `(isComplete=false)`
* `(isPassed)` is an alias for `(isComplete)`
* `(isFailed)` is always `false`

### ScoringSet
For all sets representing a scoring collection of models, such as questions, they likely extend `ScoringSet`. 

Here you can use these additional literal attributes for queries:
* `(isComplete)` or `(isComplete=true)` and `(isComplete=false)` filtered by `isComplete`, is determined by the specific type of scoring set
* `(isIncomplete)` is an alias for `(isComplete=false)`
* `(isPassed)` is determined by the specific type of scoring set
* `(isFailed)` is and alias `(isComplete,isPassed=false)`

### TotalSets
This is a set of sets, it can sum the scores of the root or intersecting sets. 

It extends `ScoringSet` with the caveat that it sums properties from root or intersecting scoring sets and completion sets rather than root or intersecting models.

It represents the overall completion, score, correctness, pass and fail of the course.

It has these literal attributes:
* `#total` or `[id=total]` or `[#total]` the set with id `total`, ids are unique
* `total` or `[type=total]` all sets with type `total`

### Selection query syntax
All selection query can have three optional parts, as `first[second](third)`.

The first part defaults to an empty string, which means all sets. It can select either by set type or by set id using the shorthand `setType` or `#setId`. For native sets, `adapt` would return all native `AdaptModelSet` sets and `#a-300` would return only the `AdaptModelSet` representing the article `a-300`, as set ids are unique.

The second part is an optional list of attributes about which to multiply the first part. Such that `adapt[modelId=a-300,modelType=block]` will return all `AdaptModelSets` which intersect `modelId=a-300` and all `AdaptModelSets` which have `modelType=block`.

The third part is an optional list of attributes which filter the selected sets on the specified attributes. `adapt[modelId=a-300,modelType=block](isComplete)` will return all `AdaptModelSets` which intersect `modelId=a-300` and all `AdaptModelSets` which have `modelType=block`, where their `isComplete` properties are `true`.

tldr: `selectionQuery = typeOrId[multipliedByAttributes](filteredByAttributes)`

### Selection query examples
Selection queries follow the `selectionQuery` syntax of `typeOrId[multipliedByAttributes](filteredByAttributes)`.

These queries only select from available sets, they do not cause intersections or cloned sets to be created:
* `"assessment"` sets of `AssessmentSet`, `type=assessment`
* `"#assessment-300"` the `AssessmentSet` with `id=assessment-300`, ids are unique
* `"#a-300"` the `AdaptModelSet` with `id=a-300`, ids are unique
* `"assessment[id=assessment-300]"` the `AssessmentSet` with `id=assessment-01`, ids are unique
* `"assessment[id=assessment-300,id=assessment-400]"` sets of `AssessmentSet` with `id=assessment-300` and `id=assessment-400`, ids are unique
* `"[#assessment-300,#assessment-400]"` does the same as above
* `"assessment[modelId=a-05]"` the `AssessmentSet` of `type=assessment` intersecting model `a-05`
* `"adapt[modelType=article]"` sets of `AdaptModelSet` representing articles
* `"adapt[modelComponent=mcq]"` sets of `AdaptModelSet` representing mcqs
* `"adapt[modelComponent=mcq,modelComponent=gmcq]"` sets of `AdaptModelSet` representing mcqs and gmcqs
* `"adapt[modelTypeGroup=question]"` sets of `AdaptModelSet` representing questions
* `"adapt[modelComponent=mcq,modelComponent=gmcq](isComplete)"` sets of `AdaptModelSet` representing all completed mcqs and gmcqs

### Selection query multiplications
The query interface parts `first` and `second` are multiplied.

The multiplication happens in columns, each entry in each column is multiplied into a list of all possible combinations. Such that `[[1], [2,4]] = [[1,2],[1,4]]`. The resultant combinations are used to perform the selection query accordingly.

tldr: When multiplying the selection parts `article` and `[#a-200,#a-300]`, by using `article[#a-200,#a-300]`, we ask the computer to select both `article[#a-200]` and `article[#a-300]`.

### Intersection query examples
The `intersectionQuery` syntax is `selectionQuery selectionQuery selectionQuery...` or `typeOrId[multipliedByAttributes](filteredByAttributes) typeOrId[multipliedByAttributes](filteredByAttributes) typeOrId[multipliedByAttributes](filteredByAttributes)...`, where the space signifies a multiplication.

An intersection always produces a new set, created from the class of the final column:
* `"assessment[id=assessment-01] assessment[id=assessment-05]"` creates an intersection of set `id=assessment-01` and `id=assessment-05`, returning a `type=assessment`, `AssessmentSet` instance
* `"assessment[id=assessment-01,id=assessment-05] assessment[id=assessment-10,assessment-15]"` creates four intersection sets, of type `assessment` or `AssessmentSet`, intersecting `#assessment-01` with `#assessment-10`, `#assessment-01` with `#assessment-15`, `#assessment-05` with `#assessment-10` and `assessment-05` with `assessment-15`
* `"[id=assessment-01,id=assessment-05] [id=assessment-10,id=assessment-15]"` would do the same as above, ids are unique
* `"[#assessment-01,#assessment-05] [#assessment-10,#assessment-15]"` would do the same as above, ids are unique
* `"[modelType=article] assessment"` returns intersection sets of all `modelType=articles` sets with all `type=assessment` sets, return `AssessmentSet` intersection set instances
* `"[modelType=article] assessment(isPopulated)"` returns all article assessments intersections that have models after their intersections
* `"[modelType=article](isComplete) assessment(isPopulated)"` returns all article assessments intersections that have models from completed articles

### Intersection query multiplications
With `intersectionQuery`, all of the separate `selectionQuery` sections are multiplied together before a resultant set is produced from the final class.

The multiplication happens in columns, each selection entry in each column is multiplied into a list of all possible combinations. Such that `[[1], [2,4]] = [[1,2],[1,4]]`. The resultant combinations are used to perform the intersection accordingly.

When multiplying the intersection parts `[modelType=article]` and `assessment`, by using `[modelType=article] assessment`, we ask the computer to select all articles and all assessments and then multiply them together and give the resultant intersections, which would be of type assessment. 

Anti-pattern walkthrough: In the above example, `[modelType=article] assessment`, if we had 20 articles and 2 assessments, we'd have 40 resultant intersected assessment sets. If each assessment belonged to only one article then we would have 38 useless intersections of articles intersecting assessment where there is no relation. As intersections reduce the number of models in the resultant set, and they reduce the models intersecting with the set models used to product it, we could solve this problem by using `[modelType=article] assessment(isPopulated)`. Using an `(isPopulated)` filter would return only all of the article assessment intersections which have models left after intersection. In this can it would probably be easier just to fetch the assessments directly using `assessment[modelType=article]`, rather than using an intersection, as the assessment lives on an article.

## Primary use-case
We have a performance metric that covers questions in the whole course and we have an assessment in one article that intersects some of the same questions. We want to know the sum of the performance score for just the assessment questions.

To do this, assuming the `AssessmentSet` sits on article `a-300` and has the article's blocks as its models and assuming a `PerformanceSet`, with id `performance` and a `score` property, sits on the course object and has all of the questions in the course as its models, the following example will satisfy our use-case:
```js
const intersectedSets = Adapt.scoring.getSubsetsByQuery("#a-300 #performance")
const firstIntersectedSet = intersectedSets[0]
const assessmentPerformanceScore = firstIntersectedSet.score 
// or, as we expect only one intersected set
const firstIntersectedSet = Adapt.scoring.getSubsetByQuery("#a-300 #performance")
const assessmentPerformanceScore = firstIntersectedSet.score 
```
Machine translation: Select two columns of sets, column 1 should have sets where `id = 'a-300'` and column 2  should have sets where `id = 'performance'`. Multiply both columns, such that there is a list of every combination. Clone each item in column 2 of the list and reduce its `.models` by those models intersecting its combination from column 1. Return the array of intersected cloned sets. Select the first. Return the value of its `.score` property.

English translation: Return a performance metric score for just questions intersecting article `a-300`.
