
const { AbstractRecordLoader }  = require('loader-pipeline');

/**
 * This class implements an Elasticsearch Resource loader
 */
class InventoryLoader extends AbstractRecordLoader {

    /**
     * Creates a new instance of an InventoryLoader
     * @param {logger} logger An instance of a logger.
     */
    constructor(
        logger,
        config
    ) {
        super(logger);
    }

    /**
     * Called before any resources are loaded.
     */
    async begin() {
        return;
    }

    /**
     * Loads a resource into the data store
     */
    async loadRecord(record) {
        return;
    }
    
    /**
     * Called upon a fatal loading error. Use this to clean up any items created on startup
     */
    async abort() {
        return;
    }

    /**
     * Method called after all resources have been loaded
     */
    async end() {
        return;
    }

    /**
     * A static method to validate a configuration object against this module type's schema
     * @param {Object} config configuration parameters to use for this instance.
     */
    static ValidateConfig(config) {
        let errors = [];

        return errors;
    }

    /**
     * A static helper function to get a configured source instance
     * @param {Object} logger the logger to use
     * @param {Object} config configuration parameters to use for this instance.
     * @param {string|string[]} config.eshosts An array of elasticsearch hosts
     * @param {number} config.bufferSize the number of resources to wait for until sending to ES.
     * @param {number} config.daysToKeep the number of days to keep indices for.
     * @param {number} config.minIndexesToKeep the minimum number of indices to keep.
     * @param {number} config.aliasName the name of the alias to use for this collection.
     * @param {string} config.mappingPath the path to the mappings file
     * @param {string} config.settingsPath the path to the settings file
     */
    static async GetInstance(logger, config) {
        return new InventoryLoader(logger, config);
    }    
}

module.exports = InventoryLoader;