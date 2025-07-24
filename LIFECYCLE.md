# lifecycle
Each Set which inherits from `LifecycleSet` in the scoring system has a lifecycle and order. The primary purpose of the lifecycle is to aid in the startup and reset of sets, with the order determining their position in the lifecycle phase execution.

## phases
There are 8 external lifecycle phases, 6 internal phases and 2 internal phase triggers for each set. The internal phases have callback functions executed by the external phases. Each cycle is grouped at 30 frames per second, on a browser animation frame. Before each cycle is performed, the relevant sets are grouped, sorted and processed in phase and position order.

### External phases
| Name | Description |
| --- | --- |
| init | All sets are sent here after being instantiated and registered |
| restore | All sets are sent here after the init phase |
| start | All sets are sent here after the restore phase |
| reset | All sets are sent here if `Adapt.scoring.reset()` is called |
| restart | Sets are sent here if any set on the model, or the model on which they sit has been reset using `.reset()` |
| leave | Sets are sent here if the user leaves the content object in which its `modelId` sits |
| visit | Sets are sent here if the user visits the content object in which its `modelId` sits |
| update | Sets are sent here if any intersecting model changes across its `_isAvailable`, `_isInteractionComplete`, `_isActive` or `_isVisited` attributes or if any intersecting set calls `.update()` |

## Internal phase callback functions
| Name | Description |
| --- | --- |
| onInit | After it is instantiated and registered, in the init phase |
| onRestore | After onInit, in the restore phase, return true/false to signify restore |
| onStart | After onRestore, if `wasRestored = false`. Called on the set after reset. |
| onLeave | When leaving their content object |
| onVisit | When visiting their content object |
| onUpdate | When any intersecting model changes across its `_isAvailable`, `_isInteractionComplete`, `_isActive` or `_isVisited` attributes or if any intersecting set calls `.update()`  |

## Internal phase trigger functions
| Name | Description |
| --- | --- |
| update | Triggers the update phase for all sets intersecting the modelId |
| reset | Triggers the restart phase for all sets at the modelId |
