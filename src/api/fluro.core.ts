// if (process.browser) {
import FluroAccess from './fluro.access'
import FluroAPI from './fluro.api'
import FluroAsset from './fluro.asset'
import FluroAuth from './fluro.auth'
import FluroCache from './fluro.cache'
import FluroComponents from './fluro.components'
import FluroContent from './fluro.content'
import FluroDate from './fluro.date'
import FluroDevice from './fluro.device'
import FluroDispatcher from './fluro.dispatcher'
import FluroStats from './fluro.stats.user.storage'
import FluroTypes from './fluro.types'
import FluroUtils from './fluro.utils'
import FluroVideo from './fluro.video'
/**
 * Creates a new FluroCore instance including all of the default sub modules
 * @alias fluro
 * @constructor
 * @param {Object} options
 * @param {String} options.apiURL    The remote URL of the Fluro API you want to connect to. Options are 'staging', 'production' or you may set a specific URL eg. 'https://api.fluro.io' (do not include trailing slash). If no value is provided, will default to 'production'.
 * @param {String} options.applicationToken When running as a static application, (for example a website) you may set the application's access token before you initialize the Fluro instance here.
 * @example
 *
 * // Import the Fluro package
 * import Fluro from 'fluro';
 *
 * // Create a new Fluro instance
 * let fluro = new Fluro();
 *
 * // Request the current user session endpoint from the Fluro API
 * fluro.api.get('/session').then(function(res) {
 *   console.log('User session is ', res.data);
 * })
 * .catch(function(err) {
 *     console.log('There was an error', err);
 * });
 *
 * // Use the FluroAsset package to generate an image url
 * let link = fluro.asset.imageUrl('5ca3d64dd2bb085eb9d450db', 1920, 1080)
 */
const FluroCore = (options) => {
  if (!options) {
    options = {
      // apiURL,
      // applicationToken,
      // api:{}
    }
  }

  if (!options.apiURL || !options.apiURL.length) {
    options.apiURL = 'production'
  }

  switch (String(options.apiURL).toLowerCase()) {
    case 'production':
      options.apiURL = 'https://api.fluro.io'
      break
    case 'staging':
      options.apiURL = 'https://api.staging.fluro.io'
      break
    case 'local':
      options.apiURL = 'http://api.fluro.localhost:3000'
      break
  }

  const core = Object.assign(options, {
    // apiURL: options.apiURL,
    // applicationToken: options.applicationToken,
    domain: options.domain || '',
    // withCredentials:options.withCredentials,
    global: {},
    resetCache() {
      FluroCache.reset()
      dispatcher.dispatch('cache.reset')
    }
  })

  /**
   * Provides a cache service, used for creating, clearing
   * and storing API requests and other information in memory
   * @type {FluroCache}
   */
  const cache = FluroCache
  Object.defineProperty(core, 'cache', {
    value: cache,
    writable: false
  })

  /**
   * Provides helper functions for working
   * with Fluro data
   * @type {FluroUtils}
   */
  const utils = FluroUtils
  Object.defineProperty(core, 'utils', {
    value: utils,
    writable: false
  })

  /**
   * Provides helper functions for understanding the users device
   * @type {FluroDevice}
   */
  const device = FluroDevice
  Object.defineProperty(core, 'device', {
    value: device,
    writable: false
  })

  // Create a new global dispatcher so we can trigger events
  const dispatcher = new FluroDispatcher()
  dispatcher.bootstrap(core)
  // Set the function
  core.error = (err) => {
    // Dispatch an error event
    return core.dispatch('error', utils.errorMessage(err))
  }
  // And enable notifications with a short message
  core.notify = (message, options) => {
    return core.dispatch('notification', { message, options })
  }

  /**
   * Provides date functions, filters and utilities
   * for working with dates and timezones
   * @type {FluroDate}
   */
  const date = FluroDate
  Object.defineProperty(core, 'date', {
    value: date,
    writable: false
  })
  /**
   * The default service for interacting with
   * the Fluro REST API, it's a wrapper around the axios library
   * that works in conjunction with the other Fluro modules
   * @type {FluroAPI}
   */
  const api = new FluroAPI(core)
  Object.defineProperty(core, 'api', {
    value: api,
    writable: false
  })
  const appContextAPI = new FluroAPI(core, true)
  Object.defineProperty(core, 'appContextAPI', {
    value: appContextAPI,
    writable: false
  })
  /**
   * A helper service for CRUD operations that wraps around the fluro.api service
   * @type {FluroContent}
   */
  const content = new FluroContent(core)
  Object.defineProperty(core, 'content', {
    value: content,
    writable: false
  })
  /**
   * The default service for managing authentication
   * handles automatic refreshing of access tokens, and provides login, logout
   * and other user/application specific functionality
   * @type {FluroAuth}
   */
  const auth = new FluroAuth(core)
  Object.defineProperty(core, 'auth', {
    value: auth,
    writable: false
  })
  /**
   * Provides helper functions for working with Fluro Components
   * @type {FluroComponents}
   */
  const components = new FluroComponents(core)
  Object.defineProperty(core, 'components', {
    value: components,
    writable: false
  })

  /**
   * Provides helper functions for working
   * with Fluro Video data
   * @type {FluroVideo}
   */
  const video = FluroVideo
  Object.defineProperty(core, 'video', {
    value: video,
    writable: false
  })
  /**
   * The default service for managing, rendering and handling files and media from Fluro.
   * It contains helper functions for managing connecting to image, audio, asset and video api endpoints.
   * @type {FluroAsset}
   */
  const asset = new FluroAsset(core)
  Object.defineProperty(core, 'asset', {
    value: asset,
    writable: false
  })
  /**
   * The default service for handling a user's 'stats' eg. (likes, views, favorites, downvotes etc...)
   * This service creates and syncs user's stats when they 'stat' items from Fluro.
   * @type {FluroStats}
   */
  const stats = new FluroStats(core)
  Object.defineProperty(core, 'stats', {
    value: new FluroStats(core),
    writable: false
  })
  /**
   * A helper service for retrieving, translating and rendering content types and definitions
   * defined within Fluro.
   * @type {FluroTypes}
   */
  const types = new FluroTypes(core)
  Object.defineProperty(core, 'types', {
    value: types,
    writable: false
  })
  /**
   * A helper service for understanding a user's access permissions
   * @type {FluroAccess}
   */
  const access = new FluroAccess(core)
  Object.defineProperty(core, 'access', {
    value: access,
    writable: false
  })

  return core
}
export default FluroCore
