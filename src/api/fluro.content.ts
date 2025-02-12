import axios from 'axios'
import { assign, orderBy, reduce, uniq } from 'lodash'

import FluroContentListService from '../services/FluroContentListService'

import type FluroCore from './fluro.core'

const CancelToken = axios.CancelToken
/**
 * Creates a new FluroContent instance.
 * This module provides a number of helper functions for Creating, Reading, Updating and Deleting content via the Fluro API
 * @alias content
 * @constructor
 * @hideconstructor
 * @param {FluroCore} fluro A reference to the parent instance of the FluroCore module. This module is usually created by a FluroCore instance that passes itself in as the first argument.
 */
export default class FluroContent {
  // Keep track of any refresh requests
  inflightRefreshRequest
  currentSearch

  constructor(private core: FluroCore) {
    if (!this.core.api) {
      throw new Error(`Can't Instantiate FluroContent before FluroAPI exists`)
    }
  }

  /**
   * Runs a search from the Fluro server and returns the results
   * @alias content.search
   * @param  {String} terms   The keywords to search for
   * @param  {Object} options Extra Configuration and options for how to search the database and how to render the results
   * @param  {Object} options.limit How many results should be returned. Defaults to 10
   * @param  {Array} options.types Specify types or definition names for which items should be searched for
   * @param  {Boolean} options.showQuery If true will return the query used to search instead of the search results themselves
   * @return {Array}         An array of content items that match the search, if options.types is specified will be a nested array of results for each type
   *
   * @example
   * fluro.content.search('Wonder', {limit:5, types:['song', 'album', 'tag']}).then(function(results) {
   *  // Will return a nested array with up to 5 results for each type
   *  // [{_type:'Song', results:[{title:"Wonder"...}]}, {_type:'Album', results:[{title:"Wonder"...}]}]
   * })
   *
   * fluro.content.search('Wonder', {limit:5}).then(function(results) {
   *  // Will return an array of up to 5 items the user has access to view that match the search terms
   *  // [{title:"Wonder", _type:'article', definition:'song'...}, {title:"Wonder", _type:'article', definition:'album'...}]
   * })
   */

  search(terms, params, config) {
    if (!params) {
      params = {}
    }
    if (!params.limit) {
      params.limit = 10
    }

    if (this.currentSearch) {
      // cancel the request (the message parameter is optional)
      this.currentSearch.cancel('Operation canceled by the user.')
    }

    this.currentSearch = CancelToken.source()

    return new Promise((resolve) => {
      if (!terms || !terms.length) {
        return resolve([])
      }
      if (!config) {
        config = {}
      }
      config.params = params
      config.cancelToken = this.currentSearch.token
      // let requestOptions = {
      //     params: options,
      //     cancelToken: this.currentSearch.token,
      // }

      // Retrieve the query results
      this.core.api
        .get(`/content/search/${terms}`, config)
        .then((res) => {
          resolve(res.data)
        })
        .catch((thrown) => {
          if (axios.isCancel(thrown)) {
            //           } else {
            // handle error
          }
        })
    })
  }

  /**
   * Retrieves a specific definition or data type
   * @alias content.type
   * @param  {String} definitionName   The defined type or definition name to retrieve
   * @param  {Object} options Extra Configuration and options for how to search the database and how to render the results
   * @return {Promise}         A promise that will resolve with the definition
   *
   * @example
   * fluro.content.type('song', options, config).then(function(definition) {
   *  // Will return the definition
   * })
   */
  typePromise = {}
  typeCacheable = true

  type(definitionName, params) {
    if (!params) {
      params = {}
    }
    if (!definitionName) {
      throw Error('No definition name was provided')
    }

    // If we are already requesting this definition
    if (this.typePromise[definitionName] && params.cache !== false) {
      return this.typePromise[definitionName]
    }
    // Create a new promise
    this.typePromise[definitionName] = new Promise((resolve, reject) => {
      // if (!config) {
      //     config = {};
      // }
      // config.params = params;
      // let requestOptions = {
      //     params: options,
      //     cancelToken: currentMentionSearch.token,
      // }

      // Retrieve the definition from the server and send it back to
      // the user
      this.core.api
        .get(`/defined/${definitionName}`)
        .then((res) => {
          resolve(res.data)
          this.typeCacheable = true
        })
        .catch((err) => {
          reject(err)
          this.typeCacheable = false
        })
    })

    return this.typePromise[definitionName]
  }

  /**
   * Runs a search from the Fluro server for a specific mentionable user
   * @alias content.mention
   * @param  {String} mentionID   the Name or Mention ID of the persona to search for
   * @param  {Object} options Extra Configuration and options for how to search the database and how to render the results
   * @param  {Object} config Optional HTTP Request Configuration
   * @param  {Integer} options.limit Extra Configuration and options for how to search the database and how to render the results
   * @param  {Integer} options.managed Search for managed personas instead of Global Fluro user personas
   * @return {Array}         An array of personas who can be mentioned
   *
   * @example
   * fluro.content.mention('john.smith', {limit:5}, config).then(function(results) {
   *  // Will return a nested array with up to 5 personas
   * })
   */

  currentMentionSearch

  mention(terms, params, config) {
    if (!params) {
      params = {}
    }
    if (!params.limit) {
      params.limit = 5
    }

    if (this.currentMentionSearch) {
      // cancel the request (the message parameter is optional)
      this.currentMentionSearch.cancel('Operation canceled by the user.')
    }

    this.currentMentionSearch = CancelToken.source()

    return new Promise((resolve) => {
      if (!terms || !terms.length) {
        return resolve([])
      }
      if (!config) {
        config = {}
      }
      config.params = params
      config.cancelToken = this.currentMentionSearch.token
      // let requestOptions = {
      //     params: options,
      //     cancelToken: currentMentionSearch.token,
      // }

      // Retrieve the query results
      this.core.api
        .get(`/mention/${terms}`, config)
        .then((res) => {
          resolve(res.data)
        })
        .catch((thrown) => {
          if (axios.isCancel(thrown)) {
            //           } else {
            // handle error
          }
        })
    })
  }

  /**
   * A helper function for retrieving the results of a specified query
   * @alias content.query
   * @param  {String} queryID The id of the query you want to run
   * @param  {Object} options The options for the query
   * @param  {Object} options.params The query string parameters for the query that will be mapped ?one=value&two=value
   * @param  {Object} options.variables Any query variables you wish to inject each key will be mapped ?variables[key]=value
   * @return {Promise}         A promise that will be resolved with the results or an error
   */
  query(queryID, options, requestOptions) {
    // Get as just a query
    queryID = this.core.utils.getStringID(queryID)
    if (!options) {
      options = {}
    }
    if (!requestOptions) {
      requestOptions = {
        params: {}
      }
    }
    return new Promise((resolve, reject) => {
      // If there are query string parameters
      if (options.params) {
        requestOptions.params = options.params
      }

      if (options.variables) {
        const variableParams = reduce(
          options.variables,
          (set, value, key) => {
            set[`variables[${key}]`] = value
            return set
          },
          {}
        )
        // Add it to our parameters
        assign(requestOptions.params, variableParams)
      }

      // Retrieve the query results
      this.core.api
        .get(`/content/_query/${queryID}`, requestOptions)
        .then((res) => {
          resolve(res.data)
        }, reject)
    })
  }

  /**
   * This function returns a single populated item by providing its _id
   * @alias content.get
   * @param  {String} id The item's _id
   * @param  {Object} params Extra query string parameters for the request
   * @return {Promise}         A promise that will be resolved with the item or an error
   * @example
   *
   * // Retrieve just the title for item '5be504eabf33991239599d63'
   * fluro.content.get('5be504eabf33991239599d63', {select:'title'})
   */
  get(id, params?, requestOptions?) {
    if (!requestOptions) {
      requestOptions = {}
    }

    // Ensure it's a simple single ID
    id = this.core.utils.getStringID(id)

    if (!params) {
      params = {}
    }

    return new Promise((resolve, reject) => {
      // If there are query string parameters
      if (params) {
        requestOptions.params = params
      }

      //       // Retrieve the query results
      this.core.api.get(`/content/get/${id}`, requestOptions).then((res) => {
        resolve(res.data)
      }, reject)
    })
  }

  /**
   * This function returns a single populated item by providing its _external id
   * @alias content.external
   * @param  {String} externalID The item's _external id property
   * @param  {Object} params Extra query string parameters for the request
   * @return {Promise}         A promise that will be resolved with the item or an error
   * @example
   *
   * // Retrieve just the title for item with external id that matches '5be504-eabf33991-239599-d63'
   * fluro.content.external('5be504-eabf33991-239599-d63', {select:'title'})
   */
  external(id, params, requestOptions) {
    if (!requestOptions) {
      requestOptions = {}
    }

    if (!params) {
      params = {}
    }
    return new Promise((resolve, reject) => {
      // If there are query string parameters
      if (params) {
        requestOptions.params = params
      }

      // Retrieve the query results
      this.core.api
        .get(`/content/external/${id}`, requestOptions)
        .then((res) => {
          resolve(res.data)
        }, reject)
    })
  }

  /**
   * This function returns a single populated item by providing its slug
   * @alias content.slug
   * @param  {String} slug The item's slug value
   * @param  {Object} params Extra query string parameters for the request
   * @return {Promise}         A promise that will be resolved with the item or an error
   * @example
   *
   * // Retrieve just the title for item with the slug 'my-article'
   * fluro.content.slug('my-article', {select:'title'})
   */
  slug(id, params, requestOptions) {
    if (!requestOptions) {
      requestOptions = {}
    }
    if (!params) {
      params = {}
    }
    return new Promise((resolve, reject) => {
      // If there are query string parameters
      if (params) {
        requestOptions.params = params
      }

      // Retrieve the query results
      this.core.api.get(`/content/slug/${id}`, requestOptions).then((res) => {
        resolve(res.data)
      }, reject)
    })
  }

  /**
   * A helper function for retrieving the results of a dynamic query
   * @alias content.retrieve
   * @param  {Object} criteria The query criteria
   * @param  {Object} options Extra options and parameters
   * @return {Promise}         A promise that will be resolved with the results or an error
   * @example
   *
   * // Find all events that have a status of active or archived where the endDate is greater than or equal to now and return the titles
   * fluro.content.retrieve({_type:'event', status:{$in:['active', 'archived']}, endDate:{$gte:"date('now')"}}}, {select:'title'})
   */
  retrieve(criteria, params, requestOptions) {
    if (!params) {
      params = {}
    }
    if (!requestOptions) {
      requestOptions = {}
    }
    return new Promise((resolve, reject) => {
      // If there are query string parameters
      if (params) {
        requestOptions.params = params
      }

      // Retrieve the query results
      this.core.api
        .post(`/content/_query`, criteria, requestOptions)
        .then((res) => {
          resolve(res.data)
        }, reject)
    })
  }

  /**
   * This function returns a list of related items
   * That either reference the specified item or are referenced by the provided item
   * @alias content.related
   * @param  {String} id The item to find related content for
   * @param  {Object} params Extra query string parameters for the request
   * @return {Promise}         A promise that will be resolved with an array of related items
   * @example
   *
   * // Retrieve some related items for '5be504eabf33991239599d63'
   * fluro.content.related('5be504eabf33991239599d63', {select:'title'})
   */
  related(id, params, requestOptions) {
    id = this.core.utils.getStringID(id)
    if (!id) {
      throw Error(`No id specified ${id}`)
    }
    if (!requestOptions) {
      requestOptions = {}
    }
    if (!params) {
      params = {}
    }
    return new Promise((resolve, reject) => {
      // If there are query string parameters
      if (params) {
        requestOptions.params = params
      }
      // service.retrieve(criteria, requestOptions).then(resolve, reject);
      // Retrieve the query results
      this.core.api
        .get(`/content/related/${id}`, requestOptions)
        .then((res) => {
          resolve(res.data)
        }, reject)
    })
  }

  /**
   * This function returns an interaction definition via the public 'form' API endpoint
   * This will only result successfully if the definition requested has the definition of 'form' and has the status of 'active'
   * @alias content.form
   * @param  {String} id The id of the form to retrieve
   * @param  {Object} options Extra options for the request
   * @param  {Object} options.testing Whether to load the form in testing mode or not
   * @return {Promise}         A promise that will be resolved with the form or an error
   * @example
   *
   * // Retrieve a form ('58dca23c21428d2d045a1cf7') in testing mode
   * fluro.content.form('58dca23c21428d2d045a1cf7', {testing:true})
   */
  form(id, options, requestOptions) {
    id = this.core.utils.getStringID(id)
    if (!id) {
      throw Error(`No id specified ${id}`)
    }
    if (!requestOptions) {
      requestOptions = {}
    }
    if (!options) {
      options = {}
    }
    if (options.requestOptions) {
      requestOptions = options.requestOptions
    }
    return new Promise((resolve, reject) => {
      // If there are query string parameters
      // if (params) {
      //     requestOptions.params = params;
      // }
      // service.retrieve(criteria, requestOptions).then(resolve, reject);
      //       // Retrieve the query results
      this.core.api.get(`/form/${id}`, requestOptions).then(() => {
        //         resolve(res.data)
      }, reject)
    })
  }

  /**
   * This function makes it easy to submit form interactions via the Fluro API
   * @alias content.submitInteraction
   * @param  {String} definitionName the definition of the form you want to submit eg. 'supportRequest' or 'contactUs'...
   * @param  {Object} data The interaction data to submit
   * @param  {Object} options Extra options for the request
   * @param  {Object} options.reply The id of the post to reply to (If threaded conversation)
   * @return {Promise}         A promise that will be resolved with an array of related items
   * @example
   *
   * // Retrieve some related items for '5be504eabf33991239599d63'
   * fluro.content.submitInteraction('5be504eabf33991239599d63', 'comment', {data:{customField:'My message'}}, {reply:'5be504eabf33991239599d63'})
   */
  submitInteraction(type, submission, options) {
    if (!options) {
      options = {}
    }
    return new Promise((resolve, reject) => {
      const requestOptions = options

      // Retrieve the query results
      this.core.api
        .post(`/interact/${type}`, submission, requestOptions)
        .then((res) => {
          resolve(res.data)
        }, reject)
    })
  }

  /**
   * This function makes it easy to create and attach a post to a specified piece of fluro content
   * @alias content.submitPost
   * @param  {String} target The ID of the item to attach this post to
   * @param  {String} definitionName the definition type of the post you want to create eg. 'note' or 'comment'...
   * @param  {Object} data The post content to create
   * @param  {Object} options Extra options for the request
   * @param  {Object} options.reply The id of the post to reply to (If threaded conversation)
   * @return {Promise}         A promise that will be resolved with an array of related items
   * @example
   *
   * // Retrieve some related items for '5be504eabf33991239599d63'
   * fluro.content.submitPost('5be504eabf33991239599d63', 'comment', {data:{customField:'My message'}}, {reply:'5be504eabf33991239599d63'})
   */
  submitPost(id, type, body, options) {
    id = this.core.utils.getStringID(id)
    if (!id) {
      throw Error(`No target specified ${id}`)
    }
    if (!options) {
      options = {}
    }
    return new Promise((resolve, reject) => {
      const requestOptions =
        options.requestOptions ||
        {
          // params: {}
        }
      // Retrieve the query results
      this.core.api
        .post(`/post/${id}/${type}`, body, requestOptions)
        .then((res) => {
          resolve(res.data)
        }, reject)
    })
  }

  /**
   * This function makes it easy to retrieve the current thread of posts attached to a specific
   * item
   * @alias content.thread
   * @param  {String} target The ID of the item to attach this post to
   * @param  {String} definitionName the definition type of the post you want to create eg. 'note' or 'comment'...
   * @param  {Object} data The post content to create
   * @param  {Object} options Extra options for the request
   * @param  {Object} options.reply The id of the post to reply to (If threaded conversation)
   * @return {Promise}         A promise that will be resolved with an array of related items
   * @example
   *
   * // Retrieve the current post thread of all 'comments' attached to a specific content
   * fluro.content.thread('5be504eabf33991239599d63', 'comment', {data:{customField:'My message'}}, {reply:'5be504eabf33991239599d63'})
   */
  thread(id, type, options) {
    id = this.core.utils.getStringID(id)
    if (!id) {
      throw Error(`No target specified ${id}`)
    }
    if (!options) {
      options = {}
    }
    return new Promise((resolve, reject) => {
      const requestOptions = {
        // params: {}
      }
      // Retrieve the query results
      this.core.api.get(`/post/${id}/${type}`, requestOptions).then((res) => {
        resolve(res.data)
      }, reject)
    })
  }

  /**
   * This function makes it easy to retrieve all distinct values for a specified field key
   * for a specified subset of items from the server, for instance if you wanted to retrieve all possible 'firstName' values from
   * a selection of content ids
   * @alias content.values
   * @param  {Array} ids The ids you want to retrieve values for
   * @param  {String} key the key of the field you want to retrieve the values for
   * @return {Promise}         A promise that will be resolved with an array of possible values
   * @example
   *
   *
   * fluro.content.values(['5be504eabf33991239599d63'], 'firstName').then(function(values) {
   *       // Would return ['Frank', 'Lucy', 'Marissa']
   * })
   */
  values(ids, key?: string, options?) {
    ids = this.core.utils.arrayIDs(ids)
    // if (!ids | !ids.length ) {
    //     throw Error(`No ids specified ${ids}`);
    // }
    if (key == null || key.length === 0) {
      throw Error('No key specified')
    }
    if (!options) {
      options = {}
    }
    return new Promise((resolve, reject) => {
      const payload = {
        ids,
        key
      }

      let url = `/content/distinct/values`
      if (options.type) {
        url = `/content/${options.type}/distinct/values`
      }

      // Retrieve the query results
      return this.core.api.post(url, payload, options).then((res) => {
        resolve(
          orderBy(res.data, (entry) => {
            return entry.title || entry
          })
        )
      }, reject)
    })
  }

  createDuplicate(populatedItem) {
    const newItem = JSON.parse(JSON.stringify(populatedItem))
    delete newItem._id
    delete newItem.slug
    delete newItem.author
    delete newItem.managedAuthor
    delete newItem.__v
    delete newItem.created
    delete newItem.updated
    delete newItem.updatedBy
    delete newItem.stats
    delete newItem.privateDetails
    delete newItem._external
    delete newItem.apikey
    switch (newItem._type) {
      case 'event':
        // Clear out other bits
        newItem.plans = []
        newItem.assignments = []
        break
      case 'mailout':
        newItem.state = 'ready'
        newItem.subject = newItem.title
        newItem.title = newItem.title + ' Copy'
        delete newItem.publishDate
        break
      case 'plan':
        newItem.startDate = null
        break
      case 'persona':
        newItem.user = null
        newItem.collectionEmail = ''
        newItem.username = ''
        newItem.firstName = ''
        newItem.lastName = ''
        break
    }
    newItem.status = 'active'
    newItem.realms = []
    delete newItem.account
    return Promise.resolve(newItem)
  }

  /**
   * This function creates an instance of a FluroContentListService
   * this then becomes a service that can be used to retrieve filtered data from the server
   * @alias content.list
   * @param  {String} typeName The type or definition name of the content you want to retrieve
   * @param  {Object} options Extra options for creating the service
   * @param  {Object} options.criteria The filter criteria for specifying which content items should be returned
   * @param  {Object} options.criteria.sort The sorting configuration for the results
   * @param  {Boolean} options.criteria.allDefinitions Whether to include all defined types if a basic type is used as the typeName
   * @param  {Object} options.criteria.filter the fluro filter configuration for filtering returned results
   * @param  {String} options.criteria.search A basic keyword search for filtering results
   * @param  {Date} options.criteria.startDate Used in conjunction with endDate to crop results to a relevant date period
   * @param  {Date} options.criteria.endDate Used in conjunction with startDate to crop results to a relevant date period
   * @param  {Object} options.perPage The number of items to retrieve per page
   * @param  {Object} options.pageIndex The starting page to load from the list
   * @param  {Object} options.cumulative Whether new page items should append to the results or replace the results
   * @param  {Object} options.cacheKey A cache id that can be used to refresh cached results
   * @return {Object}         A new instance of a FluroContentListService
   * @example
   *
   * // How to sort the results
   * let sort = {
   *     key:'title',
   *     direction:'asc',
   *     type:'string',
   * }
   *
   * // If you want to filter by search keywords
   * let search = 'Any keywords you want to search for'
   *
   * // If you want to crop results to within a certain timeframe
   * let startDate;// = new Date();
   * let endDate;// = new Date()
   *
   * // For more complex AND/OR filtering
   * let filter = {
   *     operator:'and',
   *     filters:[
   *        {
   *           key:'status',
   *           comparator:'in',
   *           values:['active'],
   *        }
   *     ]
   * }
   *
   * let criteria = {
   *   search,
   *   sort,
   *   startDate,
   *   endDate,
   *   filter,
   * }
   *
   * let dataBucket = this.core.content.list('event', {
   *     perPage: 2,
   *     criteria,
   * });
   *
   * let isLoading = dataBucket.loading;
   * let allItems = dataBucket.items;
   * let pageItems = dataBucket.page;
   * let currentPage = dataBucket.pageIndex;
   * dataBucket.nextPage();
   * dataBucket.previousPage();
   * dataBucket.reloadCurrentPage();
   * dataBucket.addEventListener('items', function(results) {});
   * dataBucket.addEventListener('error', function(err) { console.log('an error occurred')});
   * dataBucket.addEventListener('totalPages', function() { console.log('the number of pages changed')});
   * dataBucket.addEventListener('loadingFilter', function() { console.log('filter is reloading')});
   * dataBucket.addEventListener('loadingPage', function() { console.log('the page is reloading')});
   * dataBucket.addEventListener('page', function() { console.log('the current page was updated')});
   */
  list(typeName, options) {
    return new FluroContentListService(typeName, this.core, options)
  }

  /**
   * This function makes it easy to retrieve a large filtered list of content matching certain criteria
   * Only the relevant fields will be returned that allows you to paginate and populate content with the
   * fluro.content.getMultiple() function
   * for more information please see the REST API endpoint documentation here (https://developers.fluro.io/#filter-content)
   * @alias content.filter
   * @param  {String} typeName The type or definition name of the content you want to retrieve
   * @param  {Object} criteria The criteria used to filter the results
   * @return {Promise}         A promise that will be resolved with an array of all results
   * @example
   *
   * // How to sort the results
   * let sort = {
   *     key:'title',
   *     direction:'asc',
   *     type:'string',
   * }
   *
   * // If you want to filter by search keywords
   * let search = 'Any keywords you want to search for'
   *
   * // If you want to crop results to within a certain timeframe
   * let startDate;// = new Date();
   * let endDate;// = new Date()
   *
   * // For more complex AND/OR filtering
   * let filter = {
   *     operator:'and',
   *     filters:[
   *        {
   *           key:'status',
   *           comparator:'in',
   *           values:['active'],
   *        }
   *     ]
   * }
   *
   * let criteria = {
   *   search,
   *   sort,
   *   startDate,
   *   endDate,
   *   filter,
   * }
   *
   * fluro.content.filter('event', criteria)
   * .then(function(results) {
   *       // Returns all results with the basic fields
   * })
   */
  filter(typeName, criteria) {
    return new Promise((resolve, reject) => {
      return this.core.api
        .post(`/content/${typeName}/filter`, criteria)
        .then((res) => {
          return resolve(res.data)
        })
        .catch(reject)
    })
  }

  /**
     * This function makes it easy to retrieve the full content items for a specified selection of ids
     * @alias content.getMultiple
     * @param  {String} typeName The type or definition name of the content you want to retrieve
     * @param  {Array} ids The ids of the content you want to retrieve
     * @param  {Object} options extra options for the request
     * @param  {Array} options.select specify fields you want to retrieve for the items. If blank will return the full object
     * @return {Promise}         A promise that will be resolved with an array of possible keys
     * @example
     *
     * 
     * fluro.content.getMultiple(['5be504eabf33991239599d63', '5be504eabf33721239599d83'])
     .then(function(items) {
     *       // Returns the full content items
     * })
     */
  getMultiple(typeName, ids, options) {
    if (!options) {
      options = {}
    }

    // Ensure the ids are actually ids
    ids = this.core.utils.arrayIDs(ids)
    return new Promise((resolve, reject) => {
      this.core.api
        .post(`/content/${typeName}/multiple`, {
          ids,
          select: options.select ? uniq(options.select) : undefined,
          // populateAll: true,
          limit: ids.length
          // appendContactDetails,
          // appendAssignments,
          // appendFullFamily,
          // cancelToken: currentPageItemsRequest.token,
        })
        .then((res) => {
          resolve(res.data)
        })
        .catch(reject)
    })
  }

  /**
   * This function makes it easy to retrieve all distinct keys for a specified selection of ids
   * @alias content.keys
   * @param  {Array} ids The ids you want to retrieve keys for
   * @param  {Object} options extra options and query parameters for the http request
   * @return {Promise}         A promise that will be resolved with an array of possible keys
   * @example
   *
   *
   * fluro.content.keys(['5be504eabf33991239599d63']).then(function(values) {
   *       // Would return ['firstName', 'lastName', 'title', 'tags', 'realms']
   * })
   */
  keys(ids, options) {
    ids = this.core.utils.arrayIDs(ids)
    if (ids == null || ids.length === 0) {
      throw Error(`No ids specified ${ids}`)
    }
    if (!options) {
      options = {}
    }
    return new Promise((resolve, reject) => {
      const payload = {
        ids
      }

      let url = `/content/distinct/keys`
      if (options.type) {
        url = `/content/${options.type}/distinct/keys`
      }

      // Retrieve the query results
      return this.core.api.post(url, payload, options).then((res) => {
        resolve(res.data)
      }, reject)
    })
  }

  /**
   * This function creates a clean copy of a specified content item
   * @alias content.duplicate
   * @param  {Object} item The ID or object representing the item you want to duplicate
   * @return {Promise}         A promise that will be resolved with a cleaned duplicate of the original item
   * @example
   *
   *
   * fluro.content.duplicate({_id:'5be504eabf33991239599d63'})
   * .then(function(freshItem) {
   *       // Fresh item is a cleaned duplicate of the original item
   * })
   */
  duplicate(item, options) {
    if (!options) {
      options = {}
    }

    const itemID = this.core.utils.getStringID(item)
    return new Promise((resolve, reject) => {
      // Load the proper thing
      this.get(itemID)
        .then((populatedItem: { account }) => {
          const newItem = JSON.parse(JSON.stringify(populatedItem))
          // Remove the bits and pieces
          delete newItem._id
          delete newItem.slug
          delete newItem.author
          delete newItem.managedAuthor
          delete newItem.__v
          delete newItem.created
          delete newItem.updated
          delete newItem.updatedBy
          delete newItem.stats
          delete newItem.privateDetails
          delete newItem._external
          delete newItem.apikey
          if (options.customise) {
            // Keep the definition name
          } else {
            delete newItem.definitionName
          }
          switch (newItem._type) {
            case 'event':
              // Clear out other bits
              newItem.plans = []
              newItem.assignments = []
              break
            case 'mailout':
              newItem.state = 'ready'
              newItem.subject = newItem.title
              newItem.title = newItem.title + ' Copy'
              delete newItem.publishDate
              break
            case 'plan':
              newItem.startDate = null
              break
            case 'persona':
              newItem.user = null
              newItem.collectionEmail = ''
              newItem.username = ''
              newItem.firstName = ''
              newItem.lastName = ''
              break
          }
          // Set the new item as active
          newItem.status = 'active'
          const accountID = this.core.utils.getStringID(newItem.account)
          const userAccountID = this.core.utils.getStringID(
            populatedItem.account
          )
          if (userAccountID !== accountID) {
            newItem.realms = []
          }
          delete newItem.account
          return resolve(newItem)
        })
        .catch(reject)
    })
  }
}
