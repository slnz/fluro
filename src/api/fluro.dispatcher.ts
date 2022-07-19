export default class FluroDispatcher {
  listeners = {}

  /**
   * Removes all listening callbacks for all events
   */
  removeAllListeners() {
    this.listeners = {}
  }

  /**
   * Dispatches an event
   * @param {String} event The event to listen for
   * @param details an object to pass to callback functions
   */
  dispatch(event, details?) {
    if (this.listeners[event]) {
      // For each listener
      this.listeners[event].forEach((callback) => {
        // Fire the callback
        return callback(details)
      })
    }
  }

  /**
   * Adds a callback that will be triggered whenever the specified event occurs
   * @param {String} event The event to listen for
   * @param {Function} callback The function to fire when this event is
   * triggered
   */
  addEventListener(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    if (this.listeners[event].indexOf(callback) === -1) {
      // Add to the listeners
      this.listeners[event].push(callback)
    } else {
      // Already listening
    }
  }

  /**
   * Removes all a callback from the listener list
   * @param {String} event The event to stop listening for
   * @param {Function} callback The function to remove from the listener list
   */
  removeEventListener(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    // Get the index of the listener
    const index = this.listeners[event].indexOf(callback)
    if (index !== -1) {
      // Remove from the listeners
      this.listeners[event].splice(index, 1)
    }
  }

  /**
   * Wrap the event listener functionality
   */
  bootstrap(service) {
    if (!service) {
      return
    }
    if (service.dispatch === null) {
      service.dispatch = this.dispatch
    }
    service.addEventListener = this.addEventListener
    service.removeEventListener = this.removeEventListener
    service.removeAllListeners = this.removeAllListeners
  }
}
