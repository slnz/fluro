import { chain, each, includes, startCase, map, orderBy } from 'lodash'
/**
 * Creates a new FluroTypes service
 * This module provides a number of helpful functions for retrieving, translating and understanding types, schemas and definitions
 * that are defined within Fluro
 * @alias types
 * @constructor
 * @hideconstructor
 * @param {this.FluroCore} fluro A reference to the parent instance of the this.FluroCore module. This module is usually created by a this.FluroCore instance that passes itself in as the first argument.
 */
export default class FluroTypes {
  glossary = {}
  inflightTermsRequest

  constructor(private FluroCore) {}

  icon(type, library) {
    if (!library) {
      library = 'far'
    }
    let icon
    switch (type) {
      case 'academic':
        icon = 'school'
        break
      case 'statsheet':
        icon = 'calculator-alt'
        break
      case 'simpleemail':
        icon = 'envelope'
        break
      case 'smscorrespondence':
        icon = 'mobile-alt'
        break
      case 'deployment':
        icon = 'cloud-upload'
        break
      case 'roster':
        icon = 'clipboard-user'
        break
      case 'package':
        icon = 'box-open'
        break
      case 'method':
        icon = 'credit-card-front'
        break
      case 'resultset':
        icon = 'poll-people'
        break
      case 'timetrigger':
        icon = 'clock'
        break
      case 'user':
        icon = 'user'
        break
      case 'policy':
        icon = 'id-card'
        break
      case 'account':
        icon = 'browser'
        break
      case 'application':
        icon = 'layer-group'
        break
      case 'article':
        icon = 'file-alt'
        break
      case 'asset':
        icon = 'file-archive'
        break
      case 'audio':
        icon = 'file-audio'
        break
      case 'checkin':
        icon = 'sign-in'
        break
      case 'capability':
        icon = 'star'
        break
      case 'code':
        icon = 'code'
        break
      case 'collection':
        // icon = 'box-full';
        icon = 'folder'
        break
      case 'component':
        icon = 'tachometer-alt'
        break
      case 'log':
        icon = 'history'
        break
      case 'contact':
        icon = 'child'
        break
      case 'definition':
        icon = 'books-medical'
        break
      case 'contactdetail':
        icon = 'file-invoice'
        break
      case 'eventtrack':
        icon = 'random'
        break
      case 'event':
        icon = 'calendar-star'
        break
      case 'family':
        icon = 'home'
        break
      case 'team':
        icon = 'users'
        break
      case 'attendance':
        // icon = 'calendar-check';
        icon = 'calculator'
        break
      case 'image':
        icon = 'image'
        break
      case 'conversation':
        icon = 'comments-alt'
        break
      case 'integration':
        icon = 'plug'
        break
      case 'interaction':
        icon = 'compress'
        break
      case 'location':
        icon = 'map-marked-alt'
        break
      case 'mailout':
        icon = 'paper-plane'
        break
      case 'plan':
        icon = 'clipboard-list'
        break
      case 'post':
        icon = 'comment-alt-lines'
        break
      case 'process':
        icon = 'exchange'
        break
      case 'product':
        icon = 'shopping-cart'
        break
      case 'purchase':
        icon = 'file-invoice-dollar'
        break
      case 'query':
        icon = 'terminal'
        break
      case 'reaction':
        icon = 'bolt'
        break
      case 'realm':
        icon = 'bullseye'
        break
      case 'role':
        icon = 'user-lock'
        break
      case 'site':
      case 'sitemodel':
        icon = 'sitemap'
        break
      case 'tag':
        icon = 'tag'
        break
      case 'ticket':
        icon = 'ticket-alt'
        break
      case 'transaction':
        icon = 'usd-square'
        break
      case 'persona':
        icon = 'user'
        break
      case 'assignment':
        icon = 'user-clock'
        break
      case 'video':
        icon = 'video'
        break
      case 'form':
        icon = 'file-signature'
        break
    }
    if (icon) {
      return [library, icon]
    }
  }

  /**
   * Retrieves a specified definition or primitive type object
   * @alias types.get
   * @param  {string} definedName The definition or type name you want to retrieve
   * @param  {object} options extra options for the request
   * @return {promise}       An promise that will resolve to the type definition from Fluro
   */
  get(definedName, options) {
    if (!options) {
      options = {
        // flat:true
      }
    }

    return new Promise((resolve, reject) => {
      this.FluroCore.api
        .get(`/defined/type/${definedName}`, options)
        .then((res) => {
          resolve(res.data)
        }, reject)
    })
  }

  /**
   * A helpful function for mapping an array of items into a grouped array broken up by definition
   * @alias types.mapDefinitionItems
   * @param  {Array} array An array of content items
   * @param  {String} baseType The default base type to map, eg. 'tag', 'contact', 'event'
   * @return {Array}            A mapped array broken up by definition
   * @example
   * // Returns {something:[{title:'Demographic', plural:'Demographics',  key:'demographic', entries:[{...},{...}]}]}
   * fluro.types.mapDefinitionItems([{title:'test', definition:'demographic'}], 'tag');
   *
   */
  mapDefinitionItems(array, backup) {
    if (!array || !array.length) {
      return []
    }

    return (
      chain(array)
        // .orderBy(function(item) {
        //     return String(item.title).toLowerCase()
        // })
        .reduce((set, entry) => {
          const key = entry.definition || backup
          let existing = set[key]
          if (!existing) {
            existing = set[key] = {
              title: this.readable(key, false),
              plural: this.readable(key, true),
              key,
              entries: []
            }
          }
          existing.entries.push(entry)
          return set
        }, {})
        .values()
        .orderBy((type) => {
          return type.key === backup
        })
        .value()
    )
  }

  /**
   * Retrieves all definitions available in the current account. Useful for making one request and caching
   * @alias types.all
   * @param  {object} options extra options for the request
   * @return {promise}       An promise that will resolve to the array of definitions
   */
  all(options) {
    if (!options) {
      options = {
        // flat:true
      }
    }

    return new Promise((resolve, reject) => {
      return this.FluroCore.api.get(`/defined`, options).then((res) => {
        resolve(res.data)
      }, reject)
    })
  }

  /**
   * Retrieves all definitions available in the current account. Useful for making one request and caching
   * @alias types.terms
   * @param  {object} options extra options for the request
   * @return {promise}       An promise that will resolve to the array of definitions and their names
   */

  terms(options) {
    if (!options) {
      options = {}
    }

    if (this.inflightTermsRequest && !options.forceRefresh) {
      return this.inflightTermsRequest
    }

    this.inflightTermsRequest = new Promise((resolve, reject) => {
      if (!options) {
        options = {
          cache: false
          // flat:true
        }
      }

      options.cache = false

      this.glossary = {}
      return this.FluroCore.api.get(`/defined/terms`, options).then((res) => {
        each(res.data, (entry, key) => {
          entry.definitionName = key
        })

        this.glossary = res.data
        return resolve(res.data)
      }, reject)
    })

    return this.inflightTermsRequest
  }

  /**
   * Retrieves a glossary of glossary for readable definition titles and plurals
   * @alias types.reloadTerminology
   * @return {promise}       An promise that will resolve to the matching basic types or reject with the responding error
   */

  reloadTerminology(options) {
    if (!options) {
      options = {
        forceRefresh: true
      }
    }
    return this.terms(options)
  }

  BASIC_TYPES = [
    'asset',
    'checkin',
    'image',
    'audio',
    'video',
    'account',
    'persona',
    'application',
    'deployment',
    'article',
    'assignment',
    'post',
    'resultset',
    'timetrigger',
    'onboard',
    'code',
    'component',
    'collection',
    'family',
    'contact',
    'method',
    'contactdetail',
    'personadetail',
    'task',
    'definition',
    'endpoint',
    'event',
    'view',
    'process',
    'eventtrack',
    'log',
    'integration',
    'interaction',
    'location',
    'package',
    'product',
    'purchase',
    'query',
    'realm',
    'role',
    'site',
    'tag',
    'team',
    'roster',
    'capability',
    'plan',
    'transaction',
    'reaction',
    'user',
    'policy',
    'mailout',
    'ticket',
    'academic',
    'attendance'
  ]

  isBasicType(typeName) {
    return includes(this.BASIC_TYPES, typeName)
  }

  /**
   * Input a definition name or basic type and receive the human readable version of that type
   * @alias types.readable
   * @param  {String} definitionName The definition or _type
   * @param  {Boolean} plural Whether to return it's plural version
   * @return {String}  Eg. 'Audio', 'Detail Sheet', or 'Events'...
   */
  readable(definitionName, plural) {
    if (definitionName === 'node') {
      return plural ? 'Items' : 'Item'
    }

    let readable = definitionName
    const match = this.glossary ? this.glossary[readable] : null
    if (match) {
      readable = plural ? match.plural : match.title
    } else {
      readable = plural ? startCase(readable) + 's' : startCase(readable)
    }
    return readable
  }

  /**
   * Input a definition name or basic type and receive the basic details about that definition
   * @alias types.term
   * @param  {String} definitionName The definition or _type
   * @return {Object}  The details about this definition as defined in the glossary
   */
  term(definitionName) {
    return this.glossary ? this.glossary[definitionName] : null
  }

  /**
   * Input a definition name or basic type and receive the most basic _type of that definition
   * @alias types.parentType
   * @param  {String} definitionName The definition or _type
   * @return {String}  Eg. 'photo', 'this., or 'song'...
   */
  parentType(definitionName) {
    const match = this.glossary ? this.glossary[definitionName] : null
    if (match) {
      definitionName = match.parentType || definitionName
    }
    return definitionName
  }

  /**
   * Retrieve an array of all basic types
   * @alias types.basicTypes
   * @return {Array}  eg. 'this., 'concert', 'conference'
   */
  basicTypes() {
    const values = map(this.BASIC_TYPES, (typeName) => {
      return this.glossary[typeName]
    })
    return Promise.resolve(values)
  }

  /**
   * Input a definition name or basic type and receive the most basic _type of that definition
   * @alias types.subTypes
   * @param  {String} definitionName The basic _type
   * @param  {Boolean} includeBasicType Whether to include the basic type definition in the results
   * @return {Array}  eg. 'this., 'concert', 'conference'
   */
  subTypes(typeName, includeBasicType) {
    const definitions = chain(this.glossary)
      .reduce((set, term, key) => {
        if (term.status === 'archived') {
          return set
        }
        term.definitionName = key
        if (term.parentType === typeName) {
          set.push(term)
        }
        return set
      }, [])
      .orderBy((definition) => {
        return definition.title
      })
      .value()

    if (includeBasicType) {
      const basicTypeMatch = this.glossary[typeName]
      if (basicTypeMatch) {
        definitions.unshift(basicTypeMatch)
      }
    }

    return Promise.resolve(definitions)
    // let match = this.glossary ? this.glossary[definitionName] : null;
    // if (match) {
    //     definitionName = match.parentType || definitionName;
    // }
    // return definitionName;
  }

  /**
     * Input a definition name or basic type and receive the most basic _type of that definition
     * @alias types.postableTypes
     * @param  {String} definitionName The definition or _type
     * @param  {Object} options Extra options
     * @return {Array} an array of definitions that can be posted
     *
    /**
    this.postableTypes = function(typeName, options) {
        if(!options) {
            options = {
                list: true,
                strict: true,
            }
        }
        return new Promise(function(resolve, reject) {
            this.FluroCore.api.post('/defined', options)
                .then(function(res) {
                                        resolve(res.data);
                }, reject);
        });
        // FluroContent.endpoint('post/types/' + type, true, true)
        //     .query(options)
        //     .$promise.then(function(res) {
        //         let filtered = filter(res, function(definition) {
        //             let definitionName = definition.definitionName;
        //             let canView = FluroAccess.can('view', definitionName, 'post');
        //             let canCreate = FluroAccess.can('create', definitionName, 'post');
        //             let canSubmit = FluroAccess.can('submit', definitionName, 'post');
        //                     //             return (canCreate || canSubmit);
        //         });
        //         return deferred.resolve(filtered);
        //     }, deferred.reject);
        // let match = this.glossary ? this.glossary[definitionName] : null;
        // if (match) {
        //     definitionName = match.parentType || definitionName;
        // }
         
        // return definitionName;
    }
    /**/

  /**
   * Input a definition name or basic type and receive the most basic _type of that definition
   * @alias types.postableTypes
   * @param  {String} definitionName The definition or _type
   * @param  {Object} options Extra options
   * @return {Array} an array of definitions that can be posted
   *
   */
  processTypes(typeName, options) {
    if (!options) {
      options = {
        list: true,
        strict: false
      }
    }
    return new Promise((resolve, reject) => {
      console.log('GET THE PROCESS TYPES')
      // return resolve([]);

      this.FluroCore.api
        .get(`/process/types/${typeName}`, {
          params: options
        })
        .then((res) => {
          // let filtered = filter(res, function(definition) {
          //     let definitionName = definition.definitionName;
          //     let canView = FluroAccess.can('view', definitionName, 'process');
          //     let canCreate = FluroAccess.can('create', definitionName, 'process');
          //     return (canView || canCreate);
          // });
          const ordered = orderBy(res.data, (definition) => definition.title)
          resolve(ordered)
        }, reject)
    })
  }

  // /**
  //  * Input definition names or basic types and receive a list of all
  //  * posts that can be attached to that type of content
  //  * @alias types.postTypes
  //  * @param  {Array} definitionNames The definitions or _types to check
  //  * @param  {Object} options Extra options
  //  * @return {Array} an array of definitions that can be posted
  //  *
  //  */
  // this.postTypes = function(typeName, options) {
  //     if (!options) {
  //         options = {
  //             list: true,
  //             strict: true,
  //         }
  //     }
  //     return new Promise(function(resolve, reject) {
  //         this.FluroCore.api.get(`/post/types/${typeName}`, {
  //                 params: options
  //             })
  //             .then(function(res) {
  //                 resolve(res.data);
  //             }, reject);
  //     });
  // }

  /**
   * Retrieves a list of specified types and their respective definitions
   * @alias types.retrieve
   * @param  {array} types The names of the basic types you want to retrieve
   * @return {promise}       An promise that will resolve to the matching basic types or reject with the responding error
   */
  retrieve(types, options) {
    if (!options) {
      options = {
        // flat:true
      }
    }
    options.types = types

    return new Promise((resolve, reject) => {
      this.FluroCore.api.post('/defined', options).then((res) => {
        resolve(res.data)
      }, reject)
    })
  }
  // /
  //   // Get all sub definitions for an array of primitive types
  // this.subDefinitions = function(primitiveTypes, options) {
  //     if (!options) {
  //         options = {
  //             // flat:true
  //         }
  //     }
  //     let definitionCache = fluro.cache.get('subDefinitions');
  //     //     let promises = map(primitiveTypes, function(type) {
  //         if(definitionCache[type]) {
  //             return Promise.resolve(definitionCache[type]);
  //         }
  //         return new Promise(function(resolve, reject) {
  //              this.FluroCore.api.get(`/defined/types/${type}`)
  //             .then(function(res) {
  //                 definitionCache[type] = res.data;
  //                 resolve(definitionCache[type]);
  //             }, reject);
  //         });
  //     })
  //     return Promise.all(promises);
  // }
}
