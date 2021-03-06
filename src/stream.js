import _cloneDeep from 'lodash/cloneDeep';
import Promise from 'bluebird';


/**
 * Removes events occurring before the snapshot
 * @param  {Snapshot} snapshot The stream snapshot
 * @param  {Array} events   Array of events
 * @return {Array}          Filtered array of events
 */
function trimEventsBeforeSnapshot(snapshot, events) {
  const snapVersion = (snapshot) ? snapshot.version : 0;
  return events.filter(evt => evt.version > snapVersion);
}

/**
 * Sort events by version number
 *
 * Throws an error if any event is missing a version number property
 *
 * @param  {Array} events The events to sort
 * @return {Array}        Sorted events array
 */
function sortEvents(events) {
  events = events || [];
  // make sure all events have a version number
  events.forEach(evt => {
    if (!evt.hasOwnProperty('version')) {
      const err = new Error('Malformed event: no version number');
      throw err;
    }
  })
  // sort the events array
  return events.sort((a, b) => a.version - b.version);
}

/**
* Determine the current version of the stream
*
* Finds the last event in the collection and sets the stream version
* the that event's version.  If there are no events, the version is 0.
*
* @return {Number} The version of the stream
*/
function inferVersion(events) {
  const eventCount = this.events.length;
  return (eventCount) ? this.events[eventCount].version : 0;
};





const Stream = {

  /**
   * Resets the state and onVersion iterator
   *
   * @return {Stream} This stream
   */
  reset: function() {
    this.onVersion = 0;
    this.state = null;
    return this;
  },



  getLatestVersion: function() {
    const snapshotVersion = (this.snapshot) ? this.snapshot.version : 0;
    const eventVersion = (this.events.length) ? this.events[this.events.length-1].version : 0;
    return (snapshotVersion > eventVersion) ? snapshotVersion : eventVersion;
  },

  /**
   * Adds an event to the stream
   *
   * @param  {Object} evt An event to add
   * @return {Event}     The added event
   */
  addEvent: function(evt) {

    const nextVersion = this.expectedNextVersion();
    evt.version = (evt.version && evt.version > 0) ? evt.version : nextVersion;

    if (evt.version != nextVersion) {
      throw new Error(`Event version mismatch: expected version ${nextVersion}, got version ${evt.version}`);
    }

    evt.meta    = Object.assign(evt.meta || {},
      this.meta, {
        aggregateId: this.aggregateId,
        aggregateType: this.aggregateType,
      }
    );

    this.uncommittedEvents.push(evt);
    return evt;
  },
  /**
   * Convenience function to add multiple events to the stream
   *
   * @param  {Array<Object>}  evts An array of events to add to the stream
   * @return {Stream}         This Stream object
   */
  addEvents: function(events) {
    if (!Array.isArray(events)) events = [events];
    events.forEach(evt => this.addEvent(evt));
    return this;
  },

  expectedNextVersion() {
    if (this.uncommittedEvents.length) {
      return this.uncommittedEvents[this.uncommittedEvents.length-1].version + 1;
    } else if (this.events.length) {
      return this.events[this.events.length-1].version + 1;
    } else if (this.snapshot && this.snapshot.version) {
      return this.snapshot.version + 1;
    } else {
      return 1;
    }
  },
  /**
   * Get the events collection
   * @return {Array<Object>} The array of events for this stream
   */
  getEvents: function(afterVersion=0) {
    const events = this.events.concat(this.uncommittedEvents);
    return events.filter(evt => evt.version > afterVersion);
  },
  /**
  * Get the array of uncommitted Events
  *
  * An uncommitted event is any event in the uncommitedEvents array
  *
  * @return {Array<Object>} The uncommittedEvents collection
  */
  getUncomittedEvents: function() {
    return this.uncommittedEvents;
  },

  getSnapshot: function() {
    return this.snapshot;
  },

  getCurrentState: function() {
    const initialState = {
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
    }

    return (this.snapshot && this.snapshot.state)
      ? Object.assign({}, initialState, _cloneDeep(this.snapshot.state))
      : initialState;
  },

  /**
   * Returns the version of the stream
   * @return {Number} Version of the last event
   */
  getVersion: function() {
    return this.version;
  },
  getAggregateId: function() {
    return this.aggregateId;
  },
  /**
   * Returns the version of the stream which has been committed
   * @return {Number} Committed version of the stream
   */
  getComittedVersion: function() {
    return (this.events.length)
      ? this.events[this.events.length-1].version
      : 0;
  },
  /**
   * Consider all events committed to the EventStore
   *
   * Moves the uncommitted events to the events array and clears the
   * uncommitted events array
   * @return {Stream}         This Stream object
   */
  commitAllEvents: function() {
    this.events = this.events.concat(this.uncommittedEvents);
    this.uncommittedEvents = [];
    return this;
  },
  /**
   * Consider all events to be incorporated in to the current state
   *
   * Simply updates the onVersion to equal the latest event Version
   * @return {Stream}         This Stream object
   */
  consumeAllEvents: function() {
    this.onVersion = this.getLatestVersion();
    return this;
  },

  /**
   * Extends the meta property of all uncommitted events
   */
  extendEvents: function(ext={}) {
    this.uncommittedEvents = this.uncommittedEvents.map(evt => {
      evt.meta = Object.assign((evt.meta || {}), ext);
      return evt;
    });
    return this;
  }
}

const StreamPrototype = Object.assign({}, Stream);

/**
 * Creates a Stream Object which holds aggregate events and current state
 * @param {Object|Stream} options [description]
 * @return {Stream} The new stream
 */
export default function CreateStream(options={}) {
  if (!options.aggregateId) {
    throw new Error('Missing aggregateId from stream creation');
  }
  if (!options.aggregateType) {
    throw new Error('Missing aggregateType from stream creation');
  }


  const stream = Object.create(StreamPrototype);

  stream.snapshot          = options.snapshot;
  stream.events            = [];
  stream.uncommittedEvents = [];
  stream.meta              = options.metaData;
  stream.aggregateType     = options.aggregateType;
  stream.aggregateId       = options.aggregateId;
  stream.onVersion         = 0;
  stream.state             = null;

  const events = sortEvents(trimEventsBeforeSnapshot(stream.snapshot, options.events || []));
  stream.addEvents(events);
  stream.commitAllEvents();

  return stream;
}
