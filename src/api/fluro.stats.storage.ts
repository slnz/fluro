import { get } from 'lodash'

import FluroDispatcher from './fluro.dispatcher'

// This is the bucket for each kind of global stat
export default class FluroStatsStorage {
  inflightRequest
  total = 0
  store
  processing = false
  dispatcher: FluroDispatcher
  constructor(
    private Fluro,
    private statName,
    private targetID,
    private unique
  ) {
    // Create a new dispatcher
    this.dispatcher = new FluroDispatcher()
    this.dispatcher.bootstrap(this)

    let key = statName
    if (unique) {
      key = '_' + key
    }

    this.store = {
      key,
      name: statName
    }

    // Create the getters
    Object.defineProperty(this, 'key', {
      value: key,
      writable: false
    })

    // Create the getters
    Object.defineProperty(this, 'name', {
      value: statName,
      writable: false
    })
    this.inflightRequest = this.refresh().then(
      this.refreshComplete,
      this.refreshFailed
    )
  }

  refresh() {
    if (this.inflightRequest) {
      return this.inflightRequest
    }

    let url = `${this.Fluro.apiURL}/stat/${this.targetID}/${this.statName}`

    if (this.unique) {
      url += '?unique=true'
    }

    const loggedInUser = this.Fluro.auth.getCurrentUser()

    // If we are logged in as a user or an application
    if (loggedInUser || this.Fluro.applicationToken) {
      this.inflightRequest = this.Fluro.api.get(url, { cache: false })
    } else {
      this.inflightRequest = new Promise((resolve) => {
        return resolve([])
      })
    }

    this.processing = true
    this.inflightRequest.then(this.refreshComplete, this.refreshFailed)

    return this.inflightRequest
  }

  private refreshComplete(res) {
    const total = get(res, 'data.total')

    this.store.total = this.total = total

    // console.log(total)
    this.finish()
  }

  private refreshFailed(err) {
    console.log(err)
    this.finish()
  }

  private finish() {
    this.processing = false

    // Dispatch event
    // console.log('UPDATED WITH NEW STATS', store.total);

    this.dispatcher.dispatch('change', this.store)

    // Kill the inflight request
    this.inflightRequest = null
  }

  public dispatch: FluroDispatcher['dispatch']
  public addEventListener: FluroDispatcher['addEventListener']
  public removeEventListener: FluroDispatcher['removeEventListener']
  public removeAllListeners: FluroDispatcher['removeAllListeners']
}
