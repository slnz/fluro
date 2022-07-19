import FluroCore from './api/fluro.core'
import FluroDate from './api/fluro.date'
import EventDispatcher from './api/fluro.dispatcher'
import FluroUtils from './api/fluro.utils'
import FluroVideo from './api/fluro.video'
import FilterService from './services/FilterService'
import FluroContentListService from './services/FluroContentListService'

export { FluroDate }
export { FluroUtils }
export { FluroVideo }
export { EventDispatcher }
export { FilterService }
export { FluroContentListService }

// Import the pieces we need
// Add Utils as a static property
FluroCore.utils = FluroUtils
FluroCore.date = FluroDate
FluroCore.moment = FluroDate.moment
FluroCore.video = FluroVideo
// Export like this for now
FluroCore.FilterService = FilterService
FluroCore.FluroDate = FluroDate
FluroCore.FluroUtils = FluroUtils
FluroCore.FluroContentListService = FluroContentListService
FluroCore.EventDispatcher = EventDispatcher

export default FluroCore
