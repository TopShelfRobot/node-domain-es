import CreateRegistry from './handlerRegistry';

const Projector = {
  project(...args) {
    return this._project.apply(this, args);
  },

  _project: function(stream) {
    const initialState = stream.getCurrentState();
    const events = stream.getEvents();

    return events.reduce((state, evt) => {
      const eventHandler = this.getEventHandler(evt);

      if (!eventHandler) {
        throw new Error(`Could not find event handler for ${evt.name} version ${evt.eventVersion}`);
      }

      return eventHandler.callback(evt.payload, state) || state;
    }, initialState);
  },

}


const EventRegistry = CreateRegistry({name: 'event', versionProperty: 'eventVersion'})
export const ProjectorPrototype = Object.assign({}, EventRegistry, Projector );


/**
 * Creates a projector
 * @param {Object}  options={} Options used to create Projector
 * @param {Any}     options.initialState Initialize the projector's state to this value
 * @param {Object}  options.eventHandlers Keys of the object are the eventTypes,
 *                                        values are the functions which mutate
 *                                        projector's state, given an event
 */
export default function CreateProjector(options={}) {
  const projector = Object.create(ProjectorPrototype);

  if (options.events) projector.registerEvents(options.events);

  return projector;
}
