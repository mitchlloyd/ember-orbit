import Ember from 'ember';
import Orbit from 'orbit';
import Store from 'ember-orbit/store';
import Schema from 'ember-orbit/schema';
import 'ember-orbit/transaction';

export function initialize(application) {
  Orbit.Promise = Ember.RSVP.Promise;

  application.register('schema:main', Schema);
  application.register('service:store', Store);
  application.inject('service:store', 'schema', 'schema:main');
  application.inject('route', 'store', 'service:store');
  application.inject('controller', 'store', 'service:store');
}

export default {
  name: 'ember-orbit',
  initialize
};
