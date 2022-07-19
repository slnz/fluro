const getAssetMediaIDFromURL = (url, type) => {
  const lowercase = String(url).toLowerCase()
  if (!type) {
    if (lowercase.includes('youtube')) {
      type = 'youtube'
    } else if (lowercase.includes('vimeo')) {
      type = 'vimeo'
    }
  }
  let mediaID
  switch (type) {
    case 'youtube':
      mediaID = getYouTubeIDFromURL(url)
      break
    case 'vimeo':
      mediaID = getVimeoIDFromURL(url)
      break
  }
  return mediaID
}
const getYouTubeIDFromURL = (url) => {
  if (!url || !url.length) {
    return
  }
  function contains(str, substr) {
    return str.indexOf(substr) > -1
  }
  function getParm(url, base) {
    const re = new RegExp('(\\?|&)' + base + '\\=([^&]*)(&|$)')
    const matches = url.match(re)
    if (matches) {
      return matches[2]
    } else {
      return ''
    }
  }
  let videoID
  if (url.indexOf('youtube.com/watch') !== -1) {
    videoID = getParm(url, 'v')
  } else {
    const youtubeRegexp =
      /https?:\/\/(?:[0-9A-Z-]+\.)?(?:youtu\.be\/|youtube(?:-nocookie)?\.com\S*[^\w\s-])([\w-]{11})(?=[^\w-]|$)(?![?=&+%\w.-]*(?:['"][^<>]*>|<\/a>))[?=&+%\w.-]*/gi
    // Get the id
    let YoutubeID = url.replace(youtubeRegexp, '$1')
    if (contains(YoutubeID, ';')) {
      const pieces = YoutubeID.split(';')
      if (contains(pieces[1], '%')) {
        // links like this:
        // "http://www.youtube.com/attribution_link?a=pxa6goHqzaA&amp;u=%2Fwatch%3Fv%3DdPdgx30w9sU%26feature%3Dshare"
        // have the real query string URI encoded behind a ';'.
        // at this point, `YoutubeID is 'pxa6goHqzaA;u=%2Fwatch%3Fv%3DdPdgx30w9sU%26feature%3Dshare'
        const uriComponent = decodeURIComponent(YoutubeID.split(';')[1])
        YoutubeID = ('https://youtube.com' + uriComponent).replace(
          youtubeRegexp,
          '$1'
        )
      } else {
        // https://www.youtube.com/watch?v=VbNF9X1waSc&amp;feature=youtu.be
        // `YoutubeID` looks like 'VbNF9X1waSc;feature=youtu.be' currently.
        // strip the ';feature=youtu.be'
        YoutubeID = pieces[0]
      }
    } else if (contains(YoutubeID, '#')) {
      // YoutubeID might look like '93LvTKF_jW0#t=1'
      // and we want '93LvTKF_jW0'
      YoutubeID = YoutubeID.split('#')[0]
    }
    videoID = YoutubeID
  }
  console.log('Video thumb', url)
  return videoID
}
const getVimeoIDFromURL = (url) => {
  if (!url || !url.length) {
    return
  }
  // Vimeo RegExp
  const reg =
    /https?:\/\/(?:www\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/([^/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)(?:$|\/|\?)/
  const match = url.match(reg)
  if (match) {
    return match[3]
  }
}
/**
 * @alias video.readableMilliseconds
 * @param  {Number} milliseconds The number of milliseconds to get duration for
 * @return {String}            The query string
 * @example
 * fluro.video.readableMilliseconds(100000)
 */
const readableMilliseconds = (milliseconds, withoutSuffix) => {
  const oneSecond = 1000
  const oneMinute = oneSecond * 60
  const oneHour = oneMinute * 60
  const oneDay = oneHour * 24
  const seconds = (milliseconds % oneMinute) / oneSecond
  const minutes = Math.floor((milliseconds % oneHour) / oneMinute)
  const hours = Math.floor((milliseconds % oneDay) / oneHour)
  const days = Math.floor(milliseconds / oneDay)
  let timeString = ''
  if (withoutSuffix) {
    if (days !== 0) {
      timeString += days !== 1 ? days + 'd ' : days + 'd '
    }
    if (hours !== 0) {
      timeString += hours !== 1 ? hours + 'h ' : hours + 'h '
    }
    if (minutes !== 0) {
      timeString += minutes !== 1 ? minutes + 'm ' : minutes + 'm '
    }
    if (seconds !== 0 || milliseconds < 1000) {
      timeString +=
        seconds !== 1 ? seconds.toFixed(0) + 's ' : seconds.toFixed(0) + 's '
    }
  } else {
    if (days !== 0) {
      timeString += days !== 1 ? days + ' days ' : days + ' day '
    }
    if (hours !== 0) {
      timeString += hours !== 1 ? hours + ' hrs ' : hours + 'hr '
    }
    if (minutes !== 0) {
      timeString += minutes !== 1 ? minutes + ' mins ' : minutes + 'min '
    }
    if (seconds !== 0 || milliseconds < 1000) {
      timeString +=
        seconds !== 1 ? seconds.toFixed(0) + 's ' : seconds.toFixed(0) + 's '
    }
  }
  return timeString
}
/**
 * @alias video.readableSeconds
 * @param  {Number} seconds The number of seconds to get duration for
 * @return {String}            The query string
 * @example
 * fluro.video.readableSeconds(10)
 */
const readableSeconds = (seconds, withoutSuffix) => {
  return readableMilliseconds(seconds * 1000, withoutSuffix)
  // let milliseconds = seconds * 1000;
  // let oneSecond = 1000;
  // let oneMinute = oneSecond * 60;
  // let oneHour = oneMinute * 60;
  // let oneDay = oneHour * 24;
  // let seconds = (milliseconds % oneMinute) / oneSecond;
  // let minutes = Math.floor((milliseconds % oneHour) / oneMinute);
  // let hours = Math.floor((milliseconds % oneDay) / oneHour);
  // let days = Math.floor(milliseconds / oneDay);
  // let timeString = '';
  // if (days !== 0) {
  //     timeString += (days !== 1) ? (days + ' days ') : (days + ' day ');
  // }
  // if (hours !== 0) {
  //     timeString += (hours !== 1) ? (hours + ' hrs ') : (hours + 'hr ');
  // }
  // if (minutes !== 0) {
  //     timeString += (minutes !== 1) ? (minutes + ' mins ') : (minutes + 'min ');
  // }
  // if (seconds !== 0 || milliseconds < 1000) {
  //     timeString += (seconds !== 1) ? (seconds.toFixed(1) + 's ') : (seconds.toFixed(1) + 's ');
  // }
  // return timeString;
}
/**
 * @alias video.hhmmss
 * @param  {Number} seconds The number of seconds to get duration for
 * @return {String}            The query string
 * @example
 * // Returns 01:02:00
 * fluro.video.hhmmss(62)
 */
const hhmmss = (secs) => {
  function secToTimer(sec) {
    const o = new Date(0)
    const p = new Date(sec * 1000)
    return new Date(p.getTime() - o.getTime())
      .toISOString()
      .split('T')[1]
      .split('Z')[0]
  }
  return secToTimer(secs).split('.')[0]
  // function pad(str) {
  //     return ("0" + str).slice(-2);
  // }
  // // function hhmmss(secs) {
  // let minutes = Math.floor(secs / 60);
  // secs = secs % 60;
  // let hours = Math.floor(minutes / 60)
  // minutes = minutes % 60;
  // return pad(hours) + ":" + pad(minutes) + ":" + pad(secs);
  // return pad(minutes)+":"+pad(secs);
  // }
  // return hhmmss(seconds);
}

const FluroVideo = {
  getAssetMediaIDFromURL,
  getYouTubeIDFromURL,
  getVimeoIDFromURL,
  readableMilliseconds,
  readableSeconds,
  hhmmss
}

export default FluroVideo
