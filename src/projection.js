import Promise from 'bluebird';
import {ConfigurationError} from './errors';
import CreateProjector from './projector';

const Projection = {
  subscribeToEvents(handlers) {
    handlers.forEach(handler => {
      const eventName = handler.getName();
      this.messageBus.onEvent(eventName, this.runHandler(handler))
    })
  },

  applyHandlerToEvent(handler) {
    return function(payload)
  },



  /**
   * handleEvent
   *
   * Handles a single event off an event queue
   *
   * @param  {Event} evt The event to handle
   * @return {Object}     Resolves to the new state
   */
  handleEvent(evt) {
    const eventHandler = this.projector.getEventHandler(evt);
    if (!eventHandler) { return Promise.resolve(); }

    return this.getState(evt)
      .then(currentState => eventHandler.execute(evt.payload, currentState) || currentState)
      .tap(newState => eventHandler.onComplete(newState, evt))
      .tap(newState => this.onComplete(newState, evt));
  },

  onComplete(state, evt) { },
  getEvents() {
    return this.eventList;
  }

}

export default function CreateProjection(name, options) {
  if (typeof name !== 'string') {
    throw new ConfigurationError(`Projection 'name' must be a stirng`);
  }
  if (!options.events) {
    throw new ConfigurationError(`Missing 'events' property from Projection creation`);
  }

  // TODO: move 'required methods' in to the projector or event registry
  const projector = CreateProjector();

  // Ensure that each event handler has an onComplete method
  const missingOnComplete = events
    .filter(evt => typeof evt.onComplete !== 'function')
    .map(config => projector.eventRegistry.extractname(config));
  if (missingOnComplete.length) {
    throw new ConfigurationError(`These event handlers are missing an onComplete method: [${missingOnComplete.join(',')}]`)
  }


  const projection = Object.create(Projection);
  projection.name = name;
  projection.projector = projector;
  projection.projector.loadEventHandlers(options.events);
  projection.subscribeToEvents(projection.projector.getEventHandlers());

  projection.eventList = projection.projector.getEventHandlers().map(handler => handler.getName());

  return projection
}
