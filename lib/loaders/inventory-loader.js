
const { AbstractRecordLoader }  = require('loader-pipeline');
const elasticsearch             = require('elasticsearch');
const path                      = require('path');
const ElasticTools              = require('elastic-tools');
/**
 * This class implements an Elasticsearch Resource loader
 */
class InventoryLoader extends AbstractRecordLoader {

    /**
     * Creates a new instance of an InventoryLoader
     * @param {logger} logger An instance of a logger.
     * @param {ElasticTools} estools An instance of ElasticTools
     * @param {object} mappings the ES mapping config
     * @param {object} settings the ES mapping config
     * @param {object} config the step config
     * @param {object} config.daysToKeep the number of days of indices to keep 
     * @param {object} config.minIndexesToKeep the number of days of indices to keep  
     * @param {object} config.aliasName the alias name for this pipeline collection
     */
    constructor(
        logger,
        estools,
        mappings,
        settings, 
        {
            daysToKeep = 10,
            minIndexesToKeep = 2,
            aliasName = false
        } = {}
    ) {
        super(logger);

        if (!aliasName || typeof aliasName !== 'string') {
            throw new Error("aliasName is required for the elastic loader");
        }
        this.aliasName = aliasName;

        if (!daysToKeep || typeof daysToKeep !== 'number') {
            throw new Error("daysToKeep is required for the elastic loader");
        }
        this.daysToKeep = daysToKeep;

        if (!minIndexesToKeep || typeof minIndexesToKeep !== 'number') {
            throw new Error("minIndexesToKeep is required for the elastic loader");
        }
        this.minIndexesToKeep = minIndexesToKeep;

        this.estools = estools;

        this.indexName = false;

        this.mappings = mappings;
        this.settings = settings;

        this.buffer = [];
        this.bufferSize = 100;

        this.totalIndexed = 0;
        this.documentsProcessed = 0;      
        this.documentsQueued = 0;  
        this.documentsSkipped = 0;
    }

    /**
     * Called before any resources are loaded.
     */
    async begin() {
        try {            
            this.indexName = await this.estools.createTimestampedIndex(this.aliasName, this.mappings, this.settings);
        } catch (err) {
            this.logger.error(`Failed to create index ${this.indexName}`)
            throw err;
        }
    }

    /**
     * Loads a resource into the data store
     */
    async loadRecord(record) {

        if (this.documentsProcessed % 100 === 0) {
            this.logger.debug(`InventoryLoader: Processed ${this.documentsProcessed}, queued: ${this.documentsQueued}, loaded: ${this.totalIndexed}, Skipped: ${this.documentsSkipped}`)
        }
        this.documentsProcessed = this.documentsProcessed + 1;

        if (!record) {
            this.documentsSkipped = this.documentsSkipped + 1;
            return;
        }

        this.buffer.push(record);
        this.documentsQueued = this.documentsQueued + 1;

        if (this.buffer.length >= this.bufferSize) {
            await this.indexBuffer();
        }
    }

    async indexBuffer() {
        console.log(this.buffer.length)
        //Update our counter.
        const recordsToIndex = this.buffer.length;
        this.totalIndexed = this.totalIndexed + recordsToIndex;
        
        const docArr = this.buffer.reduce((ac, c, ci) => [
            ...ac,
            [ c.url, c]
        ], []);

        //Take off the buffer before indexDocumentBulk goes into wait.
        //Technically while index is awaiting, other docs will get added
        //to the queue.
        this.buffer = [];

        let res;
        try {
            this.logger.debug(`Flushing ES Buffer`);
            //TODO: Fix this, pageinfo should not be hardcoded.  ID field should not either...
            res = await this.estools.indexDocumentBulk(this.indexName, "pageinfo", docArr);            
            this.logger.debug(`Flushed ${recordsToIndex} records, total ${this.totalIndexed} `);
        } catch(err) {
            this.logger.error(`Could not bulk index`);
            throw err;
        }

        //Check to see if this is how we expected things to go...
        if (res.updated.length) {
            const message = `Indexing appears to have duplicates`
            this.logger.error(message);
            throw new Error(message);
        } else if (res.errors.length) {
            const message = `Indexing appears had document errors`
            this.logger.error(message);
            throw new Error(message);
        }
    }
    
    /**
     * Called upon a fatal loading error. Use this to clean up any items created on startup
     */
    async abort() {
        throw new Error("Not Implemented");
    }

    /**
     * Method called after all resources have been loaded
     */
    async end() {

        //Clear out the buffer
        if (this.buffer.length){
            await this.indexBuffer();
        }

        this.logger.debug(`InventoryLoader: Processed ${this.documentsProcessed}, queued: ${this.documentsQueued}, loaded: ${this.totalIndexed}, Skipped: ${this.documentsSkipped}`)

        try {
            //optimize the index
            await this.estools.optimizeIndex(this.indexName);

            //swap the alias
            await this.estools.setAliasToSingleIndex(this.aliasName, this.indexName);

            //Clean up old indices
            try {
                await this.estools.cleanupOldIndices(this.aliasName, this.daysToKeep, this.minIndexesToKeep);
            } catch (err) {
                this.logger.error("Could not cleanup old indices");
                throw err;
            }
    
        } catch (err) {
            this.logger.error("Errors occurred during end process");
            throw err;
        }
    }

    /**
     * A static method to validate a configuration object against this module type's schema
     * @param {Object} config configuration parameters to use for this instance.
     */
    static ValidateConfig(config) {
        let errors = [];

        if (!config["mappingPath"] || typeof config.mappingPath !== 'string') {
            errors.push( new Error("mappingPath is required for the elastic loader") );
        }

        if (!config["settingsPath"] || typeof config.settingsPath !== 'string') {
            errors.push( new Error("settingsPath is required for the elastic loader") );
        }

        //TODO: This should be a better check...
        if (!config.eshosts) {
            errors.push( new Error("eshosts is required for the elastic loader"));
        }        

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
        const appRoot = path.join(__dirname, '..', '..');

        let mappings;
        if (!config["mappingPath"] || typeof config.mappingPath !== 'string') {
            throw new Error("mappingPath is required for the elastic loader");
        }
        const mapFullPath = path.join(appRoot, config["mappingPath"]);
        try {             
            mappings = require(mapFullPath);
        } catch (err) {            
            throw new Error(`mappingPath cannot be loaded: ${mapFullPath}`);
        }        

        let settings;
        if (!config["settingsPath"] || typeof config.settingsPath !== 'string') {
            throw new Error("settingsPath is required for the elastic loader");
        }
        const settingsFullPath = path.join(appRoot, config["settingsPath"]);
        try {
            settings = require(settingsFullPath);
        } catch (err) {
            throw new Error(`settingsPath cannot be loaded: ${settingsFullPath}`);
        }

        //TODO: This should be a better check...
        if (!config.eshosts) {
            throw new Error("eshosts is required for the elastic loader");
        }

        const estools = new ElasticTools(logger, new elasticsearch.Client({
            hosts: config.eshosts,
            maxSockets: 20,
            keepAlive: true
        }))

        return new InventoryLoader(
            logger, 
            estools,
            mappings,
            settings, 
            {
                ...config,
                settingsPath:undefined,
                mappingPath:undefined,
                eshosts: undefined
            }
        );
    }    
}

module.exports = InventoryLoader;