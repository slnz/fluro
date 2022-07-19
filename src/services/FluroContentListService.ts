import { get, map, reduce, slice } from 'lodash'

import type FluroCore from '../api/fluro.core'
import FluroDispatcher from '../api/fluro.dispatcher'

export default class FluroContentListService {
  _type
  _criteria
  _pageIndex
  _perPage
  _loadingFilter = false
  _loadingPage = false
  _fields
  _items = []
  _page = []
  _cacheKey
  _pages = []
  _cumulative
  listCache
  pageCache
  cumulativeCache
  dispatcher: FluroDispatcher

  constructor(typeName, private core: FluroCore, options) {
    if (!options) {
      options = {}
    }

    if (!options.pageIndex) {
      options.pageIndex = 0
    }
    if (!options.perPage) {
      options.perPage = 25
    }

    this._type = typeName
    this._criteria = options.criteria || {}
    this._pageIndex = Math.max(options.pageIndex, 0)
    this._perPage = Math.min(options.perPage, 200)
    this._fields = options.fields || []
    this._cacheKey = options.cacheKey
    this._cumulative = options.cumulative
    // // Default all definitions to true
    // let _allDefinitions = options.allDefinitions === false ? false : true;

    // Create a new this.dispatcher
    this.dispatcher = new FluroDispatcher()
    this.dispatcher.bootstrap(this)

    // Get our list cache
    this.listCache = this.core.cache.get('listcache')
    this.pageCache = this.core.cache.get('pagecache')
    this.cumulativeCache = this.core.cache.get(`cumulativecache`)

    this.reloadCurrentPage()
  }

  filter() {
    // /console.log('REFILTER', this._cacheKey)
    this._loadingFilter = true
    return new Promise((resolve, reject) => {
      // Generate a unique cache key for this function call
      const cacheString = `${this._type}-${JSON.stringify(this._criteria)}-${
        this._cacheKey || 'none'
      }`
      const cachedFilterResults = this.listCache.get(cacheString)
      if (cachedFilterResults) {
        this._items = cachedFilterResults
        this.dispatcher.dispatch('items', this._items)

        resolve(cachedFilterResults)
        this._loadingFilter = false
      } else {
        this.core.content
          .filter(this._type, this._criteria)
          .then((filtered) => {
            this._items = filtered
            this.dispatcher.dispatch('items', this._items)
            // Save our results to the cache
            const cachedFilterResults = filtered
            this.listCache.set(cacheString, cachedFilterResults)
            // Populate the pageIndex items
            resolve(cachedFilterResults)
            this._loadingFilter = false
            this.dispatcher.dispatch('loadingFilter', this._loadingFilter)
          })
          .catch((err) => {
            reject(err)
            this._loadingFilter = false
            this.dispatcher.dispatch('loadingFilter', this._loadingFilter)
            this.dispatcher.dispatch('error', err)
          })
      }
    })
  }

  reloadCurrentPage() {
    // /console.log('reload current page')
    const start = Math.floor(this._perPage * this._pageIndex)
    const end = start + this._perPage

    const itemCachePrefix = `${this._fields.join(',')}-${
      this._cacheKey || 'none'
    }`

    this._loadingPage = true
    return new Promise((resolve, reject) => {
      this.filter().then((filtered) => {
        const startingIndex = this._cumulative ? 0 : start
        console.log('cumulative test', startingIndex, start, end)
        const listItems = slice(filtered, startingIndex, end)
        // Create a fast hash
        const pageItemLookup: Record<string, unknown> = reduce(
          listItems,
          (set, item) => {
            set[item._id] = item
            return set
          },
          {}
        )
        // Find the IDs we need to load
        let ids: string[] = []
        if (this._cumulative) {
          // Only load the items that we need to
          const cachedItems = map(listItems, (item) => {
            const itemCacheKey = `${itemCachePrefix}-${item._id}`
            const cachedItem = this.cumulativeCache.get(itemCacheKey)
            if (!cachedItem) {
              ids.push(item._id)
            }
            return cachedItem
          })
          // If we already have all the items cached
          if (!ids.length) {
            // Skip ahead because we don't need to load them from the server
            console.log('Page complete empty ids')
            return pageComplete(cachedItems)
          }
        } else {
          ids = this.core.utils.arrayIDs(listItems)
        }
        this.dispatcher.dispatch('totalPages', this.totalPages)
        // Get our page cache
        const pageCacheKey = `${this._cumulative}-${ids.join(
          ','
        )}-${this._fields.join(',')}-${this._cacheKey || 'none'}`
        const cachedPageResults = this.pageCache.get(pageCacheKey)
        // If we already have this page cached
        if (cachedPageResults) {
          // Skip ahead
          return pageComplete(cachedPageResults)
        }
        // Make a request to the server to load the bits we need
        return this.core.content
          .getMultiple(this._type, ids, {
            select: this._fields
          })
          .then(multipleResultsLoaded)
          .catch((err) => {
            reject(err)
            this._loadingPage = false
            this.dispatcher.dispatch('loadingPage', this._loadingPage)
          })
        function multipleResultsLoaded(pageItems) {
          console.log('Multiple Results loaded', ids, pageItems)
          const lookup = pageItems.reduce((set, item) => {
            set[item._id] = item
            return set
          }, {})
          // If we have loaded some items
          if (this._cumulative) {
            // We need to compile the items we already cached mixed with the results
            // we just loaded from the server
            const combinedCacheItems = listItems.map((item) => {
              const itemCacheKey = `${itemCachePrefix}-${item._id}`
              const cachedEntry = this.cumulativeCache.get(itemCacheKey)
              if (cachedEntry) {
                return cachedEntry
              } else {
                return lookup[item._id]
              }
            })
            return pageComplete(combinedCacheItems)
          } else {
            return pageComplete(pageItems)
          }
        }
        function pageComplete(pageItems) {
          // Augment our existing filter list with our populated data
          const items = pageItems.map((item) => {
            // Augment the original filtered item with the populated item
            const augmented = Object.assign({}, pageItemLookup[item._id], item)
            // Store in cache for later
            const itemCacheKey = `${itemCachePrefix}-${item._id}`
            if (!this.cumulativeCache.get(itemCacheKey)) {
              this.cumulativeCache.set(itemCacheKey, augmented)
            }
            return augmented
          })
          console.log(
            'PAGE COMPLETE - First',
            get(pageItems, '[0].title'),
            '-',
            get(items, '[0].title')
          ) // , items)

          // Save the page to our cache
          this.pageCache.set(this.pageCacheKey, items)
          // Save our results to the cache
          this._page = items
          resolve(items)
          this._loadingPage = false
          this.dispatcher.dispatch('loadingPage', this._loadingPage)
          this.dispatcher.dispatch('page', this._page)
        }
      })
    })
  }

  nextPage() {
    this.pageIndex++
  }

  previousPage() {
    this.pageIndex--
  }

  get loading() {
    return this._loadingFilter || this._loadingPage
  }

  get perPage() {
    return this._perPage
  }

  set perPage(i) {
    if (!i) {
      i = 25
    }
    i = Math.min(i, 200)
    i = Math.max(i, 0)
    // If there is no change
    if (this._perPage === i) {
      return
    }
    this._perPage = i
    // Reset the page in case we are too far ahead
    this.pageIndex = 0 // this.pageIndex;
    this.dispatcher.dispatch('perPage', this._perPage)
    this.dispatcher.dispatch('totalPages', this.totalPages)

    this.reloadCurrentPage()
  }

  get cacheKey() {
    return this._cacheKey
  }

  set cacheKey(c) {
    // If there is no change
    if (this._cacheKey === c) {
      return
    }
    this._cacheKey = c
    // /console.log('CACHE KEY HAS CHANGED')
    this.reloadCurrentPage()
  }

  get pageIndex() {
    return this._pageIndex
  }

  set pageIndex(i) {
    if (!i) {
      i = 0
    }
    const maxPages = Math.ceil(this._items.length / this._perPage)
    i = Math.min(i, maxPages - 1)
    i = Math.max(i, 0)
    // If there is no change
    if (this._pageIndex === i) {
      return
    }
    this._pageIndex = i
    this.dispatcher.dispatch('pageIndex', this._pageIndex)
    this.reloadCurrentPage()
  }

  get items() {
    return this._items
  }

  get page() {
    return this._page
  }

  get totalPages() {
    return Math.ceil(this._items.length / this._perPage)
  }

  get total() {
    return this._items.length
  }

  get criteria() {
    return this._criteria
  }

  set criteria(obj) {
    // If there is no change
    if (JSON.stringify(this._criteria) === JSON.stringify(obj)) {
      return
    }
    this._criteria = obj
    // /console.log('criteria changed');
    this.reloadCurrentPage()
  }

  get fields() {
    return this._fields
  }

  set fields(array) {
    // If there is no change
    if (JSON.stringify(this._fields) === JSON.stringify(array)) {
      return
    }
    this._fields = array
    // /console.log('fields changed');
    this.reloadCurrentPage()
  }

  // get allDefinitions() {
  //   return this._allDefinitions
  // }

  // set allDefinitions(boolean) {
  //   this._allDefinitions = boolean
  //   this.reloadCurrentPage()
  // }
  get type() {
    return this._type
  }

  set type(type) {
    // If there is no change
    if (this._type === type) {
      return
    }
    this._type = type
    this.reloadCurrentPage()
  }

  get cumulative() {
    return this._cumulative
  }

  set cumulative(cumulative) {
    // If there is no change
    if (this._cumulative === cumulative) {
      return
    }
    this._cumulative = cumulative
    this.reloadCurrentPage()
  }

  // get nextPageEnabled() {
  //   return this.pageIndex < Math.ceil(this._items.length / this._perPage) - 1
  // }

  // get previousPageEnabled() {
  //   return this.pageIndex > 0
  // }
}
