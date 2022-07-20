import strtotime from 'locutus/php/datetime/strtotime'
import {
  each,
  chain,
  some,
  isObject,
  isArray,
  flatten,
  includes,
  isString,
  every,
  startsWith,
  endsWith,
  get,
  isDate,
  reduce,
  values
} from 'lodash'
import moment from 'moment-timezone'
import { compareTwoStrings } from 'string-similarity'

import { getFlattenedFields } from '../api/fluro.utils'

let verboseDEBUG

export function activeFilters(config) {
  const memo = []
  getActiveFilter(config, memo)

  return memo

  function getActiveFilter(block, memo) {
    const isValid = isValidFilter(block)
    if (isValid) {
      memo.push(block)
    }

    if (block.filters && block.filters.length) {
      each(block.filters, (b) => {
        getActiveFilter(b, memo)
      })
    }
  }
}

function isNotANumber(input) {
  return isNaN(parseInt(input))
}

export function activeFilterRows() {
  return filter(activeFilters, (row) => {
    return row.comparator && row.comparator.length
  })
}

export function activeFilterKeys(config) {
  const keys = chain(activeFilters(config))
    .map(function (entry) {
      if (!entry || !entry.key) {
        return undefined
      }

      const rootKey = getRootKey(entry.key)
      // //console.log('ROOT KEY', rootKey);
      return rootKey
    })
    .compact()
    .uniq()
    .value()

  return keys
}

export function activeFilterCriteriaString(config) {
  const criteriaValue = chain(activeFilters(config))
    .map(function (block) {
      if (!block.criteria || !block.criteria.length) {
        return undefined
      }

      const activeCriteria = activeFilters({ filters: block.criteria })

      if (!activeCriteria || !activeCriteria.length) {
        return undefined
      }

      return getFilterChangeString({ filters: activeCriteria })
    })
    .flatten()
    .compact()
    .map(function (value) {
      const nameTitle = value.title || value.name || value._id || value
      return String(nameTitle).toLowerCase()
    })
    .compact()
    .uniq()
    .value()

  // if (criteriaValue && criteriaValue.length) {

  // }

  return criteriaValue
}

export function activeFilterValues(config) {
  const values = chain(activeFilters(config))
    .map(function (block) {
      let all = []
      const comparator = getComparator(block.comparator)
      if (!comparator) {
        return undefined
      }

      let blockValue1, blockValue2

      switch (comparator.inputType) {
        case 'array':
          all = all.concat(block.values)
          break
        case 'range':
        case 'daterange':
          all = all.concat([block.value, block.value2])
          break
        default:
          blockValue1 = block.value
          blockValue2 = block.value2

          if (block.dataType === 'boolean') {
            blockValue1 = String(convertToBoolean(blockValue1))
            blockValue2 = String(convertToBoolean(blockValue2))
          }

          all = all.concat([blockValue1, blockValue2])
          break
      }

      return all
    })
    .flatten()
    .compact()
    .map(function (value) {
      const nameTitle = value.title || value.name || value._id || value
      return String(nameTitle).toLowerCase()
    })
    .compact()
    .uniq()
    .value()

  return values
}

export function activeFilterComparators(config) {
  const memo = []
  getActiveFilterComparator(config, memo)
  return memo

  function getActiveFilterComparator(block, memo) {
    const isValid = isValidFilter(block)
    if (isValid) {
      memo.push(block.comparator)
    }

    if (block.filters && block.filters.length) {
      each(block.filters, (b) => {
        getActiveFilterComparator(b, memo)
      })
    }
  }
}

export function activeFilterOperators(config) {
  const memo = []
  const trail = []

  getActiveFilterBlockOperator(config, memo, trail)

  const flat = chain(memo)
    .flatten()
    .reduce(function (set, operator) {
      if (!set[operator]) {
        set[operator] = 0
      }

      set[operator]++

      return set
    }, {})
    .map(function (i, key) {
      return `${i}${key}`
    })
    .compact()
    .value()

  return flat

  function getActiveFilterBlockOperator(block, memo, trail) {
    const operator = block.operator

    // If it's a rule set
    if (operator) {
      // //Add the path to the block
      trail.push(operator)

      // Check if any of it's filters are valid and active
      const isValid = some(block.filters, (filter) => {
        return isValidFilter(filter)
      })

      if (isValid) {
        memo.push(trail.slice())
      }
    } else {
      trail.length = 0
    }

    // Go down the tree further
    if (block.filters && block.filters.length) {
      each(block.filters, (b) => {
        getActiveFilterBlockOperator(b, memo, trail)
      })
    } else {
      trail.length = 0
    }
  }
}

export function getFilterChangeString(config) {
  // Put all this together so we only refilter when we actually need to
  // each of these will only return if the filter is valid and actually changes
  // effects the results, without this step the table will update everytime you change the filters
  const string = [
    activeFilterKeys(config).join(', '),
    activeFilterValues(config).join(', '),
    activeFilterComparators(config).join(', '),
    activeFilterOperators(config).join(', '),
    activeFilterCriteriaString(config).join(', ')
  ].join('')

  return string
}

// Helper function to map an input to a basic string
function getString(input, includeIDs?) {
  if (!input) {
    return ''
  }

  if (includeIDs) {
    if (input._id) {
      return String(input._id).toLowerCase()
    }

    if (input._external) {
      return String(input._external).toLowerCase()
    }

    if (input.id) {
      return String(input.id).toLowerCase()
    }
  }

  if (input.title) {
    return String(input.title).toLowerCase()
  }

  if (input.name) {
    return String(input.name).toLowerCase()
  }

  return String(input).toLowerCase()
}

function getAllStringMatches(input, includeIDs) {
  const matches = []
  if (!input) {
    return matches
  }

  // If it's text or a number
  if (!isObject(input)) {
    return [getString(input, includeIDs)]
  }

  // If it's an array
  if (isArray(input)) {
    return flatten(getAllStringMatches(input, includeIDs))
  }

  // Otherwise it's likely an object
  matches.push(getString(input, includeIDs))

  if (matches.length === 1) {
    return matches[0]
  }

  // if (includeIDs) {

  //     if (input._id && input._id.length) {
  //         matches.push(String(input._id).toLowerCase());
  //     }

  //     if (input._external && input._external.length) {
  //         matches.push(String(input._external).toLowerCase());
  //     }
  // }

  // if (input.title && input.title.length) {
  //     matches.push(String(input.title).toLowerCase());
  // }

  // if (input.name && input.name.length) {
  //     matches.push(String(input.name).toLowerCase());
  // }

  return matches
}

function isBetween(input, from, to) {
  const startFloat = parseFloat(from)
  const endFloat = parseFloat(to)
  const checkFloat = parseFloat(input || 0)

  const start = Math.min(startFloat, endFloat)
  const end = Math.max(startFloat, endFloat)

  const match = checkFloat >= start && checkFloat <= end

  return match
}

function isIn(input, range) {
  const stringInput = getString(input, true)

  // Range is the array we are checking in
  return some(range, (entry) => {
    return stringInput === getString(entry, true)
  })
}

function isEmpty(input) {
  if (!input) {
    return true
  }

  if (input === undefined) {
    return true
  }

  if (input === null) {
    return true
  }

  if (input === '') {
    return true
  }

  if (isArray(input) && !input.length) {
    return true
  }

  if (input === 0 || input === '0') {
    return true
  }
}

export function matchAnyString(keywords, row) {
  // Get the keywords we want to search on
  const searchString = getString(keywords)

  if (isString(row)) {
    return checkString(row)
  } else {
    const valuesFromRow = values(row)
    return some(valuesFromRow, checkString)
  }

  function checkString(input) {
    const stringInput = getString(input)
    const exactMatch = includes(stringInput, searchString)
    // console.log('EXACT MATCH?', stringInput, string)
    return exactMatch || isSimilar(stringInput, searchString)
  }
}

export function isSimilar(input, mustMatchValue, options?) {
  if (!options) {
    options = {}
  }

  const score = compareTwoStrings(getString(input), getString(mustMatchValue))
  const matches = score >= 0.6

  if (options.source) {
    if (!options._similar) {
      options._similar = 0
    }

    // Increase the score
    options._similar += matches
  }

  return matches
}

function isEqual(input, range) {
  // Input is the field from the row, range is the filter input typed by the user

  const matchAny = getAllStringMatches(input, true)
  const rangeAsString = getString(range, true)

  // //console.log('CHECK MATCH', matchAny, rangeAsString);
  if (matchAny === rangeAsString) {
    return true
  }

  return includes(matchAny, rangeAsString)
}

function isContained(input, range) {
  // TODO Check if this is necessary
  // As i think this will always be a string
  if (isString(range)) {
    range = getString(range)
  }

  return includes(range, getString(input))
}

function dateCompare(input, range, type, format, timezone) {
  if (!input) {
    return false
  }

  // let date1 = new Date(input);
  // date1.setHours(0, 0, 0, 0);

  // let date2 = new Date(range);
  // date2.setHours(0, 0, 0, 0);

  const moment1 = moment.tz(input, timezone) // Birthday
  const moment2 = moment.tz(range, timezone) // Relative Date

  switch (type) {
    case 'next':
    case 'past':
      // We can go down to hourly
      break

    default:
      // Just track the day
      moment1.startOf('day')
      moment2.startOf('day')
      break
  }

  const date1 = moment1.toDate()
  const date2 = moment2.toDate()
  const now = new Date()

  let matched, startRange, dateDiffYears, checkDate

  switch (type) {
    case 'date':
      matched = String(date1) === String(date2)
      if (verboseDEBUG) {
        console.log('Matched', type, matched, String(date1), String(date2))
      }
      break
    case 'week':
      matched = moment1.format('W YYYY') === moment2.format('W YYYY')
      if (verboseDEBUG) {
        console.log(
          'Matched',
          type,
          matched,
          moment1.format('W YYYY'),
          moment2.format('W YYYY')
        )
      }
      break
    case 'month':
      matched = moment1.format('M YYYY') === moment2.format('M YYYY')
      if (verboseDEBUG) {
        console.log(
          'Matched',
          type,
          matched,
          moment1.format('M YYYY'),
          moment2.format('M YYYY')
        )
      }
      break
    case 'year':
      matched = moment1.format('YYYY') === moment2.format('YYYY')
      if (verboseDEBUG) {
        console.log(
          'Matched',
          type,
          matched,
          moment1.format('YYYY'),
          moment2.format('YYYY')
        )
      }
      break
    case 'dateanniversary':
      matched = moment1.format('D MMM') === moment2.format('D MMM')
      if (verboseDEBUG) {
        console.log(
          'Matched',
          type,
          matched,
          moment1.format('D MMM'),
          moment2.format('D MMM')
        )
      }
      break
    case 'dateanniversarynext':
      startRange = moment()
      dateDiffYears = startRange.diff(moment1, 'years', true)
      checkDate = moment1.add(Math.ceil(dateDiffYears), 'years').toDate()

      // //console.log('CHECK DATE Anniversary NEXT', date1, 'CHECK DATES', dateDiffYears, 'start:', startRange.toDate(), 'Anniversary:', checkDate, 'end:', date2);
      // If the date is earlier than now
      if (checkDate < now) {
        matched = false
      } else {
        matched = checkDate.getTime() <= date2.getTime()
      }

      if (verboseDEBUG) {
        console.log('Matched', type, matched, date1, date2)
      }
      break
    case 'dateanniversarypast':
      // moment1 the birthday
      // moment 2 is 5 days ago

      startRange = moment2
      dateDiffYears = startRange.diff(moment1, 'years', true)
      checkDate = moment1.add(Math.ceil(dateDiffYears), 'years').toDate()

      // If the date is earlier than now
      if (checkDate > now) {
        matched = false
      } else {
        matched = checkDate.getTime() >= date2.getTime()
      }

      // if (matched) {
      // //console.log('CHECK DATE Anniversary PAST', startRange.toDate(), '-', checkDate, '-', now);
      // }

      if (verboseDEBUG) {
        console.log('Matched', type, matched, date1, date2)
      }
      break

    case 'dateanniversarymonth':
      matched = moment1.format('MMM') === moment2.format('MMM')
      if (verboseDEBUG) {
        console.log(
          'Matched',
          type,
          matched,
          moment1.format('MMM'),
          moment2.format('MMM')
        )
      }
      break
    // case 'weekday':
    //     matched = moment(date1).format('dddd') === moment(date2).format('dddd');
    // break;
    case 'before':
      matched = date1.getTime() < date2.getTime()
      if (verboseDEBUG) {
        console.log('Matched', type, matched, date1, date2)
      }
      break
    case 'after':
      matched = date1.getTime() >= date2.getTime()
      if (verboseDEBUG) {
        console.log('Matched', type, matched, date1, date2)
      }
      break
    case 'next':
      // If the date is earlier than now
      if (date1 < now) {
        matched = false
      } else {
        matched = date1.getTime() < date2.getTime()
      }

      if (verboseDEBUG) {
        console.log('Matched', type, matched, date1, date2)
      }
      break
    case 'past':
      // If the date is later than now
      if (date1 > now) {
        matched = false
      } else {
        matched = date1.getTime() >= date2.getTime()
      }

      if (verboseDEBUG) {
        console.log('Matched', type, matched, date1, date2)
      }
      break
  }

  return matched
}

interface Comparator {
  title: string
  operator: string
  match: (...args) => boolean | undefined
  restrict?: string[]
  dateDisplayFormat?: string
  inputType?: string
  positive?: boolean
}

const comparators: Comparator[] = []

// Date Comparators
comparators.push({
  title: 'Is on day ',
  operator: 'datesameday',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }

    if (isArray(input)) {
      return some(input, (i) => {
        // dateCompare(input, range, type, format, timezone)
        return dateCompare(i, mustMatchValue, 'date', null, options.timezone)
      })
    } else {
      // dateCompare(input, range, type, format, timezone)
      return dateCompare(input, mustMatchValue, 'date', null, options.timezone)
    }
  },
  // dateDisplayFormat:'D MMM YYYY',
  restrict: ['date']
})

comparators.push({
  title: 'Anniversary Date',
  operator: 'dateanniversary',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }

    if (isArray(input)) {
      return some(input, (i) => {
        // dateCompare(input, range, type, format, timezone)
        return dateCompare(
          i,
          mustMatchValue,
          'dateanniversary',
          null,
          options.timezone
        )
      })
    } else {
      return dateCompare(
        input,
        mustMatchValue,
        'dateanniversary',
        null,
        options.timezone
      )
    }
  },
  dateDisplayFormat: 'YYYY',
  restrict: ['date']
})

// comparators.push({
//     title: 'Is between',
//     operator: 'datebetween',
//     match(input, mustMatchValue1, mustMatchValue2) {
//         let checkDate = new Date(input);
//         checkDate.setHours(0, 0, 0, 0);

//         let date1 = new Date(mustMatchValue1)
//         date1.setHours(0, 0, 0, 0);

//         let date2 = new Date(mustMatchValue2)
//         date2.setHours(0, 0, 0, 0);

//         return isBetween(checkDate.getTime(), date1.getTime(), date2.getTime());
//     },
//     restrict: [
//         'date',
//     ],
//     inputType: 'daterange',
// })

comparators.push({
  title: 'Anniversary is Between',
  operator: 'dateanniversarybetween',
  match(input, mustMatchValue1, mustMatchValue2, NOT_USED, options) {
    if (!options) {
      options = {}
    }

    if (!input) {
      return
    }

    const checkDate = new Date(input)
    if (isNaN(checkDate.getTime())) {
      return
    }

    checkDate.setHours(0, 0, 0, 0)

    const date1 = new Date(mustMatchValue1)
    date1.setHours(0, 0, 0, 0)

    const date2 = new Date(mustMatchValue2)
    date2.setHours(0, 0, 0, 0)

    const startDate = new Date(Math.min(date1.getTime(), date2.getTime()))
    const endDate = new Date(Math.max(date1.getTime(), date2.getTime()))

    function zeroPadded(str) {
      str = String(str)

      if (str.length === 1) {
        return '0' + str
      }

      return str
    }

    const checkTimestamp = parseInt(
      `${zeroPadded(checkDate.getMonth())}${zeroPadded(checkDate.getDate())}`
    )
    const startTimestamp = parseInt(
      `${zeroPadded(startDate.getMonth())}${zeroPadded(startDate.getDate())}`
    )
    const endTimestamp = parseInt(
      `${zeroPadded(endDate.getMonth())}${zeroPadded(endDate.getDate())}`
    )

    return checkTimestamp >= startTimestamp && checkTimestamp <= endTimestamp
  },
  dateDisplayFormat: 'YYYY',
  restrict: ['date'],
  inputType: 'daterange'
})

// comparators.push({
//     title: 'Anniversary Month',
//     operator: 'dateanniversarymonth',
//     match(input, mustMatchValue) {
//

//         if (isArray(input)) {
//             //Check if any of the dates on the row
//             return some(input, function(i) {

//                 //match any of the dates provided in the array
//                 return some(mustMatchValue, function(d) {
//                     return dateCompare(i, d, 'dateanniversarymonth');
//                 });
//             });
//         } else {
//             //check if the date on the row matches any of the dates
//             //in our array
//             return some(mustMatchValue, function(d) {
//                 return dateCompare(input, d, 'dateanniversarymonth');
//             });
//         }

//     },
//     dateDisplayFormat: 'MMMM',
//     restrict: [
//         'date',
//     ],
//     inputType: 'array',
// })

/**/
comparators.push({
  title: 'Is same week as',
  operator: 'datesameweek',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }

    if (isArray(input)) {
      return some(input, (i) => {
        // dateCompare(input, range, type, format, timezone)
        return dateCompare(i, mustMatchValue, 'week', null, options.timezone)
      })
    } else {
      return dateCompare(input, mustMatchValue, 'week', null, options.timezone)
    }
  },
  dateDisplayFormat: '[Wk]W YYYY',
  restrict: ['date'],
  inputType: 'array'
})

comparators.push({
  title: 'Is same month as',
  operator: 'datesamemonth',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }

    //     match(input, mustMatchValue) {

    //     let mustMatchString = String(mustMatchValue);

    //

    //     if (isArray(input)) {
    //         return some(input, function(i) {
    //            let weekdayInteger = moment(i).weekday()
    //            return includes(mustMatchString, weekdayInteger);
    //         });
    //     } else {
    //          let weekdayInteger = moment(input).weekday()
    //          return includes(mustMatchString, weekdayInteger);
    //     }

    // },

    if (isArray(input)) {
      return some(input, (i) => {
        // dateCompare(input, range, type, format, timezone)
        return dateCompare(i, mustMatchValue, 'month', null, options.timezone)
      })
    } else {
      return dateCompare(input, mustMatchValue, 'month', null, options.timezone)
    }
  },
  dateDisplayFormat: 'MMM YYYY',
  restrict: ['date']
})

comparators.push({
  title: 'Is same year as',
  operator: 'datesameyear',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }

    if (isArray(input)) {
      return some(input, (i) => {
        // dateCompare(input, range, type, format, timezone)
        return dateCompare(i, mustMatchValue, 'year', null, options.timezone)
      })
    } else {
      return dateCompare(input, mustMatchValue, 'year', null, options.timezone)
    }
  },
  dateDisplayFormat: 'YYYY',
  restrict: ['date']
})
/**/

comparators.push({
  title: 'Is weekday',
  operator: 'datesameweekday',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }

    const mustMatchString = String(mustMatchValue)

    if (isArray(input)) {
      return some(input, (i) => {
        const weekdayInteger = String(moment(i).weekday())
        return includes(mustMatchString, weekdayInteger)
      })
    } else {
      const weekdayInteger = String(moment(input).weekday())
      return includes(mustMatchString, weekdayInteger)
    }
  },
  dateDisplayFormat: 'dddd',
  restrict: ['date'],
  inputType: 'array'
})

comparators.push({
  title: 'Is not weekday',
  operator: 'datedifferentweekday',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }
    const mustMatchString = String(mustMatchValue)
    if (isArray(input)) {
      return !some(input, (i) => {
        const weekdayInteger = String(moment(i).weekday())
        return includes(mustMatchString, weekdayInteger)
      })
    } else {
      const weekdayInteger = String(moment(input).weekday())
      return !includes(mustMatchString, weekdayInteger)
    }
  },
  dateDisplayFormat: 'dddd',
  restrict: ['date'],
  inputType: 'array'
})

comparators.push({
  title: 'Is before',
  operator: 'datebefore',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }

    if (!input) {
      return
    }

    if (isArray(input)) {
      if (!input.length) {
        return
      }

      return some(input, (i) => {
        // dateCompare(input, range, type, format, timezone)
        return dateCompare(i, mustMatchValue, 'before', null, options.timezone)
      })
    } else {
      return dateCompare(
        input,
        mustMatchValue,
        'before',
        null,
        options.timezone
      )
    }
  },
  restrict: ['date']
})

comparators.push({
  title: 'Is after',
  operator: 'dateafter',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }

    if (!input) {
      return
    }

    if (isArray(input)) {
      if (!input.length) {
        return
      }

      return some(input, (i) => {
        // dateCompare(input, range, type, format, timezone)
        return dateCompare(i, mustMatchValue, 'after', null, options.timezone)
      })
    } else {
      const RESULT = dateCompare(
        input,
        mustMatchValue,
        'after',
        null,
        options.timezone
      )

      return RESULT
    }
  },
  restrict: ['date']
})

comparators.push({
  title: 'Is not before',
  operator: 'datenotbefore',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }

    if (!input) {
      return true
    }

    if (isArray(input)) {
      if (!input.length) {
        return true
      }

      // Every entry is not before
      return every(input, (i) => {
        // dateCompare(input, range, type, format, timezone)
        return !dateCompare(i, mustMatchValue, 'before', null, options.timezone)
      })
    } else {
      return !dateCompare(
        input,
        mustMatchValue,
        'before',
        null,
        options.timezone
      )
    }
  },
  restrict: ['date']
})

comparators.push({
  title: 'Is not after',
  operator: 'datenotafter',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }

    if (!input) {
      return true
    }

    if (isArray(input)) {
      if (!input.length) {
        return true
      }

      // Every entry is not after
      const allMatch = every(input, (i) => {
        // dateCompare(input, range, type, format, timezone)
        return !dateCompare(i, mustMatchValue, 'after', null, options.timezone)
      })

      return allMatch
    } else {
      const matchSingle = !dateCompare(
        input,
        mustMatchValue,
        'after',
        null,
        options.timezone
      )

      return matchSingle
    }
  },
  restrict: ['date']
})

comparators.push({
  title: 'Anniversary is in the next',
  inputType: 'datemeasure',
  operator: 'dateanniversarynext',
  match(input, measure, period, options) {
    if (!options) {
      options = {}
    }

    if (!input) {
      return
    }

    const mustMatchValue = moment().add(measure, period).toDate()

    if (isArray(input)) {
      if (!input.length) {
        return
      }

      return some(input, (i) => {
        // dateCompare(input, range, type, format, timezone)
        return dateCompare(
          i,
          mustMatchValue,
          'dateanniversarynext',
          null,
          options.timezone
        )
      })
    } else {
      return dateCompare(
        input,
        mustMatchValue,
        'dateanniversarynext',
        null,
        options.timezone
      )
    }
  },
  restrict: ['date']
})

comparators.push({
  title: 'Anniversary is in the last',
  inputType: 'datemeasure',
  operator: 'dateanniversarypast',
  match(input, measure, period, options) {
    if (!options) {
      options = {}
    }

    if (!input) {
      return
    }

    const mustMatchValue = moment().subtract(measure, period).toDate()

    if (isArray(input)) {
      if (!input.length) {
        return
      }

      return some(input, (i) => {
        // dateCompare(input, range, type, format, timezone)
        return dateCompare(
          i,
          mustMatchValue,
          'dateanniversarypast',
          null,
          options.timezone
        )
      })
    } else {
      return dateCompare(
        input,
        mustMatchValue,
        'dateanniversarypast',
        null,
        options.timezone
      )
    }
  },
  restrict: ['date']
})

comparators.push({
  title: 'Is in the next',
  inputType: 'datemeasure',
  operator: 'datenext',
  match(input, measure, period, options) {
    if (!options) {
      options = {}
    }

    let value

    if (!input) {
      return value
    }

    const mustMatchValue = moment().add(measure, period).toDate()

    if (isArray(input)) {
      if (!input.length) {
        return value
      }

      value = some(input, (i) => {
        // dateCompare(input, range, type, format, timezone)
        return dateCompare(i, mustMatchValue, 'next', null, options.timezone)
      })
    } else {
      value = dateCompare(input, mustMatchValue, 'next', null, options.timezone)
    }

    return value
  },
  restrict: ['date']
})

comparators.push({
  title: 'Is in the last',
  inputType: 'datemeasure',
  operator: 'datepast',
  match(input, measure, period, options) {
    if (!options) {
      options = {}
    }

    let value

    if (!input) {
      return value
    }

    const mustMatchValue = moment().subtract(measure, period).toDate()

    if (isArray(input)) {
      if (!input.length) {
        return value
      }

      value = some(input, (i) => {
        // dateCompare(input, range, type, format, timezone)
        return dateCompare(i, mustMatchValue, 'past', null, options.timezone)
      })
    } else {
      value = dateCompare(input, mustMatchValue, 'past', null, options.timezone)
    }

    return value
  },
  restrict: ['date']
})

comparators.push({
  title: 'Is not in the next',
  inputType: 'datemeasure',
  operator: 'datenotnext',
  match(input, measure, period, options) {
    if (!options) {
      options = {}
    }

    let value

    if (!input) {
      return !value
    }

    const mustMatchValue = moment().add(measure, period).toDate()

    if (isArray(input)) {
      if (!input.length) {
        return !value
      }

      value = some(input, (i) => {
        // dateCompare(input, range, type, format, timezone)
        return dateCompare(i, mustMatchValue, 'next', null, options.timezone)
      })
    } else {
      value = dateCompare(input, mustMatchValue, 'next', null, options.timezone)
    }

    return !value
  },
  restrict: ['date']
})

comparators.push({
  title: 'Is not in the last',
  inputType: 'datemeasure',
  operator: 'datenotpast',
  match(input, measure, period, options) {
    if (!options) {
      options = {}
    }

    let value

    if (!input) {
      return !value
    }

    const mustMatchValue = moment().subtract(measure, period).toDate()

    if (isArray(input)) {
      if (!input.length) {
        return !value
      }

      value = some(input, (i) => {
        // dateCompare(input, range, type, format, timezone)
        return dateCompare(i, mustMatchValue, 'past', null, options.timezone)
      })
    } else {
      value = dateCompare(input, mustMatchValue, 'past', null, options.timezone)
    }

    return !value
  },
  restrict: ['date']
})

comparators.push({
  title: 'Is between',
  operator: 'datebetween',
  match(input, mustMatchValue1, mustMatchValue2, options) {
    if (!options) {
      options = {}
    }

    const date1 = new Date(mustMatchValue1)
    date1.setHours(0, 0, 0, 0)

    const date2 = new Date(mustMatchValue2)
    date2.setHours(0, 0, 0, 0)

    if (isArray(input)) {
      return some(input, (i) => {
        const checkDate = new Date(i)
        checkDate.setHours(0, 0, 0, 0)
        return isBetween(checkDate.getTime(), date1.getTime(), date2.getTime())
      })
    } else {
      const checkDate = new Date(input)
      checkDate.setHours(0, 0, 0, 0)

      return isBetween(checkDate.getTime(), date1.getTime(), date2.getTime())
    }
  },
  restrict: ['date'],
  inputType: 'daterange'
})

comparators.push({
  title: 'Is not between',
  operator: 'datenotbetween',
  match(input, mustMatchValue1, mustMatchValue2, options) {
    if (!options) {
      options = {}
    }

    const date1 = new Date(mustMatchValue1)
    date1.setHours(0, 0, 0, 0)

    const date2 = new Date(mustMatchValue2)
    date2.setHours(0, 0, 0, 0)

    if (isArray(input)) {
      return !some(input, (i) => {
        const checkDate = new Date(i)
        checkDate.setHours(0, 0, 0, 0)
        return isBetween(checkDate.getTime(), date1.getTime(), date2.getTime())
      })
    } else {
      const checkDate = new Date(input)
      checkDate.setHours(0, 0, 0, 0)

      return !isBetween(checkDate.getTime(), date1.getTime(), date2.getTime())
    }
  },
  restrict: ['date'],
  inputType: 'daterange'
})

comparators.push({
  title: 'Is one of',
  operator: 'in',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }

    if (isArray(input)) {
      // Check if any match
      return some(input, (i) => {
        return isIn(i, mustMatchValue)
      })
    } else {
      const matches = isIn(input, mustMatchValue)

      return matches
    }
  },
  restrict: [
    'string',
    'email',
    'url',
    // 'number',
    // 'integer',
    // 'decimal',
    // 'float',
    'reference'
  ],
  inputType: 'array'
})

comparators.push({
  title: 'Is not one of',
  operator: 'notin',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }
    if (isArray(input)) {
      return !some(input, (i) => {
        return isIn(i, mustMatchValue)
      })
    } else {
      return !isIn(input, mustMatchValue)
    }
  },
  restrict: [
    'string',
    'email',
    'url',
    // 'number',
    // 'integer',
    // 'decimal',
    // 'float',
    'reference'
  ],
  inputType: 'array'
})

comparators.push({
  title: 'Is ',
  operator: '==',

  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }
    if (isArray(input)) {
      return some(input, (i) => {
        return isEqual(i, mustMatchValue)
      })
    } else {
      return isEqual(input, mustMatchValue)
    }
  },
  restrict: [
    'string',
    'email',
    'url',
    'boolean',
    'number',
    'integer',
    'decimal',
    'float',
    'reference'
  ]
})

comparators.push({
  title: 'Is not',
  operator: '!=',
  positive: false,
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }
    if (isArray(input)) {
      return !some(input, (i) => {
        return isEqual(i, mustMatchValue)
      })
    } else {
      return !isEqual(input, mustMatchValue)
    }
  },
  restrict: [
    'string',
    'email',
    'url',
    'boolean',
    'number',
    'integer',
    'decimal',
    'float',
    'reference'
  ]
})

comparators.push({
  title: 'Starts with',
  operator: 'startswith',

  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }
    if (isArray(input)) {
      return some(input, (i) => {
        return startsWith(getString(i), getString(mustMatchValue))
      })
    } else {
      return startsWith(getString(input), getString(mustMatchValue))
    }
  },
  restrict: ['string', 'email', 'url', 'reference']
})

comparators.push({
  title: 'Ends with',
  operator: 'endswith',

  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }
    if (isArray(input)) {
      return some(input, (i) => {
        return endsWith(getString(i), getString(mustMatchValue))
      })
    } else {
      return endsWith(getString(input), getString(mustMatchValue))
    }
  },
  restrict: ['string', 'email', 'url', 'reference']
})

comparators.push({
  title: 'Is similar to',
  operator: 'like',

  match(input, mustMatchValue) {
    if (isArray(input)) {
      return some(input, (i) => {
        return isSimilar(i, mustMatchValue)
      })
    } else {
      return isSimilar(input, mustMatchValue)
    }
  },
  restrict: ['string', 'url', 'email']
})

comparators.push({
  title: 'Contains characters',
  operator: 'contains',

  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }
    if (isArray(input)) {
      return some(input, (i) => {
        return isContained(mustMatchValue, i)
      })
    } else {
      return isContained(mustMatchValue, input)
    }
  },
  restrict: ['string', 'url', 'email']
})

comparators.push({
  title: 'Does not contain characters',
  operator: 'excludes',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }
    if (isArray(input)) {
      return !some(input, (i) => {
        return isContained(mustMatchValue, i)
      })
    } else {
      return !isContained(mustMatchValue, input)
    }
  },
  restrict: ['string', 'url', 'email']
})

comparators.push({
  title: 'Is greater than',
  operator: '>',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }
    return parseFloat(input || 0) > parseFloat(mustMatchValue || 0)
  },
  restrict: ['number', 'integer', 'decimal', 'float']
})

comparators.push({
  title: 'Is less than',
  operator: '<',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }

    if (isNotANumber(input)) {
      return
    }

    return parseFloat(input || 0) < parseFloat(mustMatchValue || 0)
  },
  restrict: ['number', 'integer', 'decimal', 'float']
})

comparators.push({
  title: 'Is not greater than',
  operator: '!>',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }
    return !(parseFloat(input || 0) > parseFloat(mustMatchValue || 0))
  },
  restrict: ['number', 'integer', 'decimal', 'float']
})

comparators.push({
  title: 'Is not less than',
  operator: '!<',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }
    return !(parseFloat(input || 0) < parseFloat(mustMatchValue || 0))
  },
  restrict: ['number', 'integer', 'decimal', 'float']
})

comparators.push({
  title: 'Is greater than or equal to',
  operator: '>=',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }

    if (isNotANumber(input)) {
      return
    }

    return parseFloat(input || 0) >= parseFloat(mustMatchValue || 0)
  },
  restrict: ['number', 'integer', 'decimal', 'float']
})

comparators.push({
  title: 'Is less than or equal to',
  operator: '<=',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }

    if (isNotANumber(input)) {
      return
    }

    return parseFloat(input || 0) <= parseFloat(mustMatchValue || 0)
  },
  restrict: ['number', 'integer', 'decimal', 'float']
})

comparators.push({
  title: 'Is between',
  operator: 'between',
  match(input, mustMatchValue1, mustMatchValue2, options) {
    if (!options) {
      options = {}
    }

    return isBetween(input, mustMatchValue1, mustMatchValue2)
  },
  restrict: ['number', 'integer', 'decimal', 'float'],
  inputType: 'range'
})

comparators.push({
  title: 'Is not between',
  operator: 'notbetween',
  match(input, mustMatchValue1, mustMatchValue2, options) {
    if (!options) {
      options = {}
    }
    return !isBetween(input, mustMatchValue1, mustMatchValue2)
  },
  restrict: ['number', 'integer', 'decimal', 'float'],
  inputType: 'range'
})

comparators.push({
  title: 'Is empty',
  operator: 'empty',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }

    const result = isEmpty(input)

    return result
  },
  inputType: 'none'
})

comparators.push({
  title: 'Is not empty',
  operator: 'notempty',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }
    return !isEmpty(input)
  },
  inputType: 'none'
})

comparators.push({
  title: 'Does not start with',
  operator: 'doesnotstartwith',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }
    if (isArray(input)) {
      return !some(input, (i) => {
        return startsWith(getString(i), getString(mustMatchValue))
      })
    } else {
      return !startsWith(getString(input), getString(mustMatchValue))
    }
  },
  restrict: ['string', 'email', 'url', 'reference']
})

comparators.push({
  title: 'Does not end with',
  operator: 'doesnotendwith',
  match(input, mustMatchValue, NOT_USED, options) {
    if (!options) {
      options = {}
    }
    if (isArray(input)) {
      return !some(input, (i) => {
        return endsWith(getString(i), getString(mustMatchValue))
      })
    } else {
      return !endsWith(getString(input), getString(mustMatchValue))
    }
  },
  restrict: ['string', 'email', 'url', 'reference']
})

const allTypes = [
  'string',
  'email',
  'url',
  'phone',
  'date',
  'boolean',
  'number',
  'integer',
  'decimal',
  'float',
  'reference'
]

const comparatorLookup = {}
const comparatorTypeLookup = {}

// Loop through each available comparator
each(comparators, (comparator) => {
  // console.log('comparators', comparator.title)
  // map each comparator
  comparatorLookup[comparator.operator] = comparator

  // Find any restrictions for this comparator
  let restrictTypes = comparator.restrict || []

  // If there are none, then it's available to all types
  if (!restrictTypes.length) {
    restrictTypes = allTypes
  }

  // And map to each type it's restricted for
  each(restrictTypes, (type) => {
    let existing = comparatorTypeLookup[type]

    if (!existing) {
      existing = comparatorTypeLookup[type] = []
    }

    // Add the comparator to the list
    existing.push(comparator)
  })
})

// console.log('COMPARATOR LOOKUP', comparatorTypeLookup, comparatorLookup)

// console.log('COMPARATOR KEYS', keys(comparatorLookup), keys(comparatorTypeLookup));

// Quick fast way to retrieve the comparator
export function getComparator(operator) {
  return comparatorLookup[operator]
}

export function getComparatorsForType(type) {
  return comparatorTypeLookup[type] || comparators
}

export function isValidFilter(block) {
  if (block.operator) {
    return some(block.filters, isValidFilter)
  }

  const comparator = getComparator(block.comparator)
  if (!comparator) {
    return
  }

  const key = getRootKey(block.key)
  if (!key || !key.length) {
    return
  }

  switch (comparator.inputType) {
    case 'none':
      return true
      break
    case 'range':
      if (!block.value || isNaN(block.value)) {
        return
      }

      if (!block.value2 || isNaN(block.value2)) {
        return
      }
      break
    case 'daterange':
      if (!block.value || !isDate(new Date(block.value))) {
        return
      }

      if (!block.value2 || !isDate(new Date(block.value))) {
        return
      }

      break
    case 'array':
      if (!block.values || !block.values.length) {
        return
      }
      break
    default:
      if (block.computedValue) {
        return true
      }

      if (block.dataType === 'boolean') {
        switch (String(block.value).toLowerCase()) {
          case 'yes':
          case 'true':
          case 'false':
          case 'no':
          case '1':
          case '0':
            return true
            break
          default:
            return
            break
        }
      } else {
        if (!block.value || !isDate(new Date(block.value))) {
          return
        }
      }

      // if (!block.value || !isDate(new Date(block.value))) {
      //     return;
      // }
      break
  }

  return true
}

export function filterGroupMatch(filterGroup, filterOptions, item) {
  // If it's a group
  if (!filterOptions) {
    filterOptions = {}
  }

  const operator = filterGroup.operator
  let returnValue

  // Find valid filters and order by weight (so we can try and be as efficient as possible)
  function filterWeight(filter) {
    let dataKey = filter.dataType
    const comparatorKey = filter.comparator

    if (!dataKey && !comparatorKey) {
      return 0
    }

    const pathComplexity = occurrences(filter.key, '[]')

    const comparatorWeight = getComparatorWeight(comparatorKey)

    let dataTypeWeight = 0

    switch (dataKey) {
      case 'number':
      case 'integer':
      case 'decimal':
      case 'float':
        dataTypeWeight = 2
        break
      case 'date':
        dataTypeWeight = 3
        break
      case 'reference':
        dataTypeWeight = 4
        break
      case 'string':
      case 'email':
      case 'url':
      default:
        dataKey = 'string'
        dataTypeWeight = 1
        break
    }

    const weightString = `${pathComplexity}${dataTypeWeight}${comparatorWeight}`

    const finalWeight = parseInt(weightString)

    return finalWeight
  }

  const validFilters = chain(filterGroup.filters)
    .filter(isValidFilter)
    .orderBy(filterWeight)
    .value()

  if (validFilters && validFilters.length) {
    switch (operator) {
      case 'or':
        returnValue = some(validFilters, (filterBlock) => {
          const wasMatch = filterMatch(filterBlock, filterOptions, item)

          return wasMatch
        })
        break
      case 'nor':
        // If any of these return true
        returnValue = some(validFilters, (filterBlock) => {
          const wasMatch = filterMatch(filterBlock, filterOptions, item)
          return !wasMatch
        })

        break
      case 'and':
      default:
        returnValue = every(validFilters, (filterBlock) => {
          const wasMatch = filterMatch(filterBlock, filterOptions, item)
          // if(!wasMatch) {
          //     //console.log(wasMatch, 'was not a match', filterBlock)
          // }

          // //console.log('Was', item, wasMatch, filterBlock)
          return wasMatch
        })
        break
    }
  } else {
    console.log('No valid filters!')
  }

  return returnValue
}

export function getRootKey(key) {
  // key = String(key).split('[]')[0];

  return String(key).split('|')[0]
}

// Easy function to filter according to all specified criteria when in the front end
export function filter(items, options) {
  if (!options) {
    options = {}
  }

  let filterOptions

  const searchKeywords = options.search
    ? String(options.search).toLowerCase().trim()
    : null
  const searchPieces = (searchKeywords || '').split(' ')
  const startDate = options.startDate ? new Date(options.startDate) : null
  const endDate = options.endDate ? new Date(options.endDate) : null
  const filterConfig = options.filter

  const serviceActiveFilters = activeFilters(filterConfig)
  const hasActiveFilters = serviceActiveFilters && serviceActiveFilters.length
  const hasSearchKeywords = searchKeywords && searchKeywords.length
  const hasDateBoundaries = startDate && endDate

  // No filters are active
  if (!hasActiveFilters && !hasSearchKeywords && !hasDateBoundaries) {
    return items
  }

  return filter(items, (item) => {
    // There is filter criteria
    if (hasActiveFilters) {
      // Check if it matches the filters and if it doesn't
      const matchesFilters = filterGroupMatch(filterConfig, filterOptions, item)
      if (!matchesFilters) {
        return
      }
    }

    let searchIsCorrect

    // Check if it matches the search keywords
    if (hasSearchKeywords) {
      // Get the title
      const itemTitle = String(item.title).trim().toLowerCase()
      const idString = String(item._id).trim().toLowerCase()

      // If the keyword string is an exact match for the id of the item
      const exactIDMatch = searchKeywords === idString
      if (exactIDMatch) {
        // Search is a match
        searchIsCorrect = true
      } else {
        // If the title matches the keywords exactly
        const exactMatch = includes(itemTitle, searchKeywords)

        if (exactMatch) {
          // We are all done here

          searchIsCorrect = true
        } else {
          // Check if the the keywords matches
          const keywordString = (item.keywords || []).join(' ')

          // If there are keywords
          if (keywordString.length) {
            // console.log('We have keywords!', keywordString)

            // Check if there is an exact match for keywords
            const exactMatch = includes(keywordString, searchKeywords)

            if (exactMatch) {
              // We're done
              searchIsCorrect = true
            } else {
              // If it's a Multiword Match
              const multiMatch = every(searchPieces, (partial) => {
                return (
                  includes(itemTitle, partial) ||
                  includes(keywordString, partial)
                )
              })
              // console.log('Is it a multimatch?', multimatch)

              if (multiMatch) {
                searchIsCorrect = true
              }
            }
          }

          // Search is correct
          if (!searchIsCorrect) {
            const recursiveDeepSearch = (entry) => {
              if (isString(entry)) {
                return matchAnyString(searchKeywords, entry)
              }

              if (isArray(entry) || isObject(entry)) {
                return some(entry, (value) => {
                  return recursiveDeepSearch(value)
                })
              }
            }

            searchIsCorrect = recursiveDeepSearch(item)
          }
        }
      }

      // If we have a search but the item doesn't match it
      // then finish and return false here
      if (!searchIsCorrect) {
        return
      }
    }

    if (hasDateBoundaries) {
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(0, 0, 0, 0)

      const itemStartDate = new Date(startDate)
      itemStartDate.setHours(0, 0, 0, 0)

      const itemEndDate = new Date(endDate)
      itemEndDate.setHours(0, 0, 0, 0)

      if (itemEndDate < startDate) {
        return
      }

      if (itemStartDate > endDate) {
        return
      }
    }

    // We made it here so it must be a correct match
    return true
  })
}

// Pass through
export function filterMatch(filter, filterOptions, item) {
  if (!filterOptions) {
    filterOptions = {}
  }

  if (filter.filters) {
    return filterGroupMatch(filter, filterOptions, item)
  }

  // console.log('FILTER', filter.key, filter, item)

  const filterKey = filter.key // .split('|')[0];
  const arrayDelimiter = '[]'

  if (includes(filterKey, arrayDelimiter)) {
    const splitPieces = filterKey.split(arrayDelimiter)
    const splitKey = splitPieces.shift()
    const splitParameters = splitPieces.join('[]')

    const newFilter = JSON.parse(JSON.stringify(filter))
    newFilter.key = splitParameters
    const subItems = get(item, splitKey) || []

    // //Here we should check what kind of filter it is and whether to do a falsey/truthy check on the path
    if (isFalsey(newFilter.comparator)) {
      if (!subItems.length) {
        return true
      }

      // Ensure that none of the sub items match
      return every(subItems, (subItem) => {
        return filterMatch(newFilter, filterOptions, subItem)
      })
    } else {
      if (!subItems.length) {
        return
      }

      // Find as soon as there is a match
      const someMatch = some(subItems, (subItem) => {
        const isAMatch = filterMatch(newFilter, filterOptions, subItem)
        // console.log('sub item has a match', isAMatch, subItem)
        return isAMatch
      })

      // console.log('IS MATCH WITH SUB ITEMS', someMatch)
      return someMatch
    }

    // return filter(subItems, function(subItem) {
    //     let isMatch = filterMatch(newFilter, subItem)
    //     if(isMatch) {
    //         subItem._matchesFilter = true;
    //     }

    //     return isMatch;
    // }).length;
  }

  let key = getRootKey(filterKey)

  if (key[0] === '.') {
    key = key.slice(1)
  }
  let mustMatchValue = filter.value
  const mustMatchValue2 = filter.value2

  // console.log('ROOT KEY', key, filter.dataType, mustMatchValue, mustMatchValue2);
  // console.log('ROOT KEY', key, filter.dataType, mustMatchValue, mustMatchValue2, item);

  if (
    filter.dataType === 'date' &&
    filter.computedValue &&
    filter.computedValue.length
  ) {
    // console.log('DATE CHECKER', item, mustMatchValue, mustMatchValue2)
    let dynamicString = filter.computedValue
    if (dynamicString === 'now') {
      mustMatchValue = new Date()
    } else {
      // Get the context date
      const contextDateInput = filterOptions.contextDate
        ? filterOptions.contextDate
        : new Date()

      if (filterOptions.timezone) {
        const zone = moment.tz.zone(filterOptions.timezone)
        if (zone) {
          const TimezoneAbbr = zone.abbr(contextDateInput)
          dynamicString = `${dynamicString} ${TimezoneAbbr}`
        }
      }

      const timestamp = strtotime(
        dynamicString,
        new Date(contextDateInput).getTime()
      )

      // Use the timestamp as the value we need to match
      mustMatchValue = new Date(timestamp)
    }
  }

  // Find the comparator
  const comparator = getComparator(filter.comparator || '==')
  const inputType = comparator.inputType

  if (!key || !key.length) {
    console.log('No Key!', key)
    return true
  }

  // If we are a range type filter
  if (inputType === 'array') {
    // Get the second value
    const mustMatchValue = filter.values || []

    // If we don't have a value 2 then return true
    if (!mustMatchValue || !mustMatchValue.length) {
      return true
    }
  }

  if (inputType !== 'none') {
    // If we don't have a value yet then return true
    if (typeof mustMatchValue === 'undefined' || mustMatchValue === null) {
      return true
    }
  }

  // If we are a range type filter
  if (inputType === 'range' || inputType === 'daterange') {
    // If we don't have a value 2 then return true
    if (typeof mustMatchValue2 === 'undefined' || mustMatchValue2 === null) {
      return true
    }
  }

  // Get the actual value on the item
  let itemValue = get(item, key)

  const discriminatorDelimiter = '|'
  if (includes(filterKey, discriminatorDelimiter)) {
    // if (startsWith(key, 'tags')) {
    //     //console.log('CHECK', inputType, key, item[key], mustMatchValue, mustMatchValue2)
    // }

    const discriminatorPieces = filterKey.split(discriminatorDelimiter)
    const discriminator = discriminatorPieces[1]

    if (discriminator && key !== 'tags') {
      itemValue = filter(itemValue, (realm) => {
        return (
          realm.definition === discriminator ||
          realm._discriminatorType === discriminator ||
          realm._discriminator === discriminator
        )
      })
    }
  }

  // //console.log('TAGS CHECK', key, itemValue.length)

  // if (inputType !== 'none') {
  //     //If we don't have a value yet then return true
  //     if (typeof mustMatchValue === 'undefined' || mustMatchValue === null || mustMatchValue === '') {
  //         return;
  //     }
  // }

  switch (filter.dataType) {
    case 'boolean':
      itemValue = convertToBoolean(itemValue)
      mustMatchValue = convertToBoolean(mustMatchValue)
      break
    default:
      if (inputType !== 'none') {
        // If we don't have a value yet then return true
        if (
          typeof mustMatchValue === 'undefined' ||
          mustMatchValue === null ||
          mustMatchValue === ''
        ) {
          return
        }
      }
      break
  }

  if (filter.criteria && filter.criteria.length) {
    const arraySourceKey = key.split('.length')[0]
    let arrayValue = get(item, arraySourceKey)

    // console.log('ARRAY', item.title, map(arrayValue,function(post) {return `${post.parent} - ${post._id}`}));

    // If there are items to filter
    // itemValue should be an array
    if (arrayValue && arrayValue.length) {
      // We need to filter the arrayValue array to match our criteria
      arrayValue = filter(arrayValue, (entry) => {
        const val = filterMatch(
          { filters: filter.criteria },
          filterOptions,
          entry
        )

        // if (entry._id === '5e798a7e5bf8a3465952d923') {
        //     ////console.log('FOUND IT', val, entry);
        // }
        return val
      })

      console.log('FILTERED ARRAY VALUE', arrayValue)

      // console.log('cHECK MATCH FILTER', filter.sourceKey, itemValue.length);//, filter.criteria);
    } else {
      arrayValue = []
    }

    // //console.log('ARRAY CHECK', filter.criteria)

    // let keys = map(filter.criteria, 'key');

    // each(arrayValue, function(entry) {
    //  entry.title = entry.title
    // })

    // Augment with the details
    if (!item._matchedFilters) {
      item._matchedFilters = {}
    }

    if (!item._matchedFilters[key]) {
      item._matchedFilters[key] = [] // {total:arrayValue.length, items:[]};
    }

    item._matchedFilters[key].push(arrayValue.slice(0, 100))

    if (endsWith(key, '.length')) {
      itemValue = arrayValue.length
    } else {
      itemValue = arrayValue
    }
  }

  const itMatches = comparator.match(
    itemValue,
    mustMatchValue,
    mustMatchValue2,
    {
      source: item,
      key,
      timezone: filterOptions.timezone,
      contextDate: filterOptions.contextDate
    }
  )

  // if (itMatches && key === 'tags') {
  //     //console.log('CHECK IT MATCHES', item._id, item.title, itMatches, itemValue)
  //     // //console.log('CHECK IT MATCHES', item.title, item.track, itMatches, itemValue)
  // }

  return itMatches
}

export function getComparatorWeight(key) {
  const weight = 0

  switch (key) {
    // Exact Comparators
    case '==':
    case '!=':
    case 'empty':
    case 'notempty':
      return 0
      break

    // Numeric Comparators
    case '>':
    case '<':
    case '!>':
    case '!<':
    case '>=':
    case '<=':
    case 'between':
    case 'notbetween':
      return 1
      break

    // String Comparators
    case 'startswith':
    case 'endswith':
    case 'doesnotstartwith':
    case 'doesnotendwith':
    case 'contains':
    case 'excludes':
      return 2
      break

    // Array Comparators
    case 'in':
    case 'notin':
      return 3
      break

    // Date Comparators
    case 'datesameday':
    case 'dateanniversary':
    case 'dateanniversarybetween':
    case 'dateanniversarynext':
    case 'dateanniversarypast':
    case 'datesameweek':
    case 'datesamemonth':
    case 'datesameyear':
    case 'datesameweekday':
    case 'datedifferentweekday':
    case 'datebefore':
    case 'dateafter':
    case 'datenotbefore':
    case 'datenotafter':
    case 'datebetween':
    case 'datenotbetween':
      return 4
      break

    // Fuzzy Search Comparators
    case 'like':
      return 5
      break
  }

  return weight
}

function isFalsey(comparator) {
  switch (comparator) {
    case 'excludes':
    case 'doesnotstartwith':
    case 'doesnotendwith':
    case '!>':
    case '!<':
    case '!=':
    case 'notbetween':
    case 'notin':
    case 'empty':
    case 'datenotbetween':
    case 'datenotafter':
    case 'datenotbefore':
      return true
      break
  }
}

function occurrences(string, substring) {
  let n = 0
  let pos = 0
  const l = substring.length

  while (true) {
    pos = (string || '').indexOf(substring, pos)
    if (pos > -1) {
      n++
      pos += l
    } else {
      break
    }
  }
  return n
}

export function allKeys(initFields, config) {
  if (!initFields) {
    initFields = []
  }

  const basicTypeName = get(config, 'type.definitionName')

  const definitionFieldsArray = get(config, 'definition.fields')
  const definitionFields = chain(definitionFieldsArray)
    .map((field) => {
      if (basicTypeName === 'interaction') {
        return Object.assign({}, field, {
          prefixKey: 'rawData' // .' + field.key,
        })
      } else {
        return Object.assign({}, field, {
          prefixKey: 'data' // .' + field.key,
        })
      }
    })
    .value()

  // console.log('Get all fields', definitionFields);

  // Include filters that have been set on the definition
  const definitionFiltersArray = get(config, 'definition.filters')
  const definitionFilters = chain(definitionFiltersArray)
    .map(function (field) {
      return Object.assign({}, field)
    })
    .value()

  // Include filters that have been set on the definition
  const dynamicFiltersArray = get(config, 'definition.dynamicFilters')
  const dynamicFilters = chain(dynamicFiltersArray)
    .map(function (field) {
      return Object.assign({}, field)
    })
    .value()

  const typeFieldsArray = get(config, 'type.fields')
  const typeFields = chain(typeFieldsArray)
    .map(function (field) {
      return Object.assign({}, field)
    })
    .value()

  let detailSheetFields = []

  if (config && config.details) {
    detailSheetFields = reduce(
      config.details,
      (set, detailSheet) => {
        // //Get all the flattened fields
        const flattened = getFlattenedFields(detailSheet.fields, [], [])

        const mapped = chain(flattened)
          .map((field) => {
            if (field.type === 'group') {
              return undefined
            }

            return {
              title: detailSheet.title + ' - ' + field.titles.join(' > '),
              key: `details.${
                detailSheet.definitionName
              }.items[].data.${field.trail.join('.')}`,
              minimum: field.minimum,
              maximum: field.maximum,
              detail: detailSheet.definitionName,
              type: field.type
            }
          })
          .compact()
          .value()

        // Add an 'existence' check for the _id
        mapped.unshift({
          title: detailSheet.title,
          // key: `details.${detailSheet.definitionName}.items[0].data.${field.trail.join('.')}`,
          key: `details.${detailSheet.definitionName}.items[]._id`,
          minimum: 0,
          maximum: 0,
          detail: detailSheet.definitionName,
          type: 'string'
        })

        // Add an 'existence' check for the _id
        mapped.unshift({
          title: `${detailSheet.title} - Number of sheets`,
          // key: `details.${detailSheet.definitionName}.items[0].data.${field.trail.join('.')}`,
          key: `details.${detailSheet.definitionName}.items.length`,
          minimum: 0,
          maximum: 0,
          detail: detailSheet.definitionName,
          type: 'integer'
        })

        return set.concat(mapped)
      },
      []
    )
  }

  const fields = initFields.concat(
    typeFields,
    definitionFields,
    detailSheetFields,
    dynamicFilters,
    definitionFilters
  )
  const allFlattened = getFlattenedFields(fields, [], [])

  // let res = chain(allFlattened)
  // .compact()
  //     .filter(function(field) {
  //         return field.type !== 'object';
  //     })

  //     .uniqBy(function(field) {

  //         // console.log('F', field)
  //         return field.key;
  //     })
  //     .orderBy(function(field) {
  //         return field.title
  //     })
  //     .value();

  // console.log('filter key res', res)

  // return res;

  return chain(allFlattened)
    .reduce(function (set, field) {
      if (field.type === 'object') {
        return set
      }

      const pathKey = (field.trail || []).join('.')

      const useKey = pathKey || field.key
      const entry = Object.assign({}, field, {
        key: useKey,
        title: field.titles.join(' > ')
      })
      set[useKey] = entry

      return set
    }, {})
    .values()
    .orderBy('title')
    .value()
}

function addValueToSet(values, entry) {
  // If it's not an object
  if (!entry._id && !entry.title && !entry.name && !entry.id) {
    return (values[entry] = entry)
  }

  return (values[entry._id || entry.title || entry.name || entry.id] = entry)
}

export function getDeepValue(set, node, keyPath) {
  if (includes(keyPath, '[]')) {
    const splitPieces = keyPath.split('[]')
    const splitKey = splitPieces.shift()
    const subPath = splitPieces.join('[]')
    const subItems = get(node, splitKey) || []
    return each(subItems, (subItem) => {
      getDeepValue(set, subItem, subPath)
    })
  }

  // Matching Value
  const value = get(node, keyPath)

  if (value === undefined || value === null || isArray(value) || value === '') {
    return
  }

  if (isArray(value)) {
    if (value.length) {
      each(value, (v) => {
        addValueToSet(set, v)
      })
    }
  } else {
    addValueToSet(set, value)
  }
}

export function convertToBoolean(v) {
  switch (String(v).toLowerCase()) {
    case 'true':
    case 'yes':
    case 'y':
    case '1':
      return true
      break
    default:
      return false
      break
  }
}

export function extractDeepValues(node, fieldKey) {
  const inputValues = {}

  // Get the deep value
  // console.log('get deep value', node, fieldKey);
  getDeepValue(inputValues, node, fieldKey)

  return values(inputValues)
}

const FilterService = {
  comparatorLookup,
  comparatorTypeLookup,
  comparators,
  activeFilters,
  activeFilterRows,
  activeFilterKeys,
  activeFilterCriteriaString,
  activeFilterValues,
  activeFilterComparators,
  activeFilterOperators,
  getFilterChangeString,
  matchAnyString,
  isSimilar,
  getComparator,
  getComparatorsForType,
  isValidFilter,
  filterGroupMatch,
  getRootKey,
  filter,
  filterMatch,
  getComparatorWeight,
  allKeys,
  getDeepValue,
  convertToBoolean,
  extractDeepValues
}

export default FilterService
