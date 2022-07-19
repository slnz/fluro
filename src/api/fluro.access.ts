import { chain, some, includes, map, intersection, reduce } from 'lodash'

import FluroDispatcher from './fluro.dispatcher'
/**
 * Creates a new FluroAccess service
 * This module provides helpful functions and tools for managing and
 * understanding a user's permissions and access control
 *
 * @alias access
 * @constructor
 * @hideconstructor
 * @param {FluroCore} fluro A reference to the parent instance of the FluroCore
 * module. This module is usually created by a FluroCore instance that passes
 * itself in as the first argument.
 */
export default class FluroAccess {
  store: { application?: { session?: object } } = {}
  dispatcher: FluroDispatcher
  glossary = {}

  constructor(private FluroCore) {
    if (!this.FluroCore.auth) {
      throw new Error(
        `Can't Instantiate FluroAccess before FluroAccess has been initialized`
      )
    }
    // Create a new dispatcher
    this.dispatcher = new FluroDispatcher()
    this.dispatcher.bootstrap(this)
  }

  /**
   *
   * Sets the default application so that if the current user is running
   * in the context of an application and not an authenticated user this
   * service can still understand and respond according to the permission
   * sets of the application itself
   * @alias access.setDefaultApplication
   * @param  {Object} application The application session data, usually
   * available before this service is initialized
   * @example
   * fluro.access.setDefaultApplication(window.applicationData._application)
   */
  setDefaultApplication(application): void {
    this.store.application = application
    // Dispatch an event that the application data changed
    this.dispatcher.dispatch('application', application)
  }

  isFluroAdmin(webMode?): boolean {
    const user = this.retrieveCurrentSession(webMode)
    // If we are not authenticated as a user
    if (!user) {
      return
    }
    // If we are not an administrator
    if (user.accountType !== 'administrator') {
      return
    }
    // If we are pretending to be someone else
    // or impersonating a persona
    if (user.pretender) {
      return
    }
    // We are a fluro admin
    return true
  }

  /**
   * Returns either the currently logged in user, or the acting application
   * @alias access.retrieveCurrentSession
   * @return {Object} The user or application session that is currently active
   */
  retrieveCurrentSession(webMode?) {
    let user
    if (this.FluroCore.GLOBAL_AUTH) {
      user = this.FluroCore.auth.getCurrentUser()
    } else {
      if (webMode || this.FluroCore.userContextByDefault) {
        user = this.FluroCore.app ? this.FluroCore.app.user : null
      } else {
        user = this.FluroCore.auth.getCurrentUser()
      }
    }

    const application = this.store.application

    if (user) {
      return user
    }
    if (application) {
      return application.session || application
    }
  }

  /**
   * Checks whether a user has permission to perform a specified action for a
   * specified type of content. If no user is set but an application is then
   * it will return according to the permissions of the application. This
   * function is synchronous and returns a basic true or false boolean
   * @param  {String} action The action to check permissions for eg. 'create',
   * 'view any', 'edit own', 'delete any' etc
   * @param  {String} type The type or definition name eg. 'photo', 'article',
   * 'team'
   * @param  {String} parentType The basic type, for instance if the type you
   * are checking is 'photo' the parent type would be 'image' so that you can
   * get an accurate return value if the user has permission to perform the
   * action on all definitions of an 'image' type content item
   * @return {Boolean} true or false depending on whether the user has the
   * required permissions
   * @alias access.can
   * @example
   *
   * fluro.access.can('create' 'photo', 'image');
   * fluro.access.can('edit any' 'service', 'event');
   *
   */
  can(action, type, parentType, webMode) {
    // Get the current session
    const session = this.retrieveCurrentSession(webMode)
    // If we are not logged in and are not
    // running as an application then we can't
    // do anything
    if (!session) {
      console.log('No session')
      return false
    }
    // If we are an administrator
    // then we have access to do everything
    // so there is no point continuing with checking all the other criteria
    if (this.isFluroAdmin() && !webMode) {
      return true
    }
    // If using shorthand
    switch (action) {
      case 'view':
        return (
          this.can('view any', type, parentType, webMode) ||
          this.can('view own', type, parentType, webMode)
        )
        break
      case 'edit':
        return (
          this.can('edit any', type, parentType, webMode) ||
          this.can('edit own', type, parentType, webMode)
        )
        break
    }
    // Get the permission string we actually want to check against
    const permissionString = `${action} ${type}`.trim()
    // Track the realms we are allowed to do this in
    let realms = []
    // Check if we can do this permission in any realms
    let canViewAnyRealms, canEditAnyRealms, canViewOwnRealms, canEditOwnRealms
    switch (action) {
      case 'view any':
        canViewAnyRealms = this.retrieveActionableRealms(
          'view any ' + type,
          webMode
        )
        canEditAnyRealms = this.retrieveActionableRealms(
          'edit any ' + type,
          webMode
        )
        // Combine the realms
        realms = realms.concat(canViewAnyRealms)
        realms = realms.concat(canEditAnyRealms)
        break
      case 'view own':
        canViewOwnRealms = this.retrieveActionableRealms(
          'view own ' + type,
          webMode
        )
        canEditOwnRealms = this.retrieveActionableRealms(
          'edit own ' + type,
          webMode
        )
        // Combine the realms
        realms = realms.concat(canViewOwnRealms)
        realms = realms.concat(canEditOwnRealms)
        break
      default:
        realms = this.retrieveActionableRealms(permissionString, webMode)
        break
    }
    // If there are realms that we can do this in
    // then we can return true here
    if (realms.length) {
      return true
    }
    // Check if the user has any permissions on the parent type that would
    // allow them to perform the action
    if (parentType && parentType.length) {
      // Check if we have flowdown from the parent type
      const includeDefined = this.retrieveActionableRealms(
        'include defined ' + parentType,
        webMode
      )
      // If not there is no point continuing with the check
      if (!includeDefined.length) {
        return false
      }
      // If so we now need to check if we can perform
      // the action on the parent in any realms
      let canViewAnyParentRealms,
        canEditAnyParentRealms,
        canViewOwnParentRealms,
        canEditOwnParentRealms
      switch (action) {
        case 'view any':
          canViewAnyParentRealms = this.retrieveActionableRealms(
            'view any ' + parentType,
            webMode
          )
          canEditAnyParentRealms = this.retrieveActionableRealms(
            'edit any ' + parentType,
            webMode
          )
          // Combine the realms
          realms = realms.concat(canViewAnyParentRealms)
          realms = realms.concat(canEditAnyParentRealms)
          break
        case 'view own':
          canViewOwnParentRealms = this.retrieveActionableRealms(
            'view own ' + parentType,
            webMode
          )
          canEditOwnParentRealms = this.retrieveActionableRealms(
            'edit own ' + parentType,
            webMode
          )
          // Combine the realms
          realms = realms.concat(canViewOwnParentRealms)
          realms = realms.concat(canEditOwnParentRealms)
          break
        default:
          realms = this.retrieveActionableRealms(
            action + ' ' + parentType,
            webMode
          )
          break
      }
      if (realms.length) {
        return true
      }
    }
    // Nope we cant
    return false
  }

  /**
   * Checks whether a user has permission any permissions for a specified
   * type of content. If no user is set but an application is then it will
   * return according to the permissions of the application. This function is
   * synchronous and returns a basic true or false boolean
   * @param  {String} type The type or definition name eg. 'photo', 'article',
   * 'team'
   * @param  {String} parentType The basic type, for instance if the type you
   * are checking is 'photo' the parent type would be 'image' so that you can
   * get an accurate return value if the user has permission to perform the
   * action on all definitions of an 'image' type content item
   * @return {Boolean} true or false depending on whether the user has the
   * required permissions
   * @alias access.canKnowOf
   * @example
   * fluro.access.canKnowOf('photo', 'image');
   * fluro.access.canKnowOf('event');
   */
  canKnowOf(type, parentType, webMode) {
    // Get the current session
    const session = this.retrieveCurrentSession(webMode)
    // If we are not logged in and are not
    // running as an application then we can't
    // do anything
    if (!session) {
      return false
    }
    // If we are an administrator
    // then we have access to do everything
    // so there is no point continuing with checking all the other criteria
    if (this.isFluroAdmin() && !webMode) {
      return true
    }
    // Get the permission string we actually want to check against
    const actionsToCheck = [
      'view any',
      'view own',
      'view any',
      'edit own',
      'edit any',
      'create'
    ]
    const canAccess = some(actionsToCheck, (action) => {
      return this.can(action, type, parentType, webMode)
    })
    if (canAccess) {
      return true
    }
    if (this.FluroCore.types && this.FluroCore.types.glossary) {
      const subTypes = some(this.glossary, (term, key) => {
        if (term.parentType === type) {
          return some(actionsToCheck, (action) => {
            return this.can(action, key, null, webMode)
          })
        }
      })
      return subTypes
    }
  }

  // Flatten all children for a specified permission set
  // so you get a flat array of included realm ids
  // this function is recursive and will include all sub realms
  retrieveKeys(set, additional) {
    if (set.children && set.children.length) {
      set.children.forEach((child) => {
        this.retrieveKeys(child, additional)
      })
    }
    additional.push(String(set._id))
  }

  /**
   * Retrieves all realms the acting user or application can perform an action
   * in
   * @param  {String} permission The permission string to retrieve realms for
   * @return {Array} An array of realms that the user can perform the action in
   * @alias access.retrieveActionableRealms
   * @example
   *
   * // Returns an array of all realms the user is allowed to do the specified
   * // action
   * let realms = fluro.access.retrieveActionableRealms('create photo');
   */
  retrieveActionableRealms(action, webMode) {
    // Get the current acting user session
    const session = this.retrieveCurrentSession(webMode)
    // No session so can't perform any actions
    // in any realms
    if (!session) {
      return []
    }

    // Get the permission sets
    const permissionSets = session.permissionSets
    // Find all realms that the current acting session
    // can perform the specified action in
    const realms = chain(permissionSets)
      .map((realmSet) => {
        // Does the set include this permission
        const hasPermission = includes(realmSet.permissions, action)
        if (hasPermission) {
          const keys = []
          this.retrieveKeys(realmSet, keys)
          return keys
        }
        return undefined
      })
      .flatten()
      .compact()
      .value()

    return realms
  }

  /**
   * Check whether a user has a specific permission, useful for checking custom
   * permissions or simply whether or not a user has a permission in any realm
   * @param  {String}  permission The permission to check
   * @return {Boolean}
   * @alias access.has
   * @example
   * // Returns true or false if the user has the permission
   * let hasPermission = fluro.access.has('create photo');
   */
  has(permission, webMode) {
    // Get the current acting user session
    const user = this.retrieveCurrentSession(webMode)
    if (!user) {
      return false
    }
    if (this.isFluroAdmin() && !webMode) {
      return true
    }

    const permissionSets = user.permissionSets
    // Get all of the possible permissions
    const permissions = chain(permissionSets)
      .reduce((results, set) => {
        results.push(set.permissions)
        return results
      }, [])
      // .map(retrieveSubRealms)
      .flattenDeep()
      .compact()
      .uniq()
      .value()
    // Check if any of the users permissions include the one
    // we are looking for
    return includes(permissions, permission)
  }

  /**
   * Checks whether the currently authenticated user is the author or owner of a
   * specified content item
   * @param  {Object}  item The item to check if the user is an author of
   * @return {Boolean}
   * @alias access.isAuthor
   * @example
   *
   * // Returns true or false
   * fluro.access.isAuthor({title:'My article', _id:'55bbf345de...'});
   */
  isAuthor(item, webMode?) {
    // Get the current acting user session
    const user = this.retrieveCurrentSession(webMode)
    if (!user) {
      return false
    }
    if (!item) {
      return false
    }

    const userID = this.FluroCore.utils.getStringID(user)
    const authorID = this.FluroCore.utils.getStringID(item.author)
    // The user is the author if the user's id matches
    // the content author's id
    let author = userID === authorID

    // If we are the author at this point
    // return early
    if (author) {
      return true
    }
    // Check if the persona matches the managed author
    const personaID = this.FluroCore.utils.getStringID(user.persona)
    const managedAuthorID = this.FluroCore.utils.getStringID(item.managedAuthor)
    // If the user's persona is the managed author of the content
    if (personaID === managedAuthorID) {
      author = true
    }

    // If we are the author at this point
    // return early
    if (author) {
      return true
    }

    // Check if the item has any owners listed on it
    const ownerIDs = this.FluroCore.utils.arrayIDs(item.owners)
    // If owners are listed
    if (ownerIDs && ownerIDs.length) {
      // Check if the user is listed as an owner
      author = includes(ownerIDs, userID)
    }

    // If we are the author at this point
    // return early
    if (author) {
      return true
    }

    // Check if the item has any managed owners listed on it
    const managedOwnerIDs = this.FluroCore.utils.arrayIDs(item.managedOwners)
    // If managed owners are listed
    if (managedOwnerIDs && managedOwnerIDs.length) {
      // Check if the user is listed as an owner
      author = includes(managedOwnerIDs, personaID)
    }

    const itemID = this.FluroCore.utils.getStringID(item)
    // If the user is trying to edit their own user
    if (userID === itemID) {
      author = true
    }
    // If the user is trying to edit their own persona
    if (personaID === itemID) {
      author = true
    }
    return author
  }

  /**
   * Check whether the current acting user can edit a specified content item
   * @param  {Object} item The item to check if the user can edit
   * @return {Boolean}
   * @alias access.canEditItem
   * @example
   *
   * // Returns true
   * fluro.access.canEditItem({title:'My article', _id:'55bbf345de...'});
   */
  canEditItem(item, isUser, webMode) {
    if (!item) {
      return false
    }
    // Get the current acting user or application
    const user = this.retrieveCurrentSession(webMode)
    if (!user) {
      return false
    }
    // Store the itemID in case we need to reference it below
    const itemID = this.FluroCore.utils.getStringID(item)

    // Check the account of the user
    // and the account of the content
    const userAccountID = this.FluroCore.utils.getStringID(user.account)
    const contentAccountID = this.FluroCore.utils.getStringID(item.account)
    // If there is an account listed on the content and it does not
    // match the account of the user then we can't edit it
    if (contentAccountID && contentAccountID !== userAccountID) {
      return false
    }

    // If we are a Fluro Admin we can do anything!
    if (this.isFluroAdmin()) {
      return true
    }

    if (item._type && item._type !== 'realm') {
      if (item.realms && !item.realms.length) {
        return true
      }
    }

    // Get the definition name of the item
    // we are trying to edit
    let definitionName = item._type
    let parentType
    // If the item is a defined type
    // store the definition and the parent type
    if (item.definition) {
      definitionName = item.definition
      parentType = item._type
    }

    if (item._type === 'process') {
      if (item.assignedTo && item.assignedTo.length) {
        const intersect = intersection(
          this.FluroCore.utils.arrayIDs(item.assignedTo),
          user.contacts
        )
        if (intersect && intersect.length) {
          return true
        }
      }
      if (item.assignedToTeam && item.assignedToTeam.length) {
        // Check if the user is in any of the teams
        const userTeams = map(user.visibleRealms, '_team')
        const intersect = intersection(
          this.FluroCore.utils.arrayIDs(item.assignedToTeam),
          userTeams
        )
        if (intersect && intersect.length) {
          return true
        }
      }
    }

    // Check if the user is the author of this content
    const author = this.isAuthor(item)
    // If the content we are checking is a Fluro User
    // We used to allow the user to edit their own user
    // but we don't allow this anymore
    // user profile
    // if (isUser) {
    //     definitionName = 'user';
    //     if (author) {
    //         return true;
    //     }
    // }

    // Find the realms we are allowed to edit this kind of content in
    let editAnyRealms = this.retrieveActionableRealms(
      'edit any ' + definitionName,
      webMode
    )
    let editOwnRealms = this.retrieveActionableRealms(
      'edit own ' + definitionName,
      webMode
    )

    // Keep track of the realms of the content
    let contentRealmIDs
    // If we are checking a realm then we need to check the trail
    // instead of the 'item.realms' array
    if (definitionName === 'realm' || parentType === 'realm') {
      // Check the realm.trail
      contentRealmIDs = this.FluroCore.utils.arrayIDs(item.trail)
      // Include the realm itself
      contentRealmIDs.push(itemID)
    } else {
      // Retrieve all the realms the content is currently in
      contentRealmIDs = this.FluroCore.utils.arrayIDs(item.realms)
    }

    // Check if the user has any permissions on the parent type that will allow
    // them to access this content
    if (parentType && parentType.length) {
      const includeDefined = this.retrieveActionableRealms(
        'include defined ' + parentType,
        webMode
      )
      // If we can adjust the parent and it's defined child types in any realms
      if (includeDefined.length) {
        const canEditAnyParentRealms = this.retrieveActionableRealms(
          'edit any ' + parentType,
          webMode
        )
        editAnyRealms = editAnyRealms.concat(canEditAnyParentRealms)
        const canEditOwnParentRealms = this.retrieveActionableRealms(
          'edit own ' + parentType,
          webMode
        )
        editOwnRealms = editOwnRealms.concat(canEditOwnParentRealms)
      }
    }

    // Find realms the content is in that we are allowed to edit within
    const matchedAnyRealms = intersection(editAnyRealms, contentRealmIDs)
    // We are allowed to edit anything in these realms
    // So return true
    if (matchedAnyRealms.length) {
      return true
    }

    // If we are the author of the content
    if (author) {
      // Find own matches between this content
      const matchedOwnRealms = intersection(editOwnRealms, contentRealmIDs)
      // We are allowed to edit anything in these realms
      // So return true
      if (matchedOwnRealms.length) {
        return true
      }
    }
    return false
  }

  /**
   * Check whether the current acting user can view a specified content item
   * @param  {Object} item The item to check if the user can view
   * @return {Boolean}
   * @alias access.canViewItem
   * @example
   *
   * // Returns true
   * fluro.access.canViewItem({title:'My article', _id:'55bbf345de...'});
   */
  canViewItem(item, isUser, webMode) {
    if (!item) {
      return false
    }
    // Get the current acting user or application
    const user = this.retrieveCurrentSession(webMode)
    if (!user) {
      return false
    }

    // If we are a Fluro Admin we can do anything!
    if (this.isFluroAdmin()) {
      return true
    }

    if (item._type && item._type !== 'realm') {
      if (item.realms && !item.realms.length) {
        return true
      }
    }

    // Store the itemID in case we need to reference it below
    const itemID = this.FluroCore.utils.getStringID(item)

    let definitionName = item._type
    let parentType
    if (item.definition) {
      definitionName = item.definition
      parentType = item._type
    }

    // Check if the user is the author of this content
    const author = this.isAuthor(item)
    // if (isUser) {
    //     definitionName = 'user';
    //     if (author) {
    //         return true;
    //     }
    // }

    // Get the realms we are allowed to work in
    const viewAnyRealms = this.retrieveActionableRealms(
      'view any ' + definitionName,
      webMode
    )
    const viewOwnRealms = this.retrieveActionableRealms(
      'view own ' + definitionName,
      webMode
    )
    const editAnyRealms = this.retrieveActionableRealms(
      'edit any ' + definitionName,
      webMode
    )
    const editOwnRealms = this.retrieveActionableRealms(
      'edit own ' + definitionName,
      webMode
    )
    // Combine any
    let combinedAnyRealms = []
    combinedAnyRealms = combinedAnyRealms.concat(viewAnyRealms)
    combinedAnyRealms = combinedAnyRealms.concat(editAnyRealms)
    // Combine own
    let combinedOwnRealms = []
    combinedOwnRealms = combinedOwnRealms.concat(viewOwnRealms)
    combinedOwnRealms = combinedOwnRealms.concat(editOwnRealms)

    // Keep track of the realms of the content
    let contentRealmIDs
    // If we are checking a realm then we need to check the trail
    // instead of the 'item.realms' array
    if (definitionName === 'realm' || parentType === 'realm') {
      // Check the realm.trail
      contentRealmIDs = this.FluroCore.utils.arrayIDs(item.trail)
      // Include the realm itself
      console.log('PUSH?', contentRealmIDs)
      contentRealmIDs.push(itemID)
    } else {
      // Retrieve all the realms the content is currently in
      contentRealmIDs = this.FluroCore.utils.arrayIDs(item.realms)
    }

    // Check if the user has any permissions on the parent type that will allow
    // them to access this content
    if (parentType && parentType.length) {
      const includeDefined = this.retrieveActionableRealms(
        'include defined ' + parentType,
        webMode
      )
      if (includeDefined.length) {
        const canEditAnyParentRealms = this.retrieveActionableRealms(
          'edit any ' + parentType,
          webMode
        )
        const canViewAnyParentRealms = this.retrieveActionableRealms(
          'view any ' + parentType,
          webMode
        )
        combinedAnyRealms = combinedAnyRealms.concat(
          canEditAnyParentRealms,
          canViewAnyParentRealms
        )
        const canEditOwnParentRealms = this.retrieveActionableRealms(
          'edit own ' + parentType,
          webMode
        )
        const canViewOwnParentRealms = this.retrieveActionableRealms(
          'view own ' + parentType,
          webMode
        )
        combinedOwnRealms = combinedOwnRealms.concat(
          canEditOwnParentRealms,
          canViewOwnParentRealms
        )
      }
    }

    // Find any matches between this content
    const matchedAnyRealms = intersection(combinedAnyRealms, contentRealmIDs)
    // We are allowed to view anything in these realms
    // So return true
    if (matchedAnyRealms.length) {
      return true
    }

    // If we are the author
    if (author) {
      // Find own matches between this content
      const matchedOwnRealms = intersection(combinedOwnRealms, contentRealmIDs)
      // We are allowed to view anything in these realms
      // So return true
      if (matchedOwnRealms.length) {
        return true
      }
    }
    return false
  }

  /**
   * Check whether the current acting user can delete a specified content item
   * @param  {Object} item The item to check if the user can delete
   * @return {Boolean}
   * @alias access.canDeleteItem
   * @example
   *
   * // Returns true
   * fluro.access.canDeleteItem({title:'My article', _id:'55bbf345de...'});
   */
  canDeleteItem(item, isUser, webMode) {
    if (!item) {
      return false
    }
    // Get the current acting user or application
    const user = this.retrieveCurrentSession(webMode)
    if (!user) {
      return false
    }
    // Store the itemID in case we need to reference it below
    const itemID = this.FluroCore.utils.getStringID(item)

    // Check the account of the user
    // and the account of the content
    const userAccountID = this.FluroCore.utils.getStringID(user.account)
    const contentAccountID = this.FluroCore.utils.getStringID(item.account)
    // If there is an account listed on the content and it does not
    // match the account of the user then we can't delete it
    if (contentAccountID && contentAccountID !== userAccountID) {
      return false
    }

    // If we are a Fluro Admin we can do anything!
    if (this.isFluroAdmin()) {
      return true
    }

    if (item._type && item._type !== 'realm') {
      if (item.realms && !item.realms.length) {
        return true
      }
    }

    // Get the definition name of the item
    // we are trying to delete
    let definitionName = item._type
    let parentType
    // If the item is a defined type
    // store the definition and the parent type
    if (item.definition) {
      definitionName = item.definition
      parentType = item._type
    }

    // Check if the user is the author of this content
    const author = this.isAuthor(item)
    // If the content we are checking is a Fluro User
    // We used to allow the user to delete their own user
    // but we don't allow this anymore
    // user profile
    // if (isUser) {
    //     definitionName = 'user';
    //     if (author) {
    //         return true;
    //     }
    // }

    // Find the realms we are allowed to delete this kind of content in
    let deleteAnyRealms = this.retrieveActionableRealms(
      'delete any ' + definitionName,
      webMode
    )
    let deleteOwnRealms = this.retrieveActionableRealms(
      'delete own ' + definitionName,
      webMode
    )

    // Keep track of the realms of the content
    let contentRealmIDs
    // If we are checking a realm then we need to check the trail
    // instead of the 'item.realms' array
    if (definitionName === 'realm' || parentType === 'realm') {
      // Check the realm.trail
      contentRealmIDs = this.FluroCore.utils.arrayIDs(item.trail)
      // Include the realm itself
      contentRealmIDs.push(itemID)
    } else {
      // Retrieve all the realms the content is currently in
      contentRealmIDs = this.FluroCore.utils.arrayIDs(item.realms)
    }

    // Check if the user has any permissions on the parent type that will allow
    // them to access this content
    if (parentType && parentType.length) {
      const includeDefined = this.retrieveActionableRealms(
        'include defined ' + parentType,
        webMode
      )
      // If we can adjust the parent and it's defined child types in any realms
      if (includeDefined.length) {
        const canEditAnyParentRealms = this.retrieveActionableRealms(
          'delete any ' + parentType,
          webMode
        )
        deleteAnyRealms = deleteAnyRealms.concat(canEditAnyParentRealms)
        const canEditOwnParentRealms = this.retrieveActionableRealms(
          'delete own ' + parentType,
          webMode
        )
        deleteOwnRealms = deleteOwnRealms.concat(canEditOwnParentRealms)
      }
    }

    // Find realms the content is in that we are allowed to delete within
    const matchedAnyRealms = intersection(deleteAnyRealms, contentRealmIDs)
    // We are allowed to delete anything in these realms
    // So return true
    if (matchedAnyRealms.length) {
      return true
    }

    // If we are the author of the content
    if (author) {
      // Find own matches between this content
      const matchedOwnRealms = intersection(deleteOwnRealms, contentRealmIDs)
      // We are allowed to delete anything in these realms
      // So return true
      if (matchedOwnRealms.length) {
        return true
      }
    }
    return false
  }

  retrieveSelectableRealms(action, definition, type, options) {
    if (!options) {
      options = {}
    }
    const params = {
      definition,
      parentType: type,
      type,
      flat: undefined as boolean | undefined
    }
    if (options.flat) {
      params.flat = true
    }
    return new Promise((resolve, reject) => {
      // Retrieve all the realms the user is allowed to know about
      this.FluroCore.api
        .get('/realm/selectable', {
          params
        })
        .then((res) => {
          return resolve(res.data)
        }, reject)
    })
  }

  retrievePermissions(options) {
    return new Promise((resolve, reject) => {
      // Load the glossary
      console.log('Reload terminology for permissions')
      this.FluroCore.types
        .reloadTerminology(options)
        .then((terms) => {
          const derivatives = reduce(
            terms,
            (set, type) => {
              const basicType = type.parentType
              if (!basicType) {
                return set
              }
              let existing = set[basicType]
              if (!existing) {
                existing = set[basicType] = {
                  names: [],
                  types: []
                }
              }
              existing.names.push(type.plural)
              existing.types.push(type)
              return set
            },
            {}
          )

          // Loop through and structure the available permissions
          const permissions = chain(terms)
            // .orderBy('title')
            .reduce((set, type) => {
              // Create a copy so we dont pollute the types entry
              type = JSON.parse(JSON.stringify(type))
              // Get the basic type, or otherwise it is a basic type
              const basicType = type.parentType || type.definitionName
              const definitionName = type.definitionName
              // // Check if an entry exists for this basic type
              // let existing = set[basicType];
              // if (!existing) {
              //     existing = set[basicType] = {
              //         title,
              //         definitionName: basicType,
              //         definitions: [],
              //     }
              // }
              let isDefineable = definitionName === basicType

              // Create an array for all the possible permissions
              type.permissions = []

              // Push it into the group
              // existing.definitions.push(type);
              set.push(type)
              switch (definitionName) {
                case 'account':
                  isDefineable = false
                  type.permissions.push({
                    title: `Administrate Account Information`,
                    value: `administrate account`,
                    description: `Update billing, view invoices, add credit and modify Account Information`
                  })
                  return set
                  break
              }

              switch (basicType) {
                case 'simpleemail':
                case 'smscorrespondence':
                  isDefineable = false
                  type.permissions.push({
                    title: `Create new ${type.plural}`,
                    value: `create ${definitionName}`,
                    description: `Can create new ${type.plural}`
                  })
                  type.permissions.push({
                    title: `View any ${type.plural}`,
                    value: `view any ${definitionName}`,
                    description: `Can view ${type.plural} regardless of who the sender is`
                  })
                  type.permissions.push({
                    title: `View owned ${type.plural}`,
                    value: `view own ${definitionName}`,
                    description: `Can view ${type.plural} that were originally sent by the user`
                  })
                  break
                default:
                  type.permissions.push({
                    title: `Create new ${type.plural}`,
                    value: `create ${definitionName}`,
                    description: `Can create new ${type.plural}`
                  })
                  type.permissions.push({
                    title: `View any ${type.plural}`,
                    value: `view any ${definitionName}`,
                    description: `Can view ${type.plural} regardless of who the creator is`
                  })
                  type.permissions.push({
                    title: `View owned ${type.plural}`,
                    value: `view own ${definitionName}`,
                    description: `Can view ${type.plural} that were originally created by the user, or the user is listed as an 'owner'`
                  })
                  type.permissions.push({
                    title: `Edit any ${type.plural}`,
                    value: `edit any ${definitionName}`,
                    description: `Can edit ${type.title} regardless of who the creator is`
                  })
                  type.permissions.push({
                    title: `Edit owned ${type.plural}`,
                    value: `edit own ${definitionName}`,
                    description: `Can edit ${type.plural} that were originally created by the user, or the user is listed as an 'owner'`
                  })
                  type.permissions.push({
                    title: `Delete any ${type.plural}`,
                    value: `delete any ${definitionName}`,
                    description: `Can delete ${type.plural} regardless of who the creator is`
                  })
                  type.permissions.push({
                    title: `Delete owned ${type.plural}`,
                    value: `delete own ${definitionName}`,
                    description: `Can delete ${type.plural} that were originally created by the user, or the user is listed as an 'owner'`
                  })
                  type.permissions.push({
                    title: `Destroy any ${type.plural}`,
                    value: `destroy any ${definitionName}`,
                    description: `Can destroy ${type.plural} permanently from the trash regardless of who the creator is`
                  })
                  type.permissions.push({
                    title: `Destroy owned ${type.plural}`,
                    value: `destroy own ${definitionName}`,
                    description: `Can destroy ${type.plural} permanently from the trash that were originally created by the user, or the user is listed as an 'owner'`
                  })
                  type.permissions.push({
                    title: `Restore any ${type.plural}`,
                    value: `restory any ${definitionName}`,
                    description: `Can restore ${type.plural} from the trash. regardless of who the creator is`
                  })
                  type.permissions.push({
                    title: `Restore owned ${type.plural}`,
                    value: `restory own ${definitionName}`,
                    description: `Can restore ${type.plural} from the trash. that were originally created by the user, or the user is listed as an 'owner'`
                  })
                  break
              }
              switch (definitionName) {
                case 'interaction':
                case 'post':
                  type.permissions.push({
                    title: `Submit new ${type.plural}`,
                    value: `submit ${definitionName}`,
                    description: `Can submit new ${type.plural} through the use of a form.`
                  })
                  break
                case 'transaction':
                  type.permissions.push({
                    title: `Refund ${type.plural}`,
                    value: `refund ${definitionName}`,
                    description: `Can process ${type.plural} refunds`
                  })
                  break
                case 'contact':
                  type.permissions.push({
                    title: `Send SMS Text Message`,
                    value: `sms`,
                    description: `Can send SMS Messages to ${type.plural} that the user is allowed to view`
                  })
                  type.permissions.push({
                    title: `Send Basic Emails`,
                    value: `email`,
                    description: `Can send email messages via fluro to contacts that the user is allowed to view`
                  })
                  break
                case 'checkin':
                  type.permissions.push({
                    title: `Leader Override Checkout ${type.plural}`,
                    value: `leader checkout ${definitionName}`,
                    description: `Can manually override and checkout a contact without providing the PIN Number`
                  })
                  break
                case 'ticket':
                  type.permissions.push({
                    title: `Scan / Collect ${type.plural}`,
                    value: `collect ${definitionName}`,
                    description: `Can scan a ticket and mark it as 'collected'`
                  })
                  break
                case 'policy':
                  type.permissions.push({
                    title: `Grant ${type.plural}`,
                    value: `grant ${definitionName}`,
                    description: `Can allocate any ${type.plural} to other users`
                  })
                  type.permissions.push({
                    title: `Grant held ${type.plural}`,
                    value: `grant held ${definitionName}`,
                    description: `Can allocate ${type.plural} that are held by the current user to other users`
                  })
                  type.permissions.push({
                    title: `Revoke ${type.plural}`,
                    value: `revoke ${definitionName}`,
                    description: `Can revoke ${type.plural} from other users`
                  })
                  break
                case 'role':
                  type.permissions.push({
                    title: `Assign individual ${type.plural}`,
                    value: `assign role`,
                    description: `Can assign individual permission sets to other users`
                  })
                  break
                case 'persona':
                  type.permissions.push({
                    title: `Assign individual roles`,
                    value: `assign role`,
                    description: `Can assign individual permission sets to other users`
                  })
                  type.permissions.push({
                    title: `Impersonate ${type.plural}`,
                    value: `impersonate`,
                    description: `Can impersonate other user personas`
                  })
                  break
                case 'team':
                  type.permissions.push({
                    title: `Join ${type.plural}`,
                    value: `join ${definitionName}`,
                    description: `Can join or add members to ${type.plural} if those ${type.plural} allow provisional membership`
                  })
                  type.permissions.push({
                    title: `Leave ${type.plural}`,
                    value: `leave ${definitionName}`,
                    description: `Can leave or remove members from ${type.plural} if those ${type.plural} allow provisional membership`
                  })
                  break
              }

              if (isDefineable) {
                const matchedSet = derivatives[basicType]
                let description = `Apply all the selected permissions to all ${type.title} definitions`
                if (matchedSet) {
                  description = `Apply all the selected permissions to all ${
                    type.title
                  } definitions, Eg. (${matchedSet.names.join(', ')})`
                }
                // if (isDefineable) {
                type.permissions.push({
                  title: `Include all defined ${type.title} types`,
                  value: `include defined ${definitionName}`,
                  description
                })
                // }
              }
              // switch(key) {
              //     case '':
              //     break;
              // }
              // Return the set
              return set
            }, [])
            // .values()
            .orderBy('title')
            .value()
          resolve(permissions)
        })
        .catch(reject)
    })
  }

  public dispatch: FluroDispatcher['dispatch']
  public addEventListener: FluroDispatcher['addEventListener']
  public removeEventListener: FluroDispatcher['removeEventListener']
  public removeAllListeners: FluroDispatcher['removeAllListeners']
}
