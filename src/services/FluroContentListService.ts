import _ from 'lodash'

import FluroDispatcher from '../api/fluro.dispatcher'

const FluroContentListService = (typeName, fluro, options) => {
  if (!options) {
    options = {}
  }

  if (!options.pageIndex) {
    options.pageIndex = 0
  }
  if (!options.perPage) {
    options.perPage = 25
  }

  let _type = typeName
  let _criteria = options.criteria || {}
  let _pageIndex = Math.max(options.pageIndex, 0)
  let _perPage = Math.min(options.perPage, 200)
  let _loadingFilter = false
  let _loadingPage = false
  let _fields = options.fields || []
  let _items = []
  let _page = []
  let _cacheKey = options.cacheKey
  const _pages = []
  let _cumulative = options.cumulative
  // // Default all definitions to true
  // let _allDefinitions = options.allDefinitions === false ? false : true;

  const service = {}

  // Create a new dispatcher
  const dispatcher = new FluroDispatcher()
  dispatcher.bootstrap(service)

  // Get our list cache
  const listCache = fluro.cache.get('listcache')
  const pageCache = fluro.cache.get('pagecache')
  const cumulativeCache = fluro.cache.get(`cumulativecache`)

  service.filter = () => {
    // /console.log('REFILTER', _cacheKey)
    _loadingFilter = true
    return new Promise((resolve, reject) => {
      // Generate a unique cache key for this function call
      const cacheString = `${_type}-${JSON.stringify(_criteria)}-${
        _cacheKey || 'none'
      }`
      const cachedFilterResults = listCache.get(cacheString)
      if (cachedFilterResults) {
        _items = cachedFilterResults
        dispatcher.dispatch('items', _items)

        resolve(cachedFilterResults)
        _loadingFilter = false
      } else {
        fluro.content
          .filter(_type, _criteria)
          .then((filtered) => {
            _items = filtered
            dispatcher.dispatch('items', _items)
            // Save our results to the cache
            const cachedFilterResults = filtered
            listCache.set(cacheString, cachedFilterResults)
            // Populate the pageIndex items
            resolve(cachedFilterResults)
            _loadingFilter = false
            dispatcher.dispatch('loadingFilter', _loadingFilter)
          })
          .catch((err) => {
            reject(err)
            _loadingFilter = false
            dispatcher.dispatch('loadingFilter', _loadingFilter)
            dispatcher.dispatch('error', err)
          })
      }
    })
  }

  service.reloadCurrentPage = () => {
    // /console.log('reload current page')
    const start = Math.floor(_perPage * _pageIndex)
    const end = start + _perPage

    const itemCachePrefix = `${_fields.join(',')}-${_cacheKey || 'none'}`

    _loadingPage = true
    return new Promise((resolve, reject) => {
      service.filter().then((filtered) => {
        const startingIndex = _cumulative ? 0 : start
        console.log('cumulative test', startingIndex, start, end)
        const listItems = filtered.slice(startingIndex, end)
        // Create a fast hash
        const pageItemLookup = listItems.reduce((set, item) => {
          set[item._id] = item
          return set
        }, {})
        // Find the IDs we need to load
        let ids = []
        if (_cumulative) {
          // Only load the items that we need to
          const cachedItems = _.map(listItems, (item) => {
            const itemCacheKey = `${itemCachePrefix}-${item._id}`
            const cachedItem = cumulativeCache.get(itemCacheKey)
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
          } else {
          }
        } else {
          ids = fluro.utils.arrayIDs(listItems)
        }
        dispatcher.dispatch('totalPages', service.totalPages)
        // Get our page cache
        const pageCacheKey = `${_cumulative}-${ids.join(',')}-${_fields.join(
          ','
        )}-${_cacheKey || 'none'}`
        const cachedPageResults = pageCache.get(pageCacheKey)
        // If we already have this page cached
        if (cachedPageResults) {
          // Skip ahead
          return pageComplete(cachedPageResults)
        }
        // Make a request to the server to load the bits we need
        return fluro.content
          .getMultiple(_type, ids, {
            select: _fields
          })
          .then(multipleResultsLoaded)
          .catch((err) => {
            reject(err)
            _loadingPage = false
            dispatcher.dispatch('loadingPage', _loadingPage)
          })
        function multipleResultsLoaded(pageItems) {
          console.log('Multiple Results loaded', ids, pageItems)
          const lookup = pageItems.reduce((set, item) => {
            set[item._id] = item
            return set
          }, {})
          // If we have loaded some items
          if (_cumulative) {
            // We need to compile the items we already cached mixed with the results
            // we just loaded from the server
            const combinedCacheItems = listItems.map((item) => {
              const itemCacheKey = `${itemCachePrefix}-${item._id}`
              const cachedEntry = cumulativeCache.get(itemCacheKey)
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
            if (!cumulativeCache.get(itemCacheKey)) {
              cumulativeCache.set(itemCacheKey, augmented)
            }
            return augmented
          })
          console.log(
            'PAGE COMPLETE - First',
            _.get(pageItems, '[0].title'),
            '-',
            _.get(items, '[0].title')
          ) // , items)

          // Save the page to our cache
          pageCache.set(pageCacheKey, items)
          // Save our results to the cache
          _page = items
          resolve(items)
          _loadingPage = false
          dispatcher.dispatch('loadingPage', _loadingPage)
          dispatcher.dispatch('page', _page)
        }
      })
    })
  }
  service.nextPage = () => {
    service.pageIndex++
  }
  service.previousPage = () => {
    service.pageIndex--
  }
  //   // Object.defineProperty(service, "nextPageEnabled", {
  //     get() {
  //         return service.pageIndex < Math.ceil(_items.length / _perPage) - 1;
  //     }
  // });
  // Object.defineProperty(service, "previousPageEnabled", {
  //     get() {
  //         return service.pageIndex > 0;
  //     }
  // });
  Object.defineProperty(service, 'loading', {
    get() {
      return _loadingFilter || _loadingPage
    }
  })
  Object.defineProperty(service, 'perPage', {
    get() {
      return _perPage
    },
    set(i) {
      if (!i) {
        i = 25
      }
      i = Math.min(i, 200)
      i = Math.max(i, 0)
      // If there is no change
      if (_perPage === i) {
        return
      }
      _perPage = i
      // Reset the page in case we are too far ahead
      service.pageIndex = 0 // service.pageIndex;
      dispatcher.dispatch('perPage', _perPage)
      dispatcher.dispatch('totalPages', service.totalPages)

      service.reloadCurrentPage()
    }
  })
  Object.defineProperty(service, 'cacheKey', {
    get() {
      return _cacheKey
    },
    set(c) {
      // If there is no change
      if (_cacheKey === c) {
        return
      }
      _cacheKey = c
      // /console.log('CACHE KEY HAS CHANGED')
      service.reloadCurrentPage()
    }
  })
  Object.defineProperty(service, 'pageIndex', {
    get() {
      return _pageIndex
    },
    set(i) {
      const previousIndex = _pageIndex
      if (!i) {
        i = 0
      }
      const maxPages = Math.ceil(_items.length / _perPage)
      i = Math.min(i, maxPages - 1)
      i = Math.max(i, 0)
      // If there is no change
      if (_pageIndex === i) {
        return
      }
      _pageIndex = i
      dispatcher.dispatch('pageIndex', _pageIndex)
      service.reloadCurrentPage()
    }
  })
  Object.defineProperty(service, 'items', {
    get() {
      return _items
    }
  })
  Object.defineProperty(service, 'page', {
    get() {
      return _page
    }
  })
  Object.defineProperty(service, 'totalPages', {
    get() {
      return Math.ceil(_items.length / _perPage)
    }
  })
  Object.defineProperty(service, 'total', {
    get() {
      return _items.length
    }
  })
  Object.defineProperty(service, 'criteria', {
    get() {
      return _criteria
    },
    set(obj) {
      // If there is no change
      if (JSON.stringify(_criteria) === JSON.stringify(obj)) {
        return
      }
      _criteria = obj
      // /console.log('criteria changed');
      service.reloadCurrentPage()
    }
  })
  Object.defineProperty(service, 'fields', {
    get() {
      return _fields
    },
    set(array) {
      // If there is no change
      if (JSON.stringify(_fields) === JSON.stringify(array)) {
        return
      }
      _fields = array
      // /console.log('fields changed');
      service.reloadCurrentPage()
    }
  })
  // Object.defineProperty(service, "allDefinitions", {
  //     get() {
  //         return _allDefinitions;
  //     },
  //     set(boolean) {

  //         _allDefinitions = boolean;
  //         // /console.log('fields changed');
  //         service.reloadCurrentPage();
  //     }
  // });
  Object.defineProperty(service, 'type', {
    get() {
      return _type
    },
    set(type) {
      // If there is no change
      if (_type === type) {
        return
      }
      _type = type
      service.reloadCurrentPage()
    }
  })
  Object.defineProperty(service, 'cumulative', {
    get() {
      return _cumulative
    },
    set(cumulative) {
      // If there is no change
      if (_cumulative === cumulative) {
        return
      }
      _cumulative = cumulative
      service.reloadCurrentPage()
    }
  })
  service.reloadCurrentPage()
  return service
}
export default FluroContentListService
