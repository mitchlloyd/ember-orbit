import OrbitSchema from 'orbit-common/schema';

/**
 @module ember-orbit
 */

const {
  get,
  getOwner
} = Ember;

function proxyProperty(source, property, defaultValue) {
  const _property = '_' + property;

  return Ember.computed({
    set: function(key, value) {
      if (arguments.length > 1) {
        this[_property] = value;
        if (this[source]) {
          this[source][property] = value;
        }
      }
      if (!this[_property]) {
        this[_property] = defaultValue;
      }
      return this[_property];
    },
    get: function() {
      if (!this[_property]) {
        this[_property] = defaultValue;
      }
      return this[_property];
    }
  });
}

export default Ember.Object.extend({
  orbitSchema: null,

  /**
   @property pluralize
   @type {function}
   @default OC.Schema.pluralize
   */
  pluralize: proxyProperty('orbitSchema', 'pluralize'),

  /**
   @property singularize
   @type {function}
   @default OC.Schema.singularize
   */
  singularize: proxyProperty('orbitSchema', 'singularize'),

  init() {
    this._super(...arguments);
    this._modelTypeMap = {};

    if (!this.orbitSchema) {
      // Don't use `modelDefaults` in ember-orbit.
      // The same functionality can be achieved with a base model class that
      // can be overridden.
      const options = {
        modelDefaults: {}
      };

      const pluralize = this.get('pluralize');
      if (pluralize) {
        options.pluralize = pluralize;
      }

      const singularize = this.get('singularize');
      if (singularize) {
        options.singularize = singularize;
      }

      this.orbitSchema = new OrbitSchema(options);

      // Lazy load model definitions as they are requested.
      const _this = this;
      this.orbitSchema.modelNotDefined = function(type) {
        _this.modelFor(type);
      };
    }
  },

  defineModel: function(type, modelClass) {
    const definedModels = this.orbitSchema.models;
    if (definedModels[type]) return;

    this.orbitSchema.registerModel(type, {
      id: get(modelClass, 'id'),
      keys: get(modelClass, 'keys'),
      attributes: get(modelClass, 'attributes'),
      relationships: get(modelClass, 'relationships')
    });
  },

  modelFor: function(type) {
    Ember.assert("`type` must be a string", typeof type === 'string');

    var model = this._modelTypeMap[type];
    if (!model) {
      model = getOwner(this)._lookupFactory('model:' + type);

      if (!model) {
        throw new Ember.Error("No model was found for '" + type + "'");
      }

      model.typeKey = type;

      // ensure model is defined in underlying OC.Schema
      this.defineModel(type, model);

      // save model in map for faster lookups
      this._modelTypeMap[type] = model;

      // look up related models
      this.relationships(type).forEach(relationship => {
        this.modelFor(this.relationshipProperties(type, relationship).model);
      });
    }

    return model;
  },

  models: function() {
    return Object.keys(this.orbitSchema.models);
  },

  keys: function(type) {
    return Object.keys(this.orbitSchema.modelDefinition(type).keys);
  },

  keyProperties: function(type, name) {
    return this.orbitSchema.modelDefinition(type).keys[name];
  },

  attributes: function(type) {
    return Object.keys(this.orbitSchema.modelDefinition(type).attributes);
  },

  attributeProperties: function(type, name) {
    return this.orbitSchema.modelDefinition(type).attributes[name];
  },

  relationships: function(type) {
    return Object.keys(this.orbitSchema.modelDefinition(type).relationships);
  },

  relationshipProperties: function(type, name) {
    return this.orbitSchema.modelDefinition(type).relationships[name];
  },

  normalize(properties) {
    const normalizedProperties  = {
      id: properties.id,
      type: properties.type,
      keys: {},
      attributes: {},
      relationships: {}
    };

    this.normalizeKeys(properties, normalizedProperties);
    this.normalizeAttributes(properties, normalizedProperties);
    this.normalizeRelationships(properties, normalizedProperties);
    this.orbitSchema.normalize(normalizedProperties);

    return normalizedProperties;
  },

  normalizeKeys(properties, normalizedProperties) {
    this.keys(properties.type).forEach(key => {
      normalizedProperties.keys[key] = properties[key];
    });
  },

  normalizeAttributes(properties, normalizedProperties) {
    const attributes = this.attributes(properties.type);

    attributes.forEach(attribute => {
      normalizedProperties.attributes[attribute] = properties[attribute];
    });
  },

  normalizeRelationships(properties, normalizedProperties) {
    // Normalize links to IDs contained within the `__rel` (i.e. "forward link")
    // element.

    if (!normalizedProperties.relationships) {
      normalizedProperties.relationships = {};
    }

    this.relationships(properties.type).forEach(relationshipName => {
      const relationshipProperties = this.relationshipProperties(properties.type, relationshipName);
      this._normalizeRelationship(properties, normalizedProperties, relationshipName, relationshipProperties);
    });
  },

  _normalizeRelationship(properties, normalizedProperties, relationshipName, relationshipProperties) {
    const value = properties[relationshipName];
    if (!value) return;

    const relationship = normalizedProperties.relationships[relationshipName] = {};
    const modelType = relationshipProperties.model;

    if (Ember.isArray(value)) {
      relationship.data = {};

      value.forEach(function(id) {
        if (typeof id === 'object') {
          id = get(id, 'id');
        }
        const identifier = [modelType, id].join(':');
        relationship.data[identifier] = true;
      });

    } else if (typeof value === 'object') {

      const identifier = [modelType, get(value, 'id')].join(':');
      relationship.data = identifier;

    } else {
      relationship.data = [modelType, value].join(':');
    }
  }
});
