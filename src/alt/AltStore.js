import EventEmitter from 'eventemitter3'
import assign from 'object-assign'
import Symbol from 'es-symbol'
import { warn, deprecatedBeforeAfterEachWarning } from './utils/warnings'
import {
  ALL_LISTENERS,
  LIFECYCLE,
  LISTENERS,
  PUBLIC_METHODS,
  STATE_CHANGED,
  STATE_CONTAINER
} from './symbols/symbols'

// alt container
const ALT = Symbol()
// event emitter instance
const EE = Symbol()

export default class AltStore {
  constructor(alt, model, state, StoreModel) {
    this[ALT] = alt
    this[EE] = new EventEmitter()
    this[LIFECYCLE] = {}
    this[STATE_CHANGED] = false
    this[STATE_CONTAINER] = state || model

    this._storeName = model._storeName
    this.boundListeners = model[ALL_LISTENERS]
    this.StoreModel = StoreModel
    if (typeof this.StoreModel === 'object') {
      this.StoreModel.state = assign({}, StoreModel.state)
    }

    assign(this[LIFECYCLE], model[LIFECYCLE])
    assign(this, model[PUBLIC_METHODS])

    // Register dispatcher
    this.dispatchToken = alt.dispatcher.register((payload) => {
      if (model[LIFECYCLE].beforeEach) {
        model[LIFECYCLE].beforeEach(
          payload.action.toString(),
          payload.data,
          this[STATE_CONTAINER]
        )
      } else if (typeof model.beforeEach === 'function') {
        deprecatedBeforeAfterEachWarning()
        model.beforeEach(
          payload.action.toString(),
          payload.data,
          this[STATE_CONTAINER]
        )
      }

      if (model[LISTENERS][payload.action]) {
        let result = false

        try {
          result = model[LISTENERS][payload.action](payload.data)
        } catch (e) {
          if (this[LIFECYCLE].error) {
            this[LIFECYCLE].error(
              e,
              payload.action.toString(),
              payload.data,
              this[STATE_CONTAINER]
            )
          } else {
            throw e
          }
        }

        if (result !== false || this[STATE_CHANGED]) {
          this.emitChange()
        }

        this[STATE_CHANGED] = false
      }

      if (model[LIFECYCLE].afterEach) {
        model[LIFECYCLE].afterEach(
          payload.action.toString(),
          payload.data,
          this[STATE_CONTAINER]
        )
      } else if (typeof model.afterEach === 'function') {
        deprecatedBeforeAfterEachWarning()
        model.afterEach(
          payload.action.toString(),
          payload.data,
          this[STATE_CONTAINER]
        )
      }
    })

    if (this[LIFECYCLE].init) {
      this[LIFECYCLE].init()
    }
  }

  getEventEmitter() {
    return this[EE]
  }

  emitChange() {
    this[EE].emit('change', this[STATE_CONTAINER])
  }

  listen(cb) {
    this[EE].on('change', cb)
    return () => this.unlisten(cb)
  }

  unlisten(cb) {
    if (this[LIFECYCLE].unlisten) {
      this[LIFECYCLE].unlisten()
    }
    this[EE].removeListener('change', cb)
  }

  prepare(state) {
    const data = {}
    data[this._storeName] = state
    return this[ALT].serialize(data)
  }

  getState() {
    return this[ALT].getState(this[STATE_CONTAINER])
  }
}
