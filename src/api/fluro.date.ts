import { chain, get, orderBy } from 'lodash'
import moment from 'moment-timezone'

import { getStringID } from './fluro.utils'

let DEFAULT_TIMEZONE
if (!(typeof window === 'undefined')) {
  DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone
}
/**
 * A function that returns all of the available timezones. Often used to populate a select box
 * @alias date.timezones
 * @return {Array}                   An array of all availble timezones.
 */
export function timezones() {
  return moment.tz.names()
}
/**
 * A function that converts a timestamp string '7:30' to '0730';
 * @alias date.militaryTimestamp
 * @return {String}
 */
export function militaryTimestamp(input, withColon?) {
  let s = input
  if (!s || !String(s)) {
    console.log('reset to 0000', input)
    s = '0000'
  }
  s = String(parseInt(String(s).split(':').join(''))).slice(0, 4)
  if (s.length < 1) {
    s = '0000' + s
  } else if (s.length < 2) {
    s = '000' + s
  } else if (s.length < 3) {
    s = '00' + s
  } else if (s.length < 4) {
    s = '0' + s
  }
  let hours = parseInt(s.substring(0, 2))
  let mins = parseInt(s.substring(2))
  hours = Math.max(hours, 0)
  mins = Math.max(mins, 0)
  hours = Math.min(hours, 23)
  mins = Math.min(mins, 59)
  let hoursString = String(hours)
  let minsString = String(mins)
  if (hoursString.length < 2) {
    hoursString = `0${hoursString}`
  }
  if (minsString.length < 2) {
    minsString = `0${minsString}`
  }
  if (withColon) {
    return `${hoursString}:${minsString}`
  } else {
    return `${hoursString}${minsString}`
  }
}
/**
 * A function that converts a timestamp string '13:30' to '1:30pm';
 * @alias date.timestampToAmPm
 * @return {String}                   A formatted timestamp string
 */
export function timestampToAmPm(input) {
  const s = militaryTimestamp(input)
  let am = true
  let hours = parseInt(s.substring(0, 2))
  let mins = parseInt(s.substring(2))
  if (hours > 12) {
    am = false
    hours = hours - 12
  }
  hours = Math.max(hours, 0)
  mins = Math.max(mins, 0)
  hours = Math.min(hours, 12)
  mins = Math.min(mins, 59)
  let minsString = String(mins)
  if (minsString.length < 2) {
    minsString = `0${minsString}`
  }
  return `${hours}:${minsString}${am ? 'am' : 'pm'}`
  // return s;
}
export function currentTimezone() {
  return moment.tz.guess()
}
/**
 * A function that returns all of the available timezones. Often used to populate a select box
 * @alias date.isDifferentTimezoneThanUser
 * @return {Boolean}                   True if the specified timezone is different than the viewing user
 */
export function isDifferentTimezoneThanUser(timezone) {
  const browserTimezone = moment.tz.guess()
  if (!timezone) {
    return false
  }
  timezone = String(timezone)
  if (browserTimezone === timezone) {
    return false
  }
  const now = new Date()
  const current = moment.tz(now, browserTimezone).utcOffset()
  const checked = moment.tz(now, timezone).utcOffset()
  if (current === checked) {
    return false
  }
  return true
}
/**
 * A function that will return a date in context of a specified timezone
 * If no timezone is specified then the default timezone of the current clock will be used.
 * This will return dates that are incorrect on purpose. So that it can appear to the user as if they were in another timezone.
 * As Javascript dates are always in the context of the timezone they are being viewed in, this function will give you a date that is technically
 * not the Universal point in time of the date, but rather a time that reads in your timezone as if you were in the specified timezone.
 * @alias date.localDate
 * @param  {Date} date      Either a javascript date object, or a string timestamp representing a javascript date object
 * @param  {String} specifiedTimezone The timezone to retrieve the date in eg. Australia/Melbourne
 * @return {Date}                   A javascript date object transformed to match the specified timezone
 */
export function localDate(d, specifiedTimezone?) {
  // Date
  let date // = new Date(d);
  if (!d) {
    date = new Date()
  } else {
    date = new Date(d)
  }

  let timezoneOffset
  let browserOffset = date.getTimezoneOffset()

  // if (!specifiedTimezone) {
  //     specifiedTimezone = defaultTimezone;
  // }
  if (specifiedTimezone) {
    timezoneOffset = moment.tz(date, specifiedTimezone).utcOffset()
    browserOffset = moment(date).utcOffset()
    const difference = timezoneOffset - browserOffset
    const offsetDifference = difference * 60 * 1000
    date.setTime(date.getTime() + offsetDifference)
  }
  return date
}
/**
 * A helpful function that can quickly get an age from a supplied date string
 * @alias date.getAge
 * @return {Integer}            The age in years
 * @example
 * fluro.date.getAge('2019-04-18T23:00:00.000Z')
 */
export function getAge(dateInput) {
  const today = new Date()
  const birthDate = new Date(dateInput)
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  // If the date is on the cusp of the new year
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}
/**
 * Parses a date and returns a human readable date string
 * @param  {Date|String} date The date or string to parse
 * @param  {String} format     A string representing the format to output for formatting syntax see https://momentjs.com/docs/#/displaying/format/
 * @param  {String} timezone   The timezone to use if needing to translate the date to another timezone eg. Australia/Melbourne
 * @return {String}            A human readable string
 * @example
 * let date = new Date()
 * return fluro.date.formatDate(date, 'h:mma DDD MMM YYYY')
 *
 * let dateString = '2019-04-18T23:00:00.000Z'
 * return fluro.date.formatDate(dateString, 'D M YYYY', 'Australia/Melbourne')
 */
export function formatDate(dateString, format, timezone) {
  const date = localDate(dateString, timezone)
  if (timezone) {
    return moment(date).format(format)
    //     return d
  } else {
    return moment(date).format(format)
  }
}
/**
 * Parses a date and returns a 'timeago' string
 * @param  {Date|String} date The date or string to parse
 * @return {String}            A human readable string
 * @example
 * let date = new Date()
 *
 * // Returns 10 mins ago
 * return fluro.date.timeago(date)
 */
export function timeago(date, suffix) {
  return moment(date).fromNow(suffix)
}
/**
 * Parses an ObjectID and returns the date of creation
 * @param  {String} id The id of the object to parse
 * @param  {String} format     A string representing the format to output for formatting syntax see https://momentjs.com/docs/#/displaying/format/
 * @param  {String} timezone   The timezone to use if needing to translate the date to another timezone eg. Australia/Melbourne
 * @return {String}            A human readable string
 * @example
 *
 * let id = '5ca3d64dd2bb085eb9d450db'
 * return dateFromID.formatDate(id, 'D M YYYY')
 */
export function dateFromID(id, format, timezone) {
  id = getStringID(id)
  const date = new Date(parseInt(id.substring(0, 8), 16) * 1000)
  return formatDate(date, format, timezone)
}
/**
 * Checks whether an event spans over multiple days
 * @param  {Object} event A Fluro event object with a startDate and an endDate
 * @return {Boolean}            True or False if the event spans multiple days
 * @example
 *
 * return fluro.date.isMultiDayEvent({startDate:...})
 */
export function isMultiDayEvent(event) {
  let startDate
  let endDate

  if (!event) return

  if (event.startDate) {
    startDate = localDate(event.startDate, event.timezone)
  } else {
    return
  }
  if (!event.endDate) {
    return
  }
  endDate = localDate(event.endDate, event.timezone)
  startDate = moment(startDate)
  endDate = moment(endDate)

  return (
    String(startDate.format('D MMM YYYY')) !==
    String(endDate.format('D MMM YYYY'))
  )
}
/**
 * A helper function that can display a human-readable date for an event
 * taking into consideration the context of the current time, the event's start and end time.
 * This is often used as a string filter
 * and what is relevant
 * @alias date.readableEventDate
 * @param  {Object} event An object that has both a startDate and endDate property, Usually an event object from the Fluro API
 * @param  {String} style Whether to return a 'short', 'medium' or 'long' date
 * @return {String}       The human readable date for the event
 * @example
 * // Returns 5:30pm 1 May
 * fluro.date.readableEventDate({"startDate": "2019-05-01T07:30:00.000Z", "endDate":"2019-05-01T07:30:00.000Z"})
 * // Returns 5:30pm - 7:30pm 1 May
 * fluro.date.readableEventDate({"startDate": "2019-05-01T07:30:00.000Z", "endDate":"2019-05-01T09:30:00.000Z"})
 * // Returns 1 - 5 May 2015
 * fluro.date.readableEventDate({"startDate": "2015-05-01T07:30:00.000Z", "endDate":"2015-05-05T09:30:00.000Z"})
 * // 1 May - 21 Jun 2019
 * fluro.date.readableEventDate({"startDate": "2019-05-01T07:30:00.000Z", "endDate":"2019-06-21T09:30:00.000Z"})
 */
export function readableEventDate(event, style?) {
  let startDate
  let endDate

  if (!event) return

  if (event.startDate) {
    startDate = localDate(event.startDate, event.timezone)
  } else {
    return
  }
  if (event.endDate) {
    endDate = localDate(event.endDate, event.timezone)
  } else {
    endDate = startDate
  }
  const differentTimezone =
    event.timezone && isDifferentTimezoneThanUser(event.timezone)
  let appendage = ''
  if (differentTimezone) {
    appendage = `(${event.timezone})`
  }
  startDate = moment(startDate)
  endDate = moment(endDate)
  const noEndDate =
    startDate.format('h:mma D MMM YYYY') === endDate.format('h:mma D MMM YYYY')
  const sameYear = startDate.format('YYYY') === endDate.format('YYYY')
  const sameMonth = startDate.format('MMM YYYY') === endDate.format('MMM YYYY')
  const sameDay =
    startDate.format('D MMM YYYY') === endDate.format('D MMM YYYY')
  switch (style) {
    case 'short':
      if (noEndDate) {
        return `${startDate.format('D MMM')} ${appendage}`
      }
      if (sameDay) {
        // 8am - 9am Thursday 21 May 2016
        return `${startDate.format('D MMM')} ${appendage}`
      }
      if (sameMonth) {
        // 20 - 21 May 2016
        return `${
          startDate.format('D') + ' - ' + endDate.format('D MMM')
        } ${appendage}`
      }
      if (sameYear) {
        // 20 Aug - 21 Sep 2016
        return `${
          startDate.format('D') + ' - ' + endDate.format('D MMM')
        } ${appendage}`
      }
      // 20 Aug 2015 - 21 Sep 2016
      return `${
        startDate.format('D MMM Y') + ' - ' + endDate.format('D MMM Y')
      } ${appendage}`
      break
    case 'day':
      if (noEndDate) {
        return `${startDate.format('dddd D MMMM')} ${appendage}`
      }
      if (sameDay) {
        // 8am - 9am Thursday 21 May 2016
        return `${startDate.format('dddd D MMMM')} ${appendage}`
      }
      if (sameMonth) {
        // 20 - 21 May 2016
        return `${
          startDate.format('D') + ' - ' + endDate.format('D MMMM Y')
        } ${appendage}`
      }
      if (sameYear) {
        // 20 Aug - 21 Sep 2016
        return `${
          startDate.format('D MMM') + ' - ' + endDate.format('D MMM Y')
        } ${appendage}`
      }
      // 20 Aug 2015 - 21 Sep 2016
      return `${
        startDate.format('D MMM Y') + ' - ' + endDate.format('D MMM Y')
      } ${appendage}`
      break
    default:
      if (noEndDate) {
        return `${startDate.format('h:mma dddd D MMM Y')} ${appendage}`
      }
      if (sameDay) {
        // 8am - 9am Thursday 21 May 2016
        return `${
          startDate.format('h:mma') +
          ' - ' +
          endDate.format('h:mma dddd D MMM Y')
        } ${appendage}`
      }
      if (sameMonth) {
        // 20 - 21 May 2016
        return `${
          startDate.format('D') + ' - ' + endDate.format('D MMM Y')
        } ${appendage}`
      }
      if (sameYear) {
        // 20 Aug - 21 Sep 2016
        return `${
          startDate.format('D MMM') + ' - ' + endDate.format('D MMM Y')
        } ${appendage}`
      }
      // 20 Aug 2015 - 21 Sep 2016
      return `${
        startDate.format('D MMM Y') + ' - ' + endDate.format('D MMM Y')
      } ${appendage}`
      break
  }
}
/**
 * A helper function that can display a human-readable time for an event
 * taking into consideration the context of the current time, the event's start and end time.
 * This is often used as a string filter
 * @alias date.readableEventTime
 * @param  {Object} event An object that has both a startDate and endDate property, Usually an event object from the Fluro API
 * @return {String}       The human readable time for the event
 * @example
 * // Returns 5:30pm
 * fluro.date.readableEventTime({"startDate": "2019-05-01T07:30:00.000Z", "endDate":null})
 * // Returns 5:30pm - 7:30pm
 * fluro.date.readableEventTime({"startDate": "2019-05-01T07:30:00.000Z", "endDate":"2019-05-01T09:30:00.000Z"})
 */
export function readableEventTime(event) {
  let startDate
  let endDate

  if (!event) return

  if (event.startDate) {
    startDate = localDate(event.startDate, event.timezone)
  } else {
    return
  }
  if (event.endDate) {
    endDate = localDate(event.endDate, event.timezone)
  } else {
    endDate = startDate
  }
  startDate = moment(startDate)
  endDate = moment(endDate)
  const noEndDate =
    startDate.format('h:mma D MMM YYYY') === endDate.format('h:mma D MMM YYYY')
  const sameDay =
    startDate.format('D MMM YYYY') === endDate.format('D MMM YYYY')
  if (noEndDate) {
    return startDate.format('h:mma')
  }
  if (sameDay) {
    // 8am - 9am Thursday 21 May 2016
    return startDate.format('h:mma') + ' - ' + endDate.format('h:mma')
  }
  return readableEventDate(event)
}
/**
 * @alias date.groupEventByDate
 * @param  {Array} events The events we want to group
 * @return {Array}       A grouped array of dates and events
 */
export function groupEventByDate(events) {
  return chain(events)
    .reduce((set, row, index) => {
      let format = 'dddd D MMMM'

      // eslint-disable-next-line new-cap
      const startDate = new moment(
        row.startDate ||
          get(row, 'event.startDate') ||
          get(row, 'roster.event.startDate') ||
          row.created
      )
      const timezone =
        row.timezone ||
        get(row, 'event.timezone') ||
        get(row, 'roster.event.timezone')
      if (timezone) {
        startDate.tz(timezone)
      }

      // let startDate = row.startDate ? new moment(row.startDate) : new moment(row.created);
      if (moment().format('YYYY') !== startDate.format('YYYY')) {
        format = 'dddd D MMMM YYYY'
      }
      const groupingKey = startDate.format(format)
      let existing = set[groupingKey]
      if (!existing) {
        existing = set[groupingKey] = {
          title: groupingKey,
          items: [],
          index
        }
      }
      existing.items.push(row)
      return set
    }, {})
    .values()
    .orderBy('index')
    .value()
}
/**
 * @alias date.timeline
 * @param  {Array} items The items we want to group on the timeline
 * @return {Array}       A grouped array of dates
 */
export function timeline(items, dateKey, chronological) {
  if (!dateKey) {
    dateKey = 'created'
  }

  items = orderBy(items, (entry) => {
    const date = new Date(get(entry, dateKey))
    return date
  })

  if (chronological) {
    // Leave in the same order
  } else {
    items = items.reverse()
  }

  return chain(items)
    .reduce(
      (set, entry, index, options) => {
        const date = new Date(get(entry, dateKey))
        const valid = date instanceof Date && !isNaN(date.getTime())
        if (!valid) {
          return set
        }

        let dayKey
        let monthKey
        let yearKey
        const specifiedTimezone = options.timezone || entry.timezone
        if (
          specifiedTimezone &&
          isDifferentTimezoneThanUser(specifiedTimezone)
        ) {
          dayKey = `${moment(date).tz(specifiedTimezone).format('D MMM YYYY')}` // (${specifiedTimezone})`;
          monthKey = `${moment(date).tz(specifiedTimezone).format('MMM YYYY')}` // (${specifiedTimezone})`;
          yearKey = `${moment(date).tz(specifiedTimezone).format('YYYY')}` // (${specifiedTimezone})`;
        } else {
          dayKey = moment(date).format('D MMM YYYY')
          monthKey = moment(date).format('MMM YYYY')
          yearKey = moment(date).format('YYYY')
        }

        // Check if we already have an entry for this year
        let existingYear = set.lookup[yearKey]
        if (!existingYear) {
          existingYear = set.lookup[yearKey] = {
            date,
            months: []
          }
          // Add the year to our results
          set.years.push(existingYear)
        }

        // Check if we already have an entry for this month
        let existingMonth = set.lookup[monthKey]
        if (!existingMonth) {
          existingMonth = set.lookup[monthKey] = {
            date,
            days: []
          }
          existingYear.months.push(existingMonth)
        }

        // Check if we already have an entry for this month
        let existingDay = set.lookup[dayKey]
        if (!existingDay) {
          existingDay = set.lookup[dayKey] = {
            date,
            items: []
          }
          existingMonth.days.push(existingDay)
        }
        existingDay.items.push(entry)
        return set
      },
      { lookup: {}, years: [] }
    )
    .get('years')
    .value()
}
/**
 * A helper function that can return the pieces for a countdown clock relative to a specified date
 * @alias date.countdown
 * @param  {Date} date The date we are counting down to
 * @return {Object}       An object with days, minutes, hours, seconds,
 */
export function countdown(date, zeroPadded) {
  const now = new Date().getTime()

  const when = new Date(date).getTime()
  const milliseconds = when - now
  const oneSecond = 1000
  const oneMinute = oneSecond * 60
  const oneHour = oneMinute * 60
  const oneDay = oneHour * 24
  const seconds = (milliseconds % oneMinute) / oneSecond
  const minutes = Math.floor((milliseconds % oneHour) / oneMinute)
  const hours = Math.floor((milliseconds % oneDay) / oneHour)
  const days = Math.floor(milliseconds / oneDay)
  if (zeroPadded) {
    const pad = (input) => {
      input = Math.ceil(input)
      if (String(input).length === 1) {
        return `0${input}`
      }
      return String(input)
    }
    return {
      days: pad(days),
      minutes: pad(minutes),
      hours: pad(hours),
      seconds: pad(seconds)
    }
  }
  return {
    days,
    minutes,
    hours,
    seconds: Math.ceil(seconds)
  }
}

/**
 * @alias date
 * @classdesc A static service that provides useful functions for working with dates and timestamps.
 * @class
 * @hideconstructor
 */
const FluroDate = {
  defaultTimezone: DEFAULT_TIMEZONE,
  moment,
  timezones,
  militaryTimestamp,
  timestampToAmPm,
  currentTimezone,
  isDifferentTimezoneThanUser,
  localDate,
  getAge,
  formatDate,
  timeago,
  dateFromID,
  isMultiDayEvent,
  readableEventDate,
  readableEventTime,
  groupEventByDate,
  timeline,
  countdown
}

export default FluroDate
