import { startsWith } from 'lodash'

import type FluroCore from './fluro.core'

/**
 * Creates a new FluroAsset instance. This module provides a number of helper
 * functions for managing asset, image, video and audio items in Fluro
 * @alias asset
 * @constructor
 * @hideconstructor
 * @param {FluroCore} fluro A reference to the parent instance of the FluroCore
 * module. The FluroAsset module is usually created by a FluroCore instance that
 * passes itself in as the first argument.
 */
export default class FluroAsset {
  isRetina = false
  defaultWindowSettings = {
    screen: {
      width: 1920,
      height: 1080
    }
  }

  constructor(private core: FluroCore) {
    if (window) {
      this.defaultWindowSettings = window
      this.isRetina = window.devicePixelRatio > 1
    }
  }

  private parameterDefaults(url, params) {
    // If an extension was provided add it to the url
    if (params.extension && params.extension.length) {
      if (params.title && params.title.length) {
        url += `/file/${params.title}.${params.extension}`
        delete params.title
      } else {
        if (params.filename && params.filename.length) {
          url += `/file/${params.filename}.${params.extension}`
          delete params.filename
        } else {
          url += `/file/file.${params.extension}`
        }
      }
      // Dont need to include it anymore
      delete params.extension
    } else {
      if (params.filename && params.filename.length) {
        url += `/file/${params.filename}`
        delete params.filename
      }
    }

    // If we haven't requested without token
    if (!params.withoutToken) {
      // Get the current token from FluroAuth
      const CurrentFluroToken = this.core.auth.getCurrentToken()
      // Check to see if we have a token and none has been explicity set
      if (!params.access_token && CurrentFluroToken) {
        // Use the current token by default
        params.access_token = CurrentFluroToken
      }
    }

    if (this.core.app && this.core.app.uuid) {
      params.did = this.core.app.uuid
    }
    return url
  }

  /**
   *
   * This function generates a url for the binary data of an
   * asset, image, audio, or video file that has been uploaded to Fluro
   * @alias asset.getUrl
   * @param  {string} assetID The _id of the item you want to retrieve
   * @param  {object} params
   * @return {string}         A valid Fluro URL
   * @example
   * // 'https://api.this.core.io/get/5be504eabf33991239599d63'
   * Fluro.asset.getUrl('5be504eabf33991239599d63')
   *
   * // 'https://api.this.core.io/get/5be504eabf33991239599d63/file/MyFile.pdf'
   * Fluro.asset.getUrl('5be504eabf33991239599d63', {filename:'MyFile.pdf'})
   */
  getUrl(assetID, params) {
    // Get the asset id as a pure string
    assetID = this.core.utils.getStringID(assetID)
    if (!assetID || !String(assetID).length) {
      return
    }
    if (!params) {
      params = {}
    }
    let url = `${this.core.apiURL}/get/${assetID}`

    url = this.parameterDefaults(url, params)

    // Map the parameters to a query string
    const queryParameters = this.core.utils.mapParameters(params)
    if (queryParameters.length) {
      url += '?' + queryParameters
    }
    return url
  }

  /**
   *
   * This function generates a player url for a video file that has been
   * uploaded to Fluro/ This is useful to force browsers to renderer a html5
   * video player instead of downloading the video file on desktop
   * @alias asset.playerUrl
   * @param  {string} videoID The _id of the video you want to play
   * @param  {object} params
   * @return {string}         A valid Fluro URL
   * @example
   * // 'https://api.this.core.io/get/player?url=https://api.this.core.io/get/5be504eabf33991239599d63'
   * Fluro.asset.playerUrl('5be504eabf33991239599d63')
   */
  playerUrl(videoID, params) {
    // Get the asset id as a pure string
    videoID = this.core.utils.getStringID(videoID)
    if (!videoID || !String(videoID).length) {
      return
    }
    if (!params) {
      params = {}
    }
    let url = `${this.core.apiURL}/get/player?url=${this.core.apiURL}/get/${videoID}`

    url = this.parameterDefaults(url, params)

    // Map the parameters to a query string
    const queryParameters = this.core.utils.mapParameters(params)
    if (queryParameters.length) {
      url += '?' + queryParameters
    }
    return url
  }

  /**
   * A helper function to generate a url for retrieving a user, persona or contact's avatar
   * @alias asset.avatarUrl
   * @param  {string} personID The id of the person you want to retrieve the avatar for
   * @param  {string} style    Can be 'contact', 'persona' or 'user'
   * @param  {object} params
   * @param  {number} params.w The width of the image you are requesting from Fluro
   * @param  {number} params.h The height of the image you are requesting from Fluro
   * @return {string}          A full URL that links to the image the user is requesting
   * @example
   * // 'https://api.this.core.io/get/avatar/contact/5be504eabf33991239599d63?w=100&h=100'
   * Fluro.asset.avatarUrl('5be504eabf33991239599d63', 'contact', {w:100, h:100})
   *
   */
  avatarUrl(personID, style, params) {
    // Get the id as a pure string
    personID = this.core.utils.getStringID(personID)
    if (!personID || !String(personID).length) {
      return
    }
    if (!params) {
      params = {}
    }
    if (!style) {
      style = 'contact'
    }
    let url = `${this.core.apiURL}/get/avatar/${style}/${personID}`

    url = this.parameterDefaults(url, params)

    // Map the parameters to a query string
    const queryParameters = this.core.utils.mapParameters(params)
    if (queryParameters.length) {
      url += '?' + queryParameters
    }
    return url
  }

  /**
   * A helper function to retrieve the main image for an event, group, realm or other content
   * @alias asset.coverUrl
   * @param  {string} contentID The id of the item you want to retrieve the image for
   * @param  {string} style    Can be 'event', 'group', 'tag' or 'realm'
   * @param  {object} params
   * @param  {number} params.w The width of the image to request from Fluro
   * @param  {number} params.h The height of the image to request from Fluro
   * @return {string}          A full URL that links to the image the user is requesting
   * @example
   * // returns 'https://api.this.core.io/get/event/5be504eabf33991239599d63?w=100&h=100'
   * Fluro.asset.coverUrl('5be504eabf33991239599d63', 'event', {w:100, h:100})
   *
   */
  // Get the cover image for an event, group or realm
  coverUrl(contentID, style, params) {
    // Get the id as a pure string
    contentID = this.core.utils.getStringID(contentID)
    if (!contentID || !String(contentID).length) {
      return
    }
    if (!params) {
      params = {}
    }
    if (!style) {
      style = 'event'
    }
    let url = `${this.core.apiURL}/get/${style}/${contentID}`

    url = this.parameterDefaults(url, params)

    // Map the parameters to a query string
    const queryParameters = this.core.utils.mapParameters(params)
    if (queryParameters.length) {
      url += '?' + queryParameters
    }
    return url
  }

  coverImage(contentID, style, params) {
    this.coverUrl(contentID, style, params)
  }

  /**
   * A helper function that returns a download url for a specific asset
   * @param  {string} assetID The id of the asset, or the asset object you want to download
   * @alias asset.downloadUrl
   * @param  {object} params
   * @param  {string} params.filename The filename you want to download the file as
   * @param  {string} params.extension The extension of the file you want to download, eg. 'pdf'
   * @return {string}          A full URL that will download the file
   * @example
   * // returns 'https://api.this.core.io/download/5be504eabf33991239599d63'
   * Fluro.asset.downloadUrl('5be504eabf33991239599d63')
   *
   * // returns 'https://api.this.core.io/download/5be504eabf33991239599d63/file/MyFile.docx'
   * Fluro.asset.downloadUrl('5be504eabf33991239599d63', {filename:'MyFile.docx'})
   *
   */
  downloadUrl(assetID, params) {
    // Get the id as a pure string
    assetID = this.core.utils.getStringID(assetID)
    if (!assetID || !String(assetID).length) {
      return
    }
    if (!params) {
      params = {}
    }
    let url = `${this.core.apiURL}/download/${assetID}`

    url = this.parameterDefaults(url, params)

    // Map the parameters to a query string
    const queryParameters = this.core.utils.mapParameters(params)
    if (queryParameters.length) {
      url += '?' + queryParameters
    }
    return url
  }

  /**
   * A helper function that returns what type of content Fluro will attribute a specified mimetype to
   * @alias asset.typeFromMime
   * @param  {string} mimetype The mimetype of a file
   * @return {string}          Whether this mimetype is an 'asset', 'video', 'image', or 'audio' file
   * @example
   * // returns 'audio'
   * Fluro.asset.typeFromMime('audio/aac')
   * // returns 'video'
   * Fluro.asset.typeFromMime('video/ogg')
   * // returns 'asset'
   * Fluro.asset.typeFromMime('application/pdf')
   *
   */
  typeFromMime(mimetype) {
    switch (mimetype) {
      case 'image/jpeg':
      case 'image/png':
      case 'image/gif':
      case 'image/bmp':
      case 'image/svg+xml':
        return 'image'
        break
      case 'video/mp4':
      case 'video/quicktime':
      case 'video/ogg':
      case 'video/webm':
        return 'video'
        break
      case 'audio/aac':
      case 'audio/aiff':
      case 'audio/mp3':
      case 'audio/x-m4a':
      case 'audio/mpeg':
      case 'audio/ogg':
      case 'audio/wav':
      case 'audio/webm':
        return 'audio'
        break
      default:
        // if(_.startsWith(mimetype, 'image/')) {
        //  return 'image';
        // }
        if (startsWith(mimetype, 'video/')) {
          return 'video'
        }
        if (startsWith(mimetype, 'audio/')) {
          return 'audio'
        }
        break
    }
    return 'asset'
  }

  /**
   * A helper function that returns a poster image for a specified video
   * @alias asset.posterUrl
   * @param  {string} videoID The id of the video, or a video object that has an _id property
   * @param  {number} width The width of the poster image. If none specified will default to 16:9 based on the requesting user's screen size
   * @param  {number} height The height of the poster image. If none specified will default to 16:9 based on the requesting user's screen size
   * @param  {object} params
   * @return {string}          A full URL of the poster image
   * @example
   * // returns 'https://api.this.core.io/get/poster/5be504eabf33991239599d63?w=1920&h=1080'
   * Fluro.asset.posterUrl('5be504eabf33991239599d63', 1920, 1080)
   *
   * // returns 'https://api.this.core.io/get/poster/5be504eabf33991239599d63/file/file.jpg?w=1920&h=1080'
   * Fluro.asset.posterUrl('5be504eabf33991239599d63', 1920, 1080, {extension:'jpg'})
   *
   * // Not providing a height property will default to 16:9 ratio inferred from the width
   * // returns 'https://api.this.core.io/get/poster/5be504eabf33991239599d63/file/MyPoster.jpg?w=1920&h=1080'
   * Fluro.asset.posterUrl('5be504eabf33991239599d63', 1920, null, {filename:'MyPoster.jpg'})
   *
   *
   */
  // Helper function for retrieving the poster image for a video
  posterUrl(videoID, w, h, params) {
    // Get the id as a pure string
    videoID = this.core.utils.getStringID(videoID)
    if (!videoID || !String(videoID).length) {
      return
    }
    if (!params) {
      params = {}
    }
    const reducer = 0.5
    const screenWidth = this.defaultWindowSettings.screen.width || 1920
    // Setup our usual width limit
    let limitWidth
    // By default, limit the width
    if (this.isRetina) {
      limitWidth = 1920 * reducer
    } else {
      limitWidth = 1200 * reducer
    }
    // If the screen is smaller then 768 use an optimised image
    if (screenWidth <= 768) {
      if (this.isRetina) {
        limitWidth = 1536 * reducer
      } else {
        limitWidth = 768 * reducer
      }
    }
    // If using mobile then use a smaller optimised image
    if (screenWidth <= 320) {
      if (this.isRetina) {
        limitWidth = 640 * reducer
      } else {
        limitWidth = 320 * reducer
      }
    }
    // If no width or height was specified
    if (!w && !h) {
      // Use our default width based on screen size
      params.w = limitWidth
      params.h = Math.round(limitWidth * (9 / 16))
    } else {
      // If a width was specified
      if (w) {
        params.w = w
        if (!h) {
          // If no height specified calculate based on aspect ratio
          params.h = Math.round(w * (9 / 16))
        }
      }
      // If a height was specified
      if (h) {
        params.h = h
      }
    }
    // eslint-disable-next-line no-prototype-builtins
    if (!params.hasOwnProperty('quality')) {
      params.quality = 80
    }
    // Create the basic url
    let url = `${this.core.apiURL}/get/${videoID}/poster`

    url = this.parameterDefaults(url, params)

    // Map the parameters to a query string
    const queryParameters = this.core.utils.mapParameters(params)
    if (queryParameters.length) {
      url += '?' + queryParameters
    }

    return url
  }

  /**
   * A helper function that creates a url image for a specified image
   * @alias asset.imageUrl
   * @param  {string} imageID The id of the image or an object representing the image that has an _id property
   * @param  {Integer} width The width of the image to retrieve from this.core. If none is specified then will default to a size based on the requesting user's screen dimensions.
   * @param  {Integer} height The height of the image to retrieve from this.core. If none is specified then will default to a size based on the requesting user's screen dimensions.
   * @param  {object} params
   * @param  {Integer} params.quality The quality of the image to retrieve from Fluro as a percent eg. 85
   * @param  {String} params.filename The filename to use for the image url
   * @param  {String} params.extension An extension to use for the url if no filename is specified
   * @return {string}          A full URL of the image
   * @example
   * // returns 'https://api.this.core.io/get/5be504eabf33991239599d63?w=800'
   * Fluro.asset.imageUrl('5be504eabf33991239599d63', 800)
   *
   * // returns 'https://api.this.core.io/get/5be504eabf33991239599d63/file/image.jpg?w=800'
   * Fluro.asset.imageUrl('5be504eabf33991239599d63', 800, null, {filename:'MyFile.pdf'})
   */
  // Helper function for retrieving the poster image for a video
  imageUrl(imageID, w, h, params) {
    // Get the id as a pure string
    imageID = this.core.utils.getStringID(imageID)
    if (!imageID || !String(imageID).length) {
      return
    }
    if (!params) {
      params = {}
    }
    // Create the basic url
    let url = this.core.apiURL + '/get/' + imageID
    // Setup our usual width limit
    let limitWidth
    // By default, limit the width
    if (this.isRetina) {
      limitWidth = 1920
    } else {
      limitWidth = 1200
    }
    // If the screen is smaller then 768 use an optimised image
    if (this.defaultWindowSettings.screen.width <= 768) {
      if (this.isRetina) {
        limitWidth = 1536
      } else {
        limitWidth = 768
      }
    }
    // If using mobile then use a smaller optimised image
    if (this.defaultWindowSettings.screen.width <= 320) {
      if (this.isRetina) {
        limitWidth = 640
      } else {
        limitWidth = 320
      }
    }

    // If no width or height was specified
    if (!w && !h) {
      // Use our default limits
      params.w = limitWidth
    } else {
      // If a width was specified
      if (w) {
        params.w = w
      }
      // If a height was specified
      if (h) {
        params.h = h
      }
    }

    // Default to 90% quality huge compression gains
    if (!params.quality) {
      params.quality = 90
    }

    url = this.parameterDefaults(url, params)

    // Map the parameters to a query string
    const queryParameters = this.core.utils.mapParameters(params)
    if (queryParameters.length) {
      url += '?' + queryParameters
    }

    return url
  }

  /**
   * Helper function to translate bytes into a human readable format
   * @alias asset.filesize
   * @param  {Integer} bytes The number of bytes
   * @return {String}       The human readable filesize
   * @example
   * // returns '1mb'
   * Fluro.asset.filesize(1000000)
   */
  filesize(bytes) {
    const sizes = ['Bytes', 'kb', 'mb', 'gb', 'tb']
    if (bytes === 0) return '0 Byte'
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)).toString())
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + '' + sizes[i]
  }
}
