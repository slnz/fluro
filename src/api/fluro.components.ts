/**
 * Creates a new FluroComponents instance.
 * This module provides a number of helper functions for working with Fluro components
 * @alias components
 * @constructor
 * @hideconstructor
 * @param {FluroCore} fluro A reference to the parent instance of the FluroCore module. This module is usually created by a FluroCore instance that passes itself in as the first argument.
 */
export default class FluroComponents {
  debug = false

  constructor(private fluro) {
    if (!this.fluro.utils) {
      throw new Error(
        `Can't Instantiate FluroComponents before FluroUtils exists`
      )
    }
  }

  /**
   * Hydrates a data model by providing the component id
   * @alias components.hydrateModel
   * @param  {String} componentID The id of the component that defines the fields
   * @param  {Object} model       The data model to hydrate
   * @return {Object}             A copy of the data model with all references populated
   */
  hydrateModel(componentID, model) {
    return new Promise((resolve, reject) => {
      this.fluro.api
        .post(`${this.fluro.apiURL}/components/${componentID}/hydrate`, model)
        .then((res) => {
          resolve(res.data)
        })
        .catch(reject)
    })
  }

  loadComponentModule(componentID, options) {
    if (!options) {
      options = {
        fields: true
      }
    }
    const promise = this.fluro.utils.injectModule(
      `${this.fluro.apiURL}/components/${componentID}/module`,
      options
    )
    return promise
  }
}
