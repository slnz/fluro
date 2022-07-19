import { Cache } from 'axios-extensions'
import { each } from 'lodash'

const caches = {}
/**
 * @classdesc A static service that provides tools for caching api requests and other information
 * @alias cache
 * @class
 * @hideconstructor
 */
const FluroCache = {
  /**
   * A helper function to reset all cache objects, useful if changing account or logging in or out as another user
   * @alias cache.reset
   */
  reset() {
    each(caches, (cache) => {
      cache.reset()
    })
  },

  /**
   * A helper function to retrieve a specific cache
   * @alias cache.get
   * @param  {string} key The key for the cache you want to retrieve
   * @return {LRUCache} The cache store for the specified key
   */
  get(key, options?) {
    if (caches[key]) {
      return caches[key]
    }
    caches[key] = new Cache(options)
    return caches[key]
  }
}

export default FluroCache
