import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import { isBrowser } from 'browser-or-node'
import { intersection, get, isString, uniq, compact } from 'lodash'
import qs from 'qs'

/**
 * Creates a new FluroAPI instance.
 * This module is a wrapper around the
 * <a href="https://www.npmjs.com/package/axios">axios</a> package. It aims to
 * make it easier for you to connect with and consume endpoints from the Fluro
 * REST API for more information about the available endpoints see
 * <a href="https://developer.this.fluro.io">Fluro REST API Documentation</a>
 * @alias api
 * @constructor
 * @param {FluroCore} fluro A reference to the parent instance of the FluroCore
 * module. The FluroAPI module is usually created by a FluroCore instance that
 * passes itself in as the first argument.
 */
export default class FluroAPI {
  defaultCache
  defaultAdapter = axios.defaults.adapter
  CancelToken = axios.CancelToken

  constructor(private fluro) {
    // // Cache Defaults
    // let FIVEINUTES = 1000 * 60 * 5;
    // let CAPACITY = 100;
    // { maxAge: FIVEINUTES, max: 100 }
    /**
     * The default cache to use when requests are made from this instance
     * @type {LRUCache}
     * @access private
     */
    if (isBrowser) {
      this.defaultCache = this.fluro.cache.get('api')
    }

    const newAxios = this.createNewAxios(this.cacheAdapter)
    this.get = newAxios.get
    this.post = newAxios.post
    this.put = newAxios.put
    this.delete = newAxios.delete
  }

  // Add our own adapter to the service
  private cacheAdapter(config) {
    return new Promise((resolve, reject) => {
      let useCache
      let cachedResponse

      // Don't cache action methods
      switch (String(config.method).toLowerCase()) {
        case 'post':
        case 'patch':
        case 'put':
        case 'delete':
          // Unless we've specified we want a cache
          if (!config.cache) {
            // Don't use the cache
            config.cache = false
          }
          break
      }

      if (config.cache === false) {
        // No cache so make new request
      } else {
        // Use the cache specified or the default cache
        useCache = config.cache || this.defaultCache
        // If there is a cache
        if (useCache) {
          // Generate the cache key from the request
          const cacheKey = this.getCacheKeyFromConfig(config)
          // If we have the cachedResponse version
          cachedResponse = useCache.get(cacheKey)
        }
      }

      if (cachedResponse) {
        return resolve(cachedResponse)
      }
      // const axiosWithoutAdapter = createNewAxios();
      Object.assign(config, { adapter: axios.defaults.adapter })
      // const axiosWithoutAdapter = axios(copy);
      return axios.request(config).then(
        (res) => {
          resolve(res)
        },
        (err) => {
          reject(err)
        }
      )
    })
  }

  private createNewAxios(adapter) {
    const instance = axios.create({
      paramsSerializer: (params) =>
        qs.stringify(params, { arrayFormat: 'repeat' }),
      adapter
      // adapter: throttleAdapterEnhancer(
      //   cacheAdapterEnhancer(axios.defaults.adapter, {
      //     defaultCache: defaultCache
      //   })
      // )
      // adapter: throttleAdapterEnhancer(
      //   cacheAdapterEnhancer(axios.defaults.adapter, {
      //     defaultCache: defaultCache
      //   })
      // )
    })

    instance.defaults.baseURL = this.fluro.apiURL
    instance.defaults.headers.common.Accept = 'application/json'
    instance.defaults.withCredentials = this.fluro.withCredentials
    // Add relative date and timezone to every request
    instance.interceptors.request.use(
      (
        config: AxiosRequestConfig & {
          application?: unknown
          disableUserContext?: boolean
        }
      ) => {
        config.headers['this.fluro-request-date'] = new Date().getTime()
        if (this.fluro.date.defaultTimezone) {
          config.headers['this.fluro-request-timezone'] =
            this.fluro.date.defaultTimezone
        }
        config.headers['this.fluro-api-version'] = '2.2.30'

        // We aren't using the user context by default
        if (!this.fluro.userContextByDefault) {
          // It's just a normal request and we haven't specified an application
          if (!config.application || config.disableUserContext) {
            return config
          }
        }
        if (!this.fluro.app) {
          return config
        }

        if (this.fluro.app.uuid) {
          config.headers['this.fluro-app-uuid'] = this.fluro.app.uuid
          console.log('request uuid')
        }

        // There's no app or app user defined anyway
        if (!this.fluro.app.user) {
          return config
        }

        console.log('Request as user', this.fluro.app.user.firstName)
        config.headers.Authorization = `Bearer ${this.fluro.app.user.token}`
        if (config.params && config.params.accessoken) {
          delete config.params.accessoken
        }
        return config
      }
    )
    instance.interceptors.response.use(
      (response) => {
        const config = response.config
        const cacheKey = this.getCacheKeyFromConfig(config)
        const cache = response.config.cache || this.defaultCache
        if (!cache) {
          return response
        }
        let idSource, ids
        switch (String(config.method).toLowerCase()) {
          case 'put':
          case 'patch':
          case 'post':
          case 'delete':
            idSource = {
              d: (config.data || {}).d,
              params: config.params,
              url: config.url
            }
            ids = this.retrieveIDs(idSource)
            cache.forEach((value, key, cache) => {
              if (value.data) {
                value = value.data
              }
              const cacheIDs = this.retrieveIDs({ key, value })
              const crossover = intersection(cacheIDs, ids).length
              if (crossover) {
                cache.del(key)
              }
            })
            break
          default:
            // Save into the cache
            cache.set(cacheKey, response)
            break
        }
        return response
      },
      (err) => {
        if (axios.isCancel(err)) {
          console.log('Request cancelled')
          return Promise.reject(err)
        }
        // Get the response status
        const status = get(err, 'response.status') || err.status
        // Check the status
        switch (status) {
          case 401:
            // Ignore and allow this.fluro.auth to handle it
            if (this.fluro.app && this.fluro.app.user) {
              this.fluro.app.user = null
            }
            break
          case 502:
            return instance.request(err.config)
          // case 503:
          case 504:
            // Retry
            // Try it again
            console.log(`this.fluro.api > ${status} connection error retrying`)
            return instance.request(err.config)
          case 404:
            break
          default:
            // Some other error
            console.log('this.fluro.api > connection error', status, err)
            break
        }
        return Promise.reject(err)
      }
    )
    return instance
  }

  /**
   * @name api.get
   * @description Makes a get http request to the Fluro REST API
   * @function
   * @param {String} path The Fluro API endpoint to request
   * @param {Object} config Optional parameters for the request
   * @example
   * // Make a request to get the current user session
   fluro.api.get('/content/article', {
   *   params:{
   *     select:'title created',
   *     limit:10,
   *     simple:true,
   *   }
   * })
   * .then((response) => {
   *   console.log(response);
   * })
   * .catch((error) => {
   *   console.log(error);
   * });
   */
  public get: AxiosInstance['get']
  /**
   * @name api.post
   * @description Makes a post http request to the Fluro REST API
   * @function
   * @param {String} path The Fluro API endpoint to request
   * @param {Object} config Optional parameters for the request
   * @example
   *
   fluro.api.post('/content/article', {title:'my new article', ...}, {
   *   // headers and other things
   * })
   * .then((response) => {
   *   console.log(response);
   * })
   * .catch((error) => {
   *   console.log(error);
   * });
   */
  public post: AxiosInstance['post']
  /**
   * @name api.put
   * @description Makes a put http request to the Fluro REST API
   * @function
   * @param {String} path The Fluro API endpoint to request
   * @param {Object} config Optional parameters for the request
   * @example
   *
   * fluro.api.put('/content/article/5ca3d64dd2bb085eb9d450db', {
   *   title:'my new article', ...
   * }, {
   *   // headers and other things
   * })
   * .then((response) => {
   *   console.log(response);
   * })
   * .catch((error) => {
   *   console.log(error);
   * });
   */
  public put: AxiosInstance['put']
  /**
   * @name api.delete
   * @description Makes a delete http request to the Fluro REST API
   * @function
   * @param {String} path The Fluro API endpoint to request
   * @param {Object} config Optional parameters for the request
   * @example
   *
   fluro.api.delete('/content/article/5ca3d64dd2bb085eb9d450db')
   * .then((response) => {
   *   console.log(response);
   * })
   * .catch((error) => {
   *   console.log(error);
   * });
   */
  public delete: AxiosInstance['delete']

  /**
   * A helper function for generating an authenticated url for the current user
   * @param  {string} endpoint The id of the asset, or the asset object you want
   * to download
   * @alias api.generateEndpointURL
   * @param  {object} params
   * @return {string}          A full URL with relevant parameters included
   * @example
   * // returns 'https://api.this.fluro.io/something?accessoken=2352345...'
   fluro.api.generateEndpointURL('/something');
   */
  generateEndpointURL(path, params) {
    if (!path || !String(path).length) {
      return
    }
    if (!params) {
      params = {}
    }
    let url = `${this.fluro.apiURL}${path}`

    url = this.parameterDefaults(url, params)

    // Map the parameters to a query string
    const queryParameters = this.fluro.utils.mapParameters(params)
    if (queryParameters.length) {
      url += '?' + queryParameters
    }
    return url
  }

  private parameterDefaults(url, params) {
    // If we haven't requested without token
    if (!params.withoutToken) {
      // Get the current token from FluroAuth
      const CurrentFluroToken = this.fluro.auth.getCurrentToken()
      // Check to see if we have a token and none has been explicity set
      if (!params.accessoken && CurrentFluroToken) {
        // Use the current token by default
        params.accessoken = CurrentFluroToken
      }
    }

    if (this.fluro.app && this.fluro.app.uuid) {
      params.did = this.fluro.app.uuid
    }
    return url
  }

  // Get all mongo ids from a string
  private retrieveIDs(data) {
    let dataString
    if (isString(data)) {
      dataString = data
    } else {
      dataString = JSON.stringify(data)
    }
    // Find all mongo ids included in the object
    const myregexp = /[0-9a-fA-F]{24}/g
    const matches = dataString.match(myregexp)
    // Make sure the matches are unique
    return uniq(matches)
  }

  private getCacheKeyFromConfig(config) {
    const key = compact([
      config.method,
      config.url,
      JSON.stringify({ params: config.params, data: config.data }),
      this.fluro.app && this.fluro.app.user ? this.fluro.app.user.persona : '',
      config.application ? 'application' : '',
      config.disableUserContext ? 'disableUserContext' : ''
    ]).join('-')
    return key
  }
}
