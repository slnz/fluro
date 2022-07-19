import { AxiosRequestConfig } from 'axios'
import { assign, get, noop } from 'lodash'

import type FluroCore from './fluro.core'
import FluroDispatcher from './fluro.dispatcher'

/**
 * Creates a new FluroAuth instance.
 * This module provides a number of helper functions for authentication, logging in, signing up, generating and refreshing tokens
 * @alias auth
 * @constructor
 * @hideconstructor
 * @param {FluroCore} fluro A reference to the parent instance of the FluroCore module. This module is usually created by a FluroCore instance that passes itself in as the first argument.
 */
export default class FluroAuth {
  debug = false
  inflightRefreshRequest: Promise<string>
  store
  nonAppRefreshContext: { inflightRefreshRequest?: Promise<string> } = {}
  appRefreshContext: { inflightRefreshRequest?: Promise<string> } = {}
  retryCount = 0
  dispatcher

  constructor(private core: FluroCore, private onChange?) {
    if (!this.core.api) {
      throw new Error(`Can't Instantiate FluroAuth before FluroAPI exists`)
    }
    // Create a new dispatcher
    this.dispatcher = new FluroDispatcher()
    this.dispatcher.bootstrap(this)
    const defaultStore = {}
    this.store = defaultStore

    Object.defineProperty(this, 'store', {
      value: this.store,
      writable: false
    })

    this.core.api.interceptors.request.use(
      (
        config: AxiosRequestConfig & {
          bypassInterceptor?: boolean
          application?: object
        }
      ) => {
        // If we want to bypass the interceptor
        // then just return the request
        if (config.bypassInterceptor) {
          console.log('auth interceptor was bypassed')
          return config
        }

        // Get the original request
        const originalRequest = config
        // If we aren't logged in or don't have a token
        let token
        let refreshToken
        const applicationToken = this.core.applicationToken

        // If we are running in an application context
        if (config.application || this.core.GLOBAL_AUTH) {
          token = get(this.core, 'app.user.token')
          refreshToken = get(this.core, 'app.user.refreshToken')
        } else {
          // Get the token and refresh token
          token = get(this.store, 'user.token')
          refreshToken = get(this.store, 'user.refreshToken')
        }

        // If there is a user token
        if (token) {
          // Set the token of the request as the user's access token
          originalRequest.headers.Authorization = 'Bearer ' + token
          this.log('this.core.auth > using user token')
        } else if (applicationToken && applicationToken.length) {
          // If there is a static application token
          // For example we have logged out from a website
          // that has public content also
          originalRequest.headers.Authorization = 'Bearer ' + applicationToken
          this.log('this.core.auth > using app token')
          return originalRequest
        } else {
          // Return the original request without a token
          this.log('this.core.auth > no token')
          return originalRequest
        }
        // If no refresh token
        if (!refreshToken) {
          this.log('this.core.auth > no refresh token')
          // Continue with the original request
          return originalRequest
        }
        // We have a refresh token so we need to check
        // whether our access token is stale and needs to be refreshed
        const now = new Date()
        // Give us a bit of buffer incase some of our images
        // are still loading
        now.setSeconds(now.getSeconds() + 10)
        let expiryDate
        if (config.application || this.core.GLOBAL_AUTH) {
          expiryDate = get(this.core, 'app.user.expires')
        } else {
          expiryDate = get(this.store, 'user.expires')
        }
        const expires = new Date(expiryDate)
        // If we are not debugging
        if (this.debug) {
          console.log('debug', now, expires)
        } else {
          // If the token is still fresh
          if (now < expires) {
            // Return the original request
            return originalRequest
          }
        }
        let isManagedUser =
          config.application ||
          get(this.store, 'user.accountType') === 'managed'
        if (this.core.GLOBAL_AUTH) {
          isManagedUser = false
        }
        // The token is stale by this point
        this.log('this.core.auth > token expired')
        return new Promise((resolve, reject) => {
          // Refresh the token
          this.refreshAccessToken(
            refreshToken,
            isManagedUser,
            config.application
          )
            .then((newToken) => {
              this.log('this.core.auth > token refreshed', isManagedUser)
              // Update the original request with our new token
              originalRequest.headers.Authorization = 'Bearer ' + newToken
              // And continue onward
              return resolve(originalRequest)
            })
            .catch((err) => {
              console.log('ERRRRRR', err)
              this.log('this.core.auth > token refresh rejected', err)
              return reject(err)
            })
        })
      },
      (error) => {
        return Promise.reject(error)
      }
    )
    this.core.api.interceptors.response.use(
      (response) => {
        return response
      },
      (err) => {
        // Get the response status
        const status = get(err, 'response.status') || err.status
        this.log('this.core.auth > error', status)
        switch (status) {
          case 401:
            console.log('ERROR CAPTURE HERE', err.response, err.config)
            // If we are running in an application context
            if (get(err, 'config.application') || this.core.GLOBAL_AUTH) {
              // Kill our app user store
              if (this.core.app) {
                this.core.app.user = null
              }
              return Promise.reject(err)
            }
            // // If it's an invalid refresh token
            // // In case it was a mismatch between tabs or sessions
            // // we should try it a second time just in case
            // let data = _.get(err, 'response.data');
            // if (data === 'invalid_refresh_token') {
            //     // Try it again
            //                 // } else {
            //     // Logout and destroy the session
            // }
            console.log('logout from 401')
            this.logout()
            break
          default:
            // Some other error
            break
        }
        return Promise.reject(err)
      }
    )
  }

  private dispatch(parameters?) {
    // Get the current user
    const user = this.store.user
    // Dispatch the change to the listeners
    if (this.onChange) {
      this.onChange(user)
    }
    // Dispatch the change event
    this.dispatcher.dispatch('change', user, parameters)
  }

  private log(...message) {
    if (this.debug) {
      console.log(...message)
    }
  }

  /**
   *
   * Sets the current user data, often from localStorage or after new session data
   * has been generated from the server after signing in
   * @alias auth.set
   * @param  {Object} user The user session object
   * @example
   * FluroAsset.set({firstName:'Jeff', lastName:'Andrews', ...})
   */
  set(user, parameters?) {
    this.store.user = user
    this.log('this.core.auth > user set')
    return this.dispatch(parameters)
  }

  /**
   *
   * Deletes the user session object, clears all Fluro caches and tokens
   * from memory
   * @alias auth.logout
   * @example
   * this.core.auth.logout()
   */
  logout() {
    // Unauthenticated
    // delete store.token;
    delete this.store.user
    this.core.cache.reset()
    // delete store.refreshToken;
    // delete store.expires;
    this.log('this.core.auth > user logout')
    // if(window && window.localStorage) {
    //    window.localStorage.removeItem('this.core.user');
    // }
    return this.dispatch()
  }

  /**
   *
   * Retrieves a new session object for a Fluro global user for a specified account
   * This will only work if the user has a persona in that account
   * @alias auth.changeAccount
   * @param  {String} accountID The _id of the account you wish to log in to
   * @param  {Object} options
   * @param  {Object} options.disableAutoAuthenticate By default this function will set the current user session
   * to account you are changing in to.
   * If you want to generate the session without affecting your current session you can set disableAutoAuthenticate to true
   * @return {Promise} Resolves to the user session object, or rejects with the responding error
   * @example
   * this.core.auth.changeAccount('5be504eabf33991239599d63').then(function(userSession) {
   *     // New user session will be set automatically
   *     let newUserSession = this.core.auth.getCurrentUser();
   * })
   * this.core.auth.changeAccount('5be504eabf33991239599d63', {disableAutoAuthenticate:true}).then(function(userSession) {
   *     // Set the session manually
   *     this.core.auth.set(userSession)
   * })
   */
  changeAccount(accountID, options) {
    // Ensure we just have the ID
    accountID = this.core.utils.getStringID(accountID)
    if (!options) {
      options = {}
    }
    // Change the users current tokens straight away
    let autoAuthenticate = true
    if (options.disableAutoAuthenticate) {
      autoAuthenticate = false
    }
    const promise = this.core.api.post(`/token/account/${accountID}`)
    promise.then((res) => {
      if (autoAuthenticate) {
        this.core.cache.reset()
        this.set(res.data)
      }
    }, noop)
    return promise
  }

  /**
   *
   * Impersonates a persona and sets the current session to match the specified persona's context
   * @alias auth.impersonate
   * @param  {String} personaID The _id of the persona you wish to impersonate
   * @param  {Object} options
   * @return {Promise} Resolves to the user session object, or rejects with the responding error
   * @example
   * this.core.auth.impersonate('5be504eabf33991239599d63')
   * .then(function(userSession) {
   *     // New user session will be set automatically
   *     let newUserSession = this.core.auth.getCurrentUser();
   * })
   */
  impersonate(personaID, options) {
    // Ensure we just have the ID
    personaID = this.core.utils.getStringID(personaID)
    if (!options) {
      options = {}
    }
    // Change the users current tokens straight away
    let autoAuthenticate = true
    if (options.disableAutoAuthenticate) {
      autoAuthenticate = false
    }
    const promise = this.core.api.post(`/token/persona/${personaID}`)
    promise.then((res) => {
      if (autoAuthenticate) {
        this.core.cache.reset()
        this.set(res.data)
      }
    }, noop)
    return promise
  }

  /**
   * Logs the user in to Fluro and returns a new user session
   * @alias auth.login
   * @param  {Object} credentials
   * @param  {String} credentials.username The email address of the user to login as
   * @param  {String} credentials.password The password for the user
   * @param  {Object} options     Extra options and configuration for the request
   * @param  {Object} options.disableAutoAuthenticate Disable automatic authentication, if true, will not set the current user session
   * @param  {Object} options.application Whether to attempt to login to the current application as a managed user persona, if not set will login as a global Fluro user
   * @return {Promise}             Returns a promise that either resolves with the logged in user session, or rejects with the responding error from the server
   */
  login(credentials, options) {
    if (!options) {
      options = {}
    }
    // Change the users current tokens straight away
    let autoAuthenticate = true
    if (options.disableAutoAuthenticate) {
      autoAuthenticate = false
    }
    const promise = new Promise((resolve, reject) => {
      if (!credentials) {
        return reject(new Error('Missing credentials!'))
      }
      if (!credentials.username || !credentials.username.length) {
        return reject(new Error('Username was not provided'))
      }
      if (!credentials.password || !credentials.password.length) {
        return reject(new Error('Password was not provided'))
      }

      const postOptions = {
        bypassInterceptor: true
      } as unknown as AxiosRequestConfig

      let url = this.core.apiURL + '/token/login'

      // If we are authenticating as an application
      if (options.application) {
        // The url is relative to the domain
        url = `${this.core.domain || ''}/fluro/application/login`
      }

      // If we are logging in to a managed account use a different endpoint
      if (options.managedAccount) {
        url = this.core.apiURL + '/managed/' + options.managedAccount + '/login'
      }
      // If we have a specified url
      if (options.url) {
        url = options.url
      }

      this.core.api.post(url, credentials, postOptions).then((res) => {
        if (autoAuthenticate) {
          this.store.user = res.data
          this.dispatch()
          // if (this.onChange) {
          //     this.onChange(store.user);
          // }
        }
        resolve(res)
      }, reject)
    })
    return promise
  }

  /**
   * Signs up a new user to the current application, this will create a new managed user persona
   * and automatically log in as that persona in the current application context. This function will
   * only work when called in context of an application with the 'Application Token' authentication style.
   * It will create a new user persona in the account of the application and return a session with all of the application's
   * permissions and application's logged in user permissions
   * @alias auth.signup
   * @param  {Object} credentials
   * @param  {String} credentials.firstName The first name for the new user persona
   * @param  {String} credentials.lastName The last name for the new user persona
   * @param  {String} credentials.username The email address for the new persona
   * @param  {String} credentials.password The password to set for the new persona
   * @param  {String} credentials.confirmPassword A double check to confirm the new password for the persona
   * @param  {Object} options     Extra options and configuration for the request
   * @return {Promise}            Returns a promise that either resolves to the new authenticated session, or rejects with the responding error from the server
   */
  signup(credentials, options) {
    if (!options) {
      options = {}
    }
    // Change the users current tokens straight away
    let autoAuthenticate = true
    if (options.disableAutoAuthenticate) {
      autoAuthenticate = false
    }
    const promise = new Promise((resolve, reject) => {
      if (!credentials) {
        return reject(new Error('No details provided'))
      }
      if (!credentials.firstName || !credentials.firstName.length) {
        return reject(new Error('First Name was not provided'))
      }
      if (!credentials.lastName || !credentials.lastName.length) {
        return reject(new Error('Last Name was not provided'))
      }
      if (!credentials.username || !credentials.username.length) {
        return reject(new Error('Email/Username was not provided'))
      }
      if (!credentials.password || !credentials.password.length) {
        return reject(new Error('Password was not provided'))
      }
      if (!credentials.confirmPassword || !credentials.confirmPassword.length) {
        return reject(new Error('Confirm Password was not provided'))
      }
      if (credentials.confirmPassword !== credentials.password) {
        return reject(new Error('Your passwords do not match'))
      }

      const postOptions = {
        bypassInterceptor: true
      } as unknown as AxiosRequestConfig

      let url = this.core.apiURL + '/user/signup'

      // If we are authenticating as an application
      if (options.application) {
        // The url is relative to the domain
        url = `${this.core.domain || ''}/fluro/application/signup`
      }
      // If we have a specified url
      if (options.url) {
        url = options.url
      }

      this.core.api.post(url, credentials, postOptions).then((res) => {
        if (autoAuthenticate) {
          this.store.user = res.data
          this.dispatch()
        }
        resolve(res)
      }, reject)
    })
    return promise
  }

  /**
   * Retrieves a user's details by providing a password reset token
   * @alias auth.retrieveUserFromResetToken
   * @param  {String} token The password reset token that was sent to the user's email address
   * @param  {Object} options other options for the request
   * @param  {Boolean} options.application     If true will retrieve in the context of a managed persona in the same account as the current application.
   * If not specified or false, will assume it's a Fluro global user that is resetting their password.
   * @return {Promise}            Returns a promise that resolves with the reset session details
   */
  retrieveUserFromResetToken(token, options) {
    if (!options) {
      options = {}
    }
    return new Promise((resolve, reject) => {
      const postOptions = {
        bypassInterceptor: true
      } as unknown as AxiosRequestConfig

      // If a full fledged Fluro User
      // then send directly to the API auth endpoint
      let url = `${this.core.apiURL}/auth/token/${token}`

      // If we are authenticating as an application
      if (options.application) {
        // The url is relative to the domain
        url = `${this.core.domain || ''}/fluro/application/reset/${token}`
      }
      // If we have a specified url
      if (options.url) {
        url = options.url
      }

      this.core.api.get(url, postOptions).then((res) => {
        return resolve(res.data)
      }, reject)
    })
  }

  /**
   * Updates a user's details including password by providing a password reset token
   * @alias auth.updateUserWithToken
   * @param  {String} token The password reset token that was sent to the user's email address
   * @param  {Object} body The details to change for the user
   * @param  {Object} options other options for the request
   * @return {Promise}            Returns a promise that resolves with the reset session details
   */
  updateUserWithToken(token, body, options) {
    if (!options) {
      options = {}
    }
    // Change the users current tokens straight away
    let autoAuthenticate = true
    if (options.disableAutoAuthenticate) {
      autoAuthenticate = false
    }
    return new Promise((resolve, reject) => {
      const postOptions = {
        bypassInterceptor: true
      } as unknown as AxiosRequestConfig

      // If a full fledged Fluro User
      // then send directly to the API auth endpoint
      let url = `${this.core.apiURL}/auth/token/${token}`

      // If we are authenticating as an application
      if (options.application) {
        // The url is relative to the domain
        url = `${this.core.domain || ''}/fluro/application/reset/${token}`
      }
      // If we have a specified url
      if (options.url) {
        url = options.url
      }

      this.core.api.post(url, body, postOptions).then((res) => {
        // If we should automatically authenticate
        // once the request is successful
        // Then clear caches and update the session
        if (autoAuthenticate) {
          this.core.cache.reset()
          this.set(res.data)
        }
        return resolve(res.data)
      }, reject)
    })
  }

  /**
   * Triggers a new Reset Password email request to the specified user.
   * @alias auth.sendResetPasswordRequest
   * @param  {Object} body
   * @param  {String} body.username The email address of the user to reset the password for
   * @param  {String} body.redirect If the request is in the context of a managed user persona authenticated with an application, then you need to provide the url to direct the user to when they click the reset password link
   * This is usually something like '/reset' for the current application, when the user clicks the link the reset token will be appended with ?token=RESET_TOKEN and your application should
   * be ready on that url to handle the token and allow the user to use the token to reset their password
   * @param  {Object} options     Extra options and configuration for the request
   * @param  {Boolean} options.application     If true will send a reset email from the context of a managed persona in the same account as the current application.
   * If not specified or false, will send a password reset request for a global Fluro user account.
   * @return {Promise}            Returns a promise that either resolves if the password request was sent, or rejects if an error occurred
   */
  sendResetPasswordRequest(body, options) {
    if (!options) {
      options = {}
    }
    const promise = new Promise((resolve, reject) => {
      if (!body) {
        return reject(new Error('No details provided'))
      }
      if (!body.username || !body.username.length) {
        return reject(new Error('Email/Username was not provided'))
      }
      // Set username as the email address
      body.email = body.username

      const postOptions = {
        bypassInterceptor: true
      } as unknown as AxiosRequestConfig

      // If a full fledged Fluro User
      // then send directly to the API
      let url = this.core.apiURL + '/auth/resend'

      // If we are authenticating as an application
      if (options.application) {
        // The url is relative to the domain
        url = `${this.core.domain || ''}/fluro/application/forgot`
      }
      // If we have a specified url
      if (options.url) {
        url = options.url
      }

      this.core.api.post(url, body, postOptions).then(resolve, reject)
    })
    return promise
  }

  /**
   * Helper function to refresh an access token for an authenticated user session. This is usually handled automatically
   * from the FluroAuth this itself
   * @alias auth.refreshAccessToken
   * @param  {String}  refreshToken  The refresh token to reactivate
   * @param  {Boolean} isManagedSession Whether or not the refresh token is for a managed persona session or a global Fluro user session
   * @return {Promise}                A promise that either resolves with the refreshed token details or rejects with the responding error from the server
   */
  refreshAccessToken(refreshToken, isManagedSession, appContext) {
    const refreshContext = appContext
      ? this.appRefreshContext
      : this.nonAppRefreshContext
    // if (appContext) {
    //     console.log('refresh token in app context')
    // } else {
    //     console.log('refresh token in normal context')
    // }
    // If there is already a request in progress
    if (refreshContext.inflightRefreshRequest != null) {
      this.log(`this.core.auth > use inflight request`)
      return refreshContext.inflightRefreshRequest
    }
    // Create an refresh request
    this.log(`this.core.auth > refresh token new request`)
    refreshContext.inflightRefreshRequest = new Promise((resolve, reject) => {
      this.log(`this.core.auth > refresh token ${refreshToken}`)
      // Bypass the interceptor on all token refresh calls
      // Because we don't need to add the access token etc onto it
      this.core.api
        .post(
          '/token/refresh',
          {
            refreshToken,
            managed: isManagedSession
          },
          {
            bypassInterceptor: true,
            application: appContext
          } as unknown as AxiosRequestConfig
        )
        .then((res) => {
          // Update the user with any changes
          // returned back from the refresh request
          if (!res) {
            this.log('this.core.auth > no res')
            refreshContext.inflightRefreshRequest = undefined
            return reject(new Error('this.core.auth > no res'))
          } else {
            if (this.core.GLOBAL_AUTH || appContext) {
              if (this.core.app) {
                if (this.core.app.user) {
                  assign(this.core.app.user, res.data)
                } else {
                  this.core.app.user = res.data
                }
              }
            } else {
              if (this.store.user) {
                Object.assign(this.store.user, res.data)
              } else {
                this.store.user = res.data
              }
            }
            this.log(`this.core.auth > token refreshed > ${res.data}`)
            // if (this.onChange) {
            //     this.onChange(store.user);
            // }
            this.dispatch()
            // }
          }
          // Resolve with the new token
          resolve(res.data.token)
          // Remove the inflight request
          setTimeout(() => {
            refreshContext.inflightRefreshRequest = undefined
          })
        })
        .catch((err) => {
          console.log('TOKEN REFRESH FAILED', err)
          setTimeout(() => {
            refreshContext.inflightRefreshRequest = undefined
          })
          reject(err)
        })
    })
    // Return the refresh request
    return refreshContext.inflightRefreshRequest
  }

  /**
   * Helper function to resync the user's session from the server. This is often used when first loading a webpage or app
   * just to see if the user's permissions have changed since the user first logged in
   * from the FluroAuth this itself
   * @alias auth.sync
   * @return {Promise}    A promise that either resolves with the user session
   */

  sync() {
    return this.core.api
      .get('/session')
      .then((res) => {
        if (res.data) {
          // Update the user with any changes
          // returned back from the refresh request
          if (this.core.GLOBAL_AUTH) {
            if (this.core.app) {
              this.core.app.user = Object.assign(
                this.core.app.user ?? {},
                res.data
              )
            } else {
              this.store.user = res.data
            }
          } else {
            if (this.store.user) {
              Object.assign(this.store.user, res.data)
            }
          }
        } else {
          if (this.core.GLOBAL_AUTH && this.core.app) {
            this.core.app.user = null
          } else {
            this.store.user = null
          }
        }
        this.log('this.core.auth > server session refreshed')
        this.retryCount = 0
        this.dispatch()
      })
      .catch(() => {
        // if (retryCount > 2) {
        console.log('auth sync not logged in')
        if (this.core.GLOBAL_AUTH && this.core.app) {
          this.core.app.user = null
        } else {
          this.store.user = null
        }
        this.retryCount = 0
        this.dispatch()
        // } else {
        // retryCount++;
        // this.sync();
        // }
      })
  }

  /**
   * Returns the current user's access token
   * @alias auth.getCurrentToken
   * @return {String} The Fluro access token for the current user session
   */
  getCurrentToken() {
    const currentUser = this.getCurrentUser() || {}
    return currentUser.token || this.core.applicationToken
  }

  /**
   * Returns the current user's session data
   * @alias auth.getCurrentUser
   * @return {Object} The current user session
   */
  getCurrentUser() {
    return this.core.GLOBAL_AUTH ? this.core.app?.user : get(this.store, 'user')
  }

  public addEventListener: FluroDispatcher['addEventListener']
  public removeEventListener: FluroDispatcher['removeEventListener']
  public removeAllListeners: FluroDispatcher['removeAllListeners']
}
