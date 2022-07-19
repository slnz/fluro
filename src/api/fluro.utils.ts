import axios from 'axios'
import { isBrowser } from 'browser-or-node'
import {
  chain,
  isArray,
  each,
  reduce,
  get,
  first,
  times,
  uniq,
  filter,
  includes
} from 'lodash'
import moment from 'moment'

/**
 * A helpful function that can take a keyed object literal and map it to url query string parameters
 * @alias utils.mapParameters
 * @param  {Object} parameters The object you want to transalte
 * @return {String}            The query string
 * @example
 * // Returns &this=that&hello=world
 * fluro.utils.mapParameters({"this":"that", "hello":"world"})
 */
export function mapParameters(parameters) {
  return chain(parameters)
    .reduce((set, v, k) => {
      if (v === undefined || v === null || v === false) {
        return set
      }
      if (isArray(v)) {
        each(v, (value) => {
          set.push(`${k}=${encodeURIComponent(value)}`)
        })
      } else {
        set.push(encodeURIComponent(k) + '=' + encodeURIComponent(v))
      }
      return set
    }, [])
    .compact()
    .value()
    .join('&')
}
/**
 * A function that will take an integer and a currency string and return a formatted numeric amount rounded to 2 decimal places
 * @alias utils.formatCurrency
 * @param  {Integer} value The amount in cents
 * @param  {String} currency The currency to format
 * @return {String}            The formatted value
 * @example
 *
 * // Returns £10.00
 * fluro.utils.formatCurrency(1000, 'gbp');
 *
 * // Returns $10.00
 * fluro.utils.formatCurrency(1000, 'usd');
 *
 */
export function formatCurrency(value, currency) {
  if (!value || isNaN(value)) {
    value = 0
  }
  const currencyPrefix = FluroUtils.currencySymbol(currency)
  return `${currencyPrefix}${parseFloat(
    (parseInt(value) / 100).toString()
  ).toFixed(2)}`
}
/**
 * A function that will take a currency string and return the symbol
 * @alias utils.currencySymbol
 * @param  {String} currency The currency
 * @return {String}            The symbol
 * @example
 *
 * // Returns £
 * fluro.utils.currencySymbol('gbp');
 *
 * // Returns $
 * fluro.utils.currencySymbol('usd');
 *
 */
export function currencySymbol(currency) {
  // Ensure lowercase currency
  currency = String(currency).toLowerCase()
  switch (String(currency).toLowerCase()) {
    case 'gbp':
      return '£'
      break
    case 'eur':
      return '€'
      break
    default:
      return '$'
      break
  }
}
export function getAvailableCurrencies(defaultCountryCode) {
  let array: {
    name: string
    value: string
    countryCode: { [key: string]: boolean }
  }[] = []
  array.push({
    name: `USD (${FluroUtils.currencySymbol('usd')})`,
    value: 'usd',
    countryCode: { US: true }
  })
  array.push({
    name: `GBP (${FluroUtils.currencySymbol('gbp')})`,
    value: 'gbp',
    countryCode: { GB: true, UK: true }
  })
  array.push({
    name: `CAD (${FluroUtils.currencySymbol('cad')})`,
    value: 'cad',
    countryCode: { CA: true }
  })
  array.push({
    name: `AUD (${FluroUtils.currencySymbol('aud')})`,
    value: 'aud',
    countryCode: { AU: true }
  })
  array.push({
    name: `NZD (${FluroUtils.currencySymbol('nzd')})`,
    value: 'nzd',
    countryCode: { NZ: true }
  })
  array.push({
    name: `SGD (${FluroUtils.currencySymbol('sgd')})`,
    value: 'sgd',
    countryCode: { SG: true }
  })
  if (defaultCountryCode) {
    const findMatch = array.findIndex((currency) => {
      return currency.countryCode[defaultCountryCode]
    })
    const moveArrayItem = (array, fromIndex, toIndex) => {
      const arr = [...array]
      arr.splice(toIndex, 0, ...arr.splice(fromIndex, 1))
      return arr
    }
    if (findMatch !== -1) {
      array = moveArrayItem(array, findMatch, 0)
      console.log('Default currency is', array[0])
    }
  }
  return array
}
/**
 * A helpful function for creating a fast hash object that can be used for more efficient loops
 * @alias utils.hash
 * @param  {Array} array The array to reduce
 * @param  {String} key The key or path to the property to group by
 * @return {Object}            A hash object literal
 * @example
 * // Returns {something:[{title:'test', definition:'something'}]}
 * fluro.utils.mapReduce([{title:'test', definition:'something'}], 'definition');
 *
 */
export function hash(array, key) {
  return reduce(
    array,
    (set, item) => {
      const itemKey = get(item, key)
      set[itemKey] = item
      return set
    },
    {}
  )
}
/**
 * A helpful function that can create a globally unique id
 * @alias utils.guid
 * @return {String}            The new guid
 * @example
 * // Returns 20354d7a-e4fe-47af-8ff6-187bca92f3f9
 * fluro.utils.guid()
 */
export function guid() {
  const u =
    new Date().getTime().toString(16) +
    Math.random().toString(16).substring(2) +
    '0'.repeat(16)
  const guid =
    u.substr(0, 8) +
    '-' +
    u.substr(8, 4) +
    '-4000-8' +
    u.substr(12, 3) +
    '-' +
    u.substr(15, 12)
  return guid
}
/**
 * A helper function to extract a default value from a fluro field definition
 * @alias utils.getDefaultValueForField
 * @return {String|Number|Object}            The default value
 */
export function getDefaultValueForField(field) {
  let blankValue
  const multiple = field.maximum !== 1
  // Check if it's a nested subgroup or embedded form
  const nested =
    (field.type === 'group' && field.asObject) || field.directive === 'embedded'

  if (multiple) {
    blankValue = []
  }

  switch (field.type) {
    case 'reference':
      if (field.defaultReferences && field.defaultReferences.length) {
        if (multiple) {
          blankValue = blankValue.concat(field.defaultReferences)
        } else {
          blankValue = first(field.defaultReferences)
        }
      }
      break
    default:
      if (field.defaultValues && field.defaultValues.length) {
        if (multiple) {
          blankValue = blankValue.concat(field.defaultValues)
        } else {
          blankValue = first(field.defaultValues)
        }
      }
      break
  }

  if (multiple) {
    const askCount = Math.max(field.askCount, field.minimum)
    const additionalRequired = Math.max(askCount - blankValue.length, 0)
    // If we need some entries by default
    if (additionalRequired) {
      switch (field.type) {
        // case 'string':
        //     times(additionalRequired, function() {
        //         blankValue.push('');
        //     })
        //     break;
        default:
          switch (field.directive) {
            case 'wysiwyg':
            case 'textarea':
            case 'code':
              times(additionalRequired, () => {
                blankValue.push('')
              })
              break
            default:
              // We need to add objects
              if (nested) {
                times(additionalRequired, () => {
                  blankValue.push({})
                })
              }
              break
          }
          break
      }
    }
  } else {
    if (!blankValue) {
      switch (field.type) {
        case 'string':
          blankValue = ''
          break
        default:
          switch (field.directive) {
            case 'wysiwyg':
            case 'textarea':
            case 'code':
              // case 'select':
              blankValue = ''
              break
            default:
              // We need to add objects
              if (nested) {
                blankValue = {}
              }
              //  else {
              //     blankValue =  null;
              // }
              break
          }
          break
      }
    }
  }

  return blankValue
}
/**
 * A helpful function that can return a subset of an array compared to specified criteria, This is usually used
 * to evaluate expressions on Fluro forms
 * @alias utils.extractFromArray
 * @param  {Array} array The array you want to filter
 * @param  {String} path The path to the property you want to compare on each item in the array
 * @param  {Boolean} sum Whether to sum the resulting values together as a number
 * @param  {Boolean} flatten Whether to flatten nested arrays
 * @param  {Boolean} unique Whether to only return unique values
 * @param  {Boolean} exclude Whether to exclude null or undefined values
 * @param  {Object} options Pass through extra options for how to extract the values
 * @return {Array}           An array of all values retrieved from the array, unless options specifies otherwise
 * @example
 * // Returns [26, 19] as all the values
 * fluro.utils.extractFromArray([{name:'Jerry', age:26}, {name:'Susan', age:19}], 'age');
 *
 * // Returns 45
 * fluro.utils.extractFromArray([{name:'Jerry', age:26}, {name:'Susan', age:19}], 'age', {sum:true});
 *
 */
export function extractFromArray(
  array,
  key,
  sum,
  flatten,
  unique,
  exclude,
  options
) {
  if (!options) {
    options = {}
  }
  if (sum) {
    options.sum = sum
  }
  if (flatten) {
    options.flatten = true
  }
  if (unique) {
    options.unique = true
  }
  if (exclude) {
    options.excludeNull = true
  }
  // Filter the array options by a certain value and operator
  let matches = reduce(
    array,
    (set, entry) => {
      // Get the value from the object
      const retrievedValue = get(entry, key)
      const isNull =
        !retrievedValue && retrievedValue !== false && retrievedValue !== 0
      if (options.excludeNull && isNull) {
        return set
      }
      set.push(retrievedValue)
      return set
    },
    []
  )
  if (options.flatten) {
    matches = flatten(matches)
  }
  if (options.unique) {
    matches = uniq(matches)
  }
  if (options.sum) {
    matches = matches.reduce((a, b) => {
      return a + b
    }, 0)
  }
  return matches
}
/**
 * A helpful function that can return a subset of an array compared to specified criteria, This is usually used
 * to evaluate expressions on Fluro forms
 * @alias utils.matchInArray
 * @param  {Array} array The array you want to filter
 * @param  {String} path The path to the property you want to compare on each item in the array
 * @param  {String} value The value to compare with
 * @param  {String} operator Can be Possible options are ('>', '<', '>=', '<=', 'in', '==') Defaults to '==' (Is equal to)
 * @return {Array}           An array that contains all items that matched
 * @example
 * // Returns [{name:'Jerry', age:26}] as that is only item in the array that matches the criteria
 * fluro.utils.matchInArray([{name:'Jerry', age:26}, {name:'Susan', age:19}], 'age', 26, '>=');
 *
 */
export function matchInArray(array, key, value, operator) {
  // Filter the array options by a certain value and operator
  const matches = filter(array, (entry) => {
    // Get the value from the object
    const retrievedValue = get(entry, key)
    let isMatch
    // Check how to operate
    switch (operator) {
      case '>':
        isMatch = retrievedValue > value
        break
      case '<':
        isMatch = retrievedValue < value
        break
      case '>=':
        isMatch = retrievedValue >= value
        break
      case '<=':
        isMatch = retrievedValue <= value
        break
      case 'in':
        isMatch = includes(retrievedValue, value)
        break
      default:
        // operator is strict equals
        if (value === undefined) {
          isMatch = retrievedValue
        } else {
          isMatch = retrievedValue === value
        }
        break
    }
    return isMatch
  })
  return matches
}
/**
 * A helpful class that can take an array of values and return them as a comma seperated
 * string, If the values are objects, then a property to use as the string representation can be specified
 * @alias utils.comma
 * @param  {Array} array The array of values to translate
 * @param  {String} path  An optional property key to use for each value
 * @return {String}       The resulting comma seperated string
 * @example
 * // Returns 'cat, dog, bird'
 * fluro.utils.comma(['cat', 'dog', 'bird']);
 *
 * // Returns 'cat, dog, bird'
 * fluro.utils.comma([{title:'cat'}, {title:'dog'}, {title:'bird'}], 'title');
 */
export function comma(array, path, limit) {
  if (limit) {
    array = array.slice(0, limit)
  }
  return chain(array)
    .compact()
    .map((item) => {
      if (path && path.length) {
        return get(item, path)
      }
      return item
    })
    .value()
    .join(', ')
}
// Helper function to get an id of an object
/**
 * Returns a specified _id for an object
 * @alias utils.getStringID
 * @param  {Object} input      An object that is or has an _id property
 * @param  {Boolean} asObjectID Whether to convert to a Mongo ObjectId
 * @return {String}            Will return either a string or a Mongo ObjectId
 *
 * @example
 *
 * // Returns '5cb3d8b3a2219970e6f86927'
 * fluro.utils.getStringID('5cb3d8b3a2219970e6f86927')
 *
 * // Returns true
 * typeof FluroUtils.getStringID({_id:'5cb3d8b3a2219970e6f86927', title, ...}) === 'string';
 * // Returns true
 * typeof FluroUtils.getStringID({_id:'5cb3d8b3a2219970e6f86927'}, true) === 'object';
 */
export function getStringID(input, asObjectID?) {
  if (!input) {
    return input
  }

  let output
  if (input._id) {
    output = String(input._id)
  } else {
    output = String(input)
  }
  if (!asObjectID || isBrowser) {
    return output
  }
  return output
  // // Load mongoose if we can
  // try {
  //     let mongoose = require('mongoose');
  // } catch(e) {
  //     console.log('ERROR', e);
  //     return output;
  // }
  //   // let ObjectId = mongoose.Types.ObjectId;
  // let isValid = ObjectId.isValid(String(output));
  // if (!isValid) {
  //     return;
  // }
  // return new ObjectId(output);
}
// distance(point1, point2, unit) {
//                 let lat1 = point1.lat;
//                 let lon1 = point1.lon;
//                 let lat2 = point2.lat;
//                 let lon2 = point2.lon;
//                 if ((lat1 === lat2) && (lon1 === lon2)) {
//                     return 0;
//                 } else {
//                     let radlat1 = Math.PI * lat1 / 180;
//                     let radlat2 = Math.PI * lat2 / 180;
//                     let theta = lon1 - lon2;
//                     let radtheta = Math.PI * theta / 180;
//                     let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
//                     if (dist > 1) {
//                         dist = 1;
//                     }
//                     dist = Math.acos(dist);
//                     dist = dist * 180 / Math.PI;
//                     dist = dist * 60 * 1.1515;
//                     if (unit === "K") { dist = dist * 1.609344 }
//                     if (unit === "N") { dist = dist * 0.8684 }
//                     return dist;
//                 }
//             }
/**
 * Cleans and maps an array of objects to an array of IDs
 * @alias utils.arrayIDs
 * @param  {Array} array      An array of objects or object ids
 * @param  {Boolean} asObjectID Whether or not to map the ids as Mongo ObjectIds
 * @return {Array}            An array of Ids
 *
 * @example
 * // Returns ['5cb3d8b3a2219970e6f86927', '5cb3d8b3a2219970e6f86927', '5cb3d8b3a2219970e6f86927']
 * fluro.utils.arrayIDs([{_id:'5cb3d8b3a2219970e6f86927'}, {_id:'5cb3d8b3a2219970e6f86927'}, null, '5cb3d8b3a2219970e6f86927'])
 */
export function arrayIDs(array, asObjectID?): string[] {
  if (!array) {
    return []
  }
  return chain(array)
    .compact()
    .map((input) => {
      return FluroUtils.getStringID(input, asObjectID)
    })
    .compact()
    .uniq()
    .value()
}
/**
 * Helper function for retrieving a human readable error message from server error response objects
 * @alias utils.errorMessage
 * @param  {Object} error The error object to translate
 * @return {String}     The resulting human readable error message
 */
export function errorMessage(err) {
  if (isArray(err)) {
    err = first(err)
  }

  const candidates = ['response.data.message', 'response.data', 'message']

  let message = chain(candidates)
    .map((path) => {
      return get(err, path)
    })
    .compact()
    .first()
    .value()

  if (Array.isArray(message)) {
    message = message[0]
  }

  if (!message || !message.length) {
    return String(err)
  }

  return message
}
/**
 * Helper function for sorting process cards by priority
 * @alias utils.processCardPrioritySort
 * @param  {Object} card The process card to sort
 * @return {Integer}     An integer representing it's sorting priority
 */
export function processCardPrioritySort(card) {
  let num = '2'
  let trailer = 0
  let val

  // If we are archived then add straight to the bottom of the list
  if (card.status === 'archived') {
    num = '4'
    val = parseFloat(num + '.' + trailer)
    return val + '-' + card.title
  }

  // If we are complete then add us to the bottom of the list
  if (card.processStatus === 'complete') {
    num = '3'
    val = parseFloat(num + '.' + trailer)
    return val + '-' + card.title
  }

  if (card.dueDate) {
    const dueMoment = moment(card.dueDate)
    const dueDate = dueMoment.toDate()
    const nowMoment = moment()
    const now = nowMoment.toDate()
    const duetime = dueDate.getTime()
    trailer = dueDate.getTime()
    if (duetime < now.getTime()) {
      // If it's overdue then we add it to the very very top
      num = '0'
    } else {
      // Otherwise just add it to the top of the
      // pending cards
      num = '1'
    }
  }

  val = parseFloat(num + '.' + trailer)
  return val + '-' + card.title
}
/**
 * Helper function for cleaning strings to use as database ids
 * @alias utils.machineName
 * @param  {String} string The string to clean eg. (Awesome Event!)
 * @return {String}     A cleaned and formatted string eg. (awesomeEvent)
 */
export function machineName(string) {
  if (!string || !string.length) {
    return
  }
  const regexp = /[^a-zA-Z0-9-_]+/g
  return string.replace(regexp, '')
}
export function hhmmss(secs) {
  function pad(str) {
    return ('0' + str).slice(-2)
  }
  let minutes = Math.floor(secs / 60)
  secs = secs % 60
  const hours = Math.floor(minutes / 60)
  minutes = minutes % 60
  return pad(hours) + ':' + pad(minutes) + ':' + pad(secs)
}
const injectedScripts = {}
/**
 * Helper function for including external javascript resources
 * This ensures that scripts are only included a single time on each page
 * @alias utils.injectScript
 * @param  {String} url The URL of the script to import
 * @return {Promise}     A promise that resolves once the script has been included on the page
 */
export function injectScript(scriptURL) {
  return new Promise((resolve, reject) => {
    if (!document) {
      return reject(
        new Error(
          'Script injection can only be used when running in a browser context'
        )
      )
    }
    if (injectedScripts[scriptURL]) {
      return resolve(scriptURL)
    }
    // Keep note so we don't inject twice
    injectedScripts[scriptURL] = true
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true
    script.onload = () => {
      console.log('Included external script', scriptURL)
      return resolve(scriptURL)
    }
    script.src = scriptURL
    document.getElementsByTagName('head')[0].appendChild(script)
  })
}
/**
 * Helper function for including external javascript resources
 * This ensures that scripts are only included a single time on each page
 * @alias utils.injectModule
 * @param  {String} url The URL of the script to import
 * @return {Promise}     A promise that resolves once the script has been included on the page
 */
const inflightPromises = {}
export function injectModule(scriptURL, options) {
  if (!options) {
    options = {}
  }

  if (!document) {
    return Promise.reject(
      new Error(
        'Script injection can only be used when running in a browser context'
      )
    )
  }

  // If we aren't requesting a cache clear
  if (!options.clearCache) {
    // If there is an inflight promise
    if (inflightPromises[scriptURL]) {
      return inflightPromises[scriptURL]
    }
  }

  const promise = new Promise((resolve) => {
    axios.get(scriptURL).then((res) => {
      const source = res.data
      const script = `"use strict"; let object = {}; try {object = ${source}} catch(e) {console.log(e)} finally {return object}`
      const compiled = Function(script)() // eslint-disable-line no-new-func
      return resolve(compiled)
    })
  })

  // Cache for multiple requests
  inflightPromises[scriptURL] = promise
  return promise
}
/**
 * Helper function for getting a flattened list of all nested fields
 * defined for a definition in Fluro
 * @alias utils.getFlattenedFields
 * @param  {Array} fields The array of fields
 * @param  {Array} trail An array to append trails to (required)
 * @param  {Array} trail An array to append titles to (required)
 * @return {Array}     A flattened list of all fields with their nested trails and titles
 */
export function getFlattenedFields(array, trail, titles) {
  if (!trail) {
    trail = []
  }
  if (!titles) {
    titles = []
  }
  return chain(array)
    .map((inputField) => {
      // Create a new object so we don't mutate
      const field = Object.assign({}, inputField)
      const returnValue = []
      // If there are sub fields
      if (field.fields && field.fields.length) {
        if (field.asObject || field.directive === 'embedded') {
          // Push the field itself
          trail.push(field.key)
          titles.push(field.title)
          field.trail = trail.slice()
          field.titles = titles.slice()
          trail.pop()
          titles.pop()
          returnValue.push(field)

          // Prepend the key to all lowed fields
          const isArrayType =
            field.maximum !== 1 || (field.minimum !== 1 && field.asObject)
          if (isArrayType) {
            // if (field.maximum !== 1) {
            // trail.push(field.key + '[' + indexIterator + ']');
            trail.push(field.key + '[]')
            titles.push(field.title)
          } else {
            trail.push(field.key)
            titles.push(field.title)
          }
        }
        const fields = FluroUtils.getFlattenedFields(
          field.fields,
          trail,
          titles
        )
        if (field.asObject || field.directive === 'embedded') {
          trail.pop()
          titles.pop()
        }
        returnValue.push(fields)
      } else {
        // Push the field key
        trail.push(field.key)
        titles.push(field.title)
        field.trail = trail.slice()
        field.titles = titles.slice()
        trail.pop()
        titles.pop()
        returnValue.push(field)
      }
      return returnValue
    })
    .flattenDeep()
    .value()
}

/**
 * @classdesc A static service that provides useful helper functions and tools for other Fluro services
 * @alias utils
 * @class
 * @hideconstructor
 */
const FluroUtils = {
  mapParameters,
  formatCurrency,
  currencySymbol,
  getAvailableCurrencies,
  hash,
  guid,
  getDefaultValueForField,
  extractFromArray,
  matchInArray,
  comma,
  getStringID,
  arrayIDs,
  errorMessage,
  processCardPrioritySort,
  machineName,
  hhmmss,
  injectScript,
  injectModule,
  getFlattenedFields
}

export default FluroUtils
