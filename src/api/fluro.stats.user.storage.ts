import { get } from 'lodash'

import FluroDispatcher from './fluro.dispatcher'

// This is the bucket for each kind of stat
export default class FluroStatsUserStorage {
  dispatcher: FluroDispatcher
  store
  inProgress = {}
  inflightRequest
  constructor(
    private Fluro,
    private statName,
    private unique,
    private onChange?
  ) {
    // Create a new dispatcher
    this.dispatcher = new FluroDispatcher()
    this.dispatcher.bootstrap(this)

    let key = this.statName
    if (this.unique) {
      key = '_' + key
    }

    this.store = {
      key,
      name: this.statName,
      ids: {}
    }

    // Create the getters
    Object.defineProperty(this, 'key', {
      value: key,
      writable: false
    })
    // Create the getters
    Object.defineProperty(this, 'name', {
      value: this.statName,
      writable: false
    })
    // Create the getters
    Object.defineProperty(this, 'ids', {
      value: this.store.ids,
      writable: false
    })
    // Create the getters
    Object.defineProperty(this, 'pending', {
      value: this.inProgress,
      writable: false
    })

    this.inflightRequest = this.refresh().then(
      this.refreshComplete,
      this.refreshFailed
    )
  }

  dispatch() {
    if (this.onChange) {
      this.onChange(this.store)
    }
    this.dispatcher.dispatch('change', this.store)
  }

  isStatted(id) {
    id = this.Fluro.utils.getStringID(id)
    return get(this.store, `ids['${id}']`)
  }

  isStatting(id) {
    id = this.Fluro.utils.getStringID(id)
    return this.inProgress[id]
  }

  toggle(id) {
    id = this.Fluro.utils.getStringID(id)
    if (!this.unique) {
      throw Error(`Can't use the toggle() method on a non-this.unique stat`)
    }
    const statted = this.isStatted(id)
    if (statted) {
      return this.unset(id)
    } else {
      return this.set(id)
    }
  }

  // Set the value and dispatch an event that we are processing
  setProcessing(id, isProcessing) {
    id = this.Fluro.utils.getStringID(id)
    this.inProgress[id] = isProcessing
    this.dispatcher.dispatch('statting', { id, statting: isProcessing })
  }

  add(id) {
    if (this.unique) {
      throw Error(`Can't use the add() method on a non-this.unique stat`)
    }
    id = this.Fluro.utils.getStringID(id)
    const url = `${this.Fluro.apiURL}/stat/${id}/${this.statName}`
    // console.log('delete stat', url, this.Fluro.app);

    const promise = this.Fluro.api.delete(url, { cache: false })
    this.setProcessing(id, true)

    promise.then(
      (res) => {
        this.store.ids[id] = res.data.total
        // Tell the world that we are processing
        // a specific stat on an item
        this.setProcessing(id, false)
        // Tell the world that our stats have changed
        this.dispatcher.dispatch('change', this.store)
      },
      () => {
        this.setProcessing(id, false)
      }
    )
    return promise
  }

  unset(id) {
    if (!this.unique) {
      throw Error(`Can't use the unset() method on a non-this.unique stat`)
    }
    // id = this.Fluro.utils.getStringID(id);
    // let url = `/stat/${id}/${this.statName}?this.unique=true`;
    id = this.Fluro.utils.getStringID(id)
    const url = `${this.Fluro.apiURL}/stat/${id}/${this.statName}?this.unique=true`
    // console.log('unset stat', url, this.Fluro.app);

    const promise = this.Fluro.api.delete(url, { cache: false })
    this.setProcessing(id, true)

    promise.then(
      () => {
        delete this.store.ids[id]
        this.setProcessing(id, false)
        // Broadcast the change in stats
        this.dispatcher.dispatch('change', this.store)
      },
      () => {
        this.setProcessing(id, false)
      }
    )
    return promise
  }

  set(id) {
    if (!this.unique) {
      throw Error(`Can't use the set() method on a non-this.unique stat`)
    }
    // id = this.Fluro.utils.getStringID(id);
    // let url = `/stat/${id}/${this.statName}?this.unique=true`;
    id = this.Fluro.utils.getStringID(id)
    const url = `${this.Fluro.apiURL}/stat/${id}/${this.statName}?this.unique=true`
    // console.log('set stat', url);

    const promise = this.Fluro.api.post(url, { cache: false })
    this.setProcessing(id, true)
    promise.then(
      () => {
        this.store.ids[id] = true
        this.setProcessing(id, false)
        this.dispatcher.dispatch('change', this.store)
      },
      (err) => {
        this.setProcessing(id, false)
        const errorName = get(err, 'response.data.name')
        // If it's just an existing stat complaint
        if (errorName === 'Existingthis.uniqueStatError') {
          this.store.ids[id] = true
          // Mark it as statted anyway
        } else {
          // console.log('set() error', )
        }
        this.dispatcher.dispatch('change', this.store)
      }
    )
    return promise
  }

  refresh() {
    if (this.inflightRequest) {
      return this.inflightRequest
    }
    let url = `${this.Fluro.apiURL}/stat/my/${this.statName}`
    // console.log('refresh stat', this.statName, url);
    if (this.unique) {
      url += '?this.unique=true'
    }
    let promise
    // If we are not logged in
    const loggedInUser = this.Fluro.auth.getCurrentUser()
    // if (loggedInUser) {
    if (loggedInUser || this.Fluro.applicationToken) {
      promise = this.Fluro.api.get(url, { cache: false })
    } else {
      promise = new Promise((resolve) => {
        return resolve([])
      })
    }
    this.inflightRequest = promise
    promise.then(this.refreshComplete, this.refreshFailed)
    return promise
  }

  private refreshComplete(res) {
    Object.assign(this.store, res.data)
    // // console.log('ids updated', res.data);
    this.finish()
  }

  private refreshFailed() {
    this.finish()
  }

  private finish() {
    // Kill the inflight request
    this.inflightRequest = null
    // Dispatch event
    this.dispatcher.dispatch('change', this.store)
  }

  public addEventListener: FluroDispatcher['addEventListener']
  public removeEventListener: FluroDispatcher['removeEventListener']
  public removeAllListeners: FluroDispatcher['removeAllListeners']
}
