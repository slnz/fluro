// if (process.browser) {
import FilterService from '../services/FilterService'
import FluroContentListService from '../services/FluroContentListService'

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
import FluroStats from './fluro.stats'
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
export default class FluroCore {
  _cache = FluroCache
  /**
   * Provides a cache service, used for creating, clearing
   * and storing API requests and other information in memory
   * @type {FluroCache}
   */
  get cache() {
    return this._cache
  }

  _utils = FluroUtils
  /**
   * Provides helper functions for working
   * with Fluro data
   * @type {FluroUtils}
   */
  get utils() {
    return this._utils
  }

  static utils: typeof FluroUtils

  _date = FluroDate
  /**
   * Provides date functions, filters and utilities
   * for working with dates and timezones
   * @type {FluroDate}
   */
  get date() {
    return this._date
  }

  static date: typeof FluroDate
  static moment: typeof FluroDate.moment

  _video = FluroVideo
  /**
   * Provides helper functions for working
   * with Fluro Video data
   * @type {FluroVideo}
   */
  get video() {
    return this._video
  }

  static video: typeof FluroVideo

  _device: FluroDevice
  /**
   * Provides helper functions for understanding the users device
   * @type {FluroDevice}
   */
  get device() {
    return this._device
  }

  _api: FluroAPI
  /**
   * The default service for interacting with
   * the Fluro REST API, it's a wrapper around the axios library
   * that works in conjunction with the other Fluro modules
   * @type {FluroAPI}
   */
  get api() {
    return this._api
  }

  _appContextAPI: FluroAPI
  /**
   * The default service for interacting with
   * the Fluro REST API, it's a wrapper around the axios library
   * that works in conjunction with the other Fluro modules
   * @type {FluroAPI}
   */
  get appContextAPI() {
    return this._appContextAPI
  }

  _content: FluroContent
  /**
   * A helper service for CRUD operations that wraps around the fluro.api service
   * @type {FluroContent}
   */
  get content() {
    return this._content
  }

  /**
   * The default service for managing authentication
   * handles automatic refreshing of access tokens, and provides login, logout
   * and other user/application specific functionality
   * @type {FluroAuth}
   */
  _auth: FluroAuth
  get auth() {
    return this._auth
  }

  _components: FluroComponents
  /**
   * Provides helper functions for working with Fluro Components
   * @type {FluroComponents}
   */
  get components() {
    return this._components
  }

  _asset: FluroAsset
  /**
   * The default service for managing, rendering and handling files and media from Fluro.
   * It contains helper functions for managing connecting to image, audio, asset and video api endpoints.
   * @type {FluroAsset}
   */
  get asset() {
    return this._asset
  }

  _stats: FluroStats
  /**
   * The default service for handling a user's 'stats' eg. (likes, views, favorites, downvotes etc...)
   * This service creates and syncs user's stats when they 'stat' items from Fluro.
   * @type {FluroStats}
   */
  get stats() {
    return this._stats
  }

  _types: FluroTypes
  /**
   * A helper service for retrieving, translating and rendering content types and definitions
   * defined within Fluro.
   * @type {FluroTypes}
   */
  get types() {
    return this._types
  }

  _access: FluroAccess
  /**
   * A helper service for understanding a user's access permissions
   * @type {FluroAccess}
   */
  get access() {
    return this._access
  }

  dispatcher: FluroDispatcher

  _apiURL: string
  get apiURL() {
    return this._apiURL
  }

  _domain: string
  get domain() {
    return this._domain
  }

  _applicationToken?: string
  get applicationToken() {
    return this._applicationToken
  }

  _GLOBAL_AUTH = false
  get GLOBAL_AUTH() {
    return this._GLOBAL_AUTH
  }

  _userContextByDefault = false
  get userContextByDefault() {
    return this._userContextByDefault
  }

  _app?: {
    user: { firstName: string; token: string; persona: object } | null
    uuid?: string
  }

  get app() {
    return this._app
  }

  static FilterService: typeof FilterService
  static FluroDate: typeof FluroDate
  static FluroUtils: typeof FluroUtils
  static FluroContentListService: typeof FluroContentListService
  static EventDispatcher: typeof FluroDispatcher

  constructor(
    options: {
      apiURL?: 'production' | 'staging' | 'local' | string
      domain?: string
      applicationToken?: string
    } = {}
  ) {
    if (options.apiURL == null) {
      options.apiURL = 'production'
    }
    switch (options.apiURL) {
      case 'production':
        this._apiURL = 'https://api.fluro.io'
        break
      case 'staging':
        this._apiURL = 'https://api.staging.fluro.io'
        break
      case 'local':
        this._apiURL = 'http://api.fluro.localhost:3000'
        break
    }
    this._domain = options.domain ?? ''
    this._applicationToken = options.applicationToken

    // Create a new global dispatcher so we can trigger events
    this.dispatcher = new FluroDispatcher()
    this.dispatcher.bootstrap(this)

    this._device = new FluroDevice()
    this._api = new FluroAPI(this)
    this._appContextAPI = new FluroAPI(this, true)
    this._content = new FluroContent(this)
    this._auth = new FluroAuth(this)
    this._components = new FluroComponents(this)
    this._asset = new FluroAsset(this)
    this._stats = new FluroStats(this)
    this._types = new FluroTypes(this)
    this._access = new FluroAccess(this)
  }

  // Dispatch an error event
  error(err) {
    return this.dispatch('error', this.utils.errorMessage(err))
  }

  // And enable notifications with a short message
  notify(message, options) {
    return this.dispatch('notification', { message, options })
  }

  reestCache() {
    this._cache.reset()
    this.dispatcher.dispatch('cache.reset')
  }

  public dispatch: FluroDispatcher['dispatch']
  public addEventListener: FluroDispatcher['addEventListener']
  public removeEventListener: FluroDispatcher['removeEventListener']
  public removeAllListeners: FluroDispatcher['removeAllListeners']
}
