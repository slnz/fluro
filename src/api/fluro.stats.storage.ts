import { get } from 'lodash'

import type FluroCore from './fluro.core'
import FluroDispatcher from './fluro.dispatcher'

// This is the bucket for each kind of global stat
export default class FluroStatsStorage {
  inflightRequest: Promise<unknown> | null
  store: {
    key: string
    name: string
    total: number
  }

  processing = false
  dispatcher: FluroDispatcher
  constructor(
    private core: FluroCore,
    private statName: string,
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
      name: statName,
      total: 0
    }

    this.inflightRequest = this.refresh().then(
      this.refreshComplete,
      this.refreshFailed
    )
  }

  get name() {
    return this.store.name
  }

  get key() {
    return this.store.key
  }

  refresh(): Promise<unknown> {
    if (this.inflightRequest) {
      return this.inflightRequest
    }

    let url = `${this.core.apiURL}/stat/${this.targetID}/${this.statName}`

    if (this.unique) {
      url += '?unique=true'
    }

    const loggedInUser = this.core.auth.getCurrentUser()

    // If we are logged in as a user or an application
    if (loggedInUser || this.core.applicationToken) {
      this.inflightRequest = this.core.api.get(url, { cache: false })
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
    this.store.total = total
    this.finish()
  }

  private refreshFailed() {
    this.finish()
  }

  private finish() {
    this.processing = false
    this.dispatcher.dispatch('change', this.store)
    this.inflightRequest = null
  }

  public dispatch: FluroDispatcher['dispatch']
  public addEventListener: FluroDispatcher['addEventListener']
  public removeEventListener: FluroDispatcher['removeEventListener']
  public removeAllListeners: FluroDispatcher['removeAllListeners']
}
