import { each, filter } from 'lodash'

import FluroStatsStorage from './fluro.stats.storage'
import FluroStatsUserStorage from './fluro.stats.user.storage'

// This is the main service that creates the buckets and manages them all
export default class FluroStats {
  userStores = {}
  globalStores = {}
  constructor(private Fluro) {
    if (!Fluro.api) {
      throw new Error(`Can't Instantiate FluroStats before FluroAPI exists`)
    }
  }

  // Helper function to quickly set a stat
  set(statName, target) {
    const targetID = this.Fluro.utils.getStringID(target)

    // Get/Create the stat storage bucket
    const store = this.getUserStore(statName, true)
    return store.set(targetID)
  }

  // Helper function to quickly unset a stat
  unset(statName, target) {
    const targetID = this.Fluro.utils.getStringID(target)

    // Get/Create the stat storage bucket
    const store = this.getUserStore(statName, true)
    return store.unset(targetID)
  }

  refresh() {
    const promises = []

    // Refreshes all the stats
    each(this.userStores, (store) => {
      promises.push(store.refresh())
    })

    // Refreshes all the stats
    each(this.globalStores, (store) => {
      promises.push(store.refresh())
    })

    return Promise.all(promises)
  }

  getGlobalStoresForKey(key) {
    return filter(this.globalStores, (store) => {
      return store.key === key
    })
  }

  // Create a new / Get an existing store
  getUserStore(statName, unique) {
    if (!statName) {
      // console.log('No stat name provided');
      return
    }

    let key = statName
    if (unique) {
      key = '_' + key
    }

    if (this.userStores[key]) {
      return this.userStores[key]
    }

    const userStore = new FluroStatsUserStorage(this.Fluro, statName, unique)

    // If the user changes a stat, check if we need to
    userStore.addEventListener('change', (data) => {
      // If there is an existing store for this state
      // we should refresh it cos there's new data
      const staleStores = this.getGlobalStoresForKey(data.key)

      setTimeout(() => {
        // Give the backend a break before we refresh
        each(staleStores, (store) => {
          store.refresh()
        })
      }, 1000)
    })

    this.userStores[key] = userStore

    return this.userStores[key]
  }

  // Create a new / Get a global Store
  getStore(statName, targetID, unique) {
    if (!statName) {
      // console.log('No stat name provided');
      return
    }

    let key = statName
    if (unique) {
      key = '_' + key
    }

    // Create a unique key for this specific
    // target and stat
    const combinedKey = `${key}.${targetID}`

    if (this.globalStores[combinedKey]) {
      return this.globalStores[combinedKey]
    }

    this.globalStores[combinedKey] = new FluroStatsStorage(
      this.Fluro,
      statName,
      targetID,
      unique
    )

    return this.globalStores[combinedKey]
  }
}
