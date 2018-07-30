const { AbstractRecordSource }      = require('loader-pipeline');
const https                         = require('https');
const CDEPublishedContentListing    = require('cde-published-content-listing');
const { HttpsAgent }                = require('agentkeepalive');

/**
 * This class implements a source that pulls from a the CDE PublishedContent 
 * listing service to get a list of URLs. This will include items that would
 * normally be excluded from search AND not contain files. (so less fetches)
 */
class PubcontentListSource extends AbstractRecordSource {

    /**
     * Creates a new instance of a SitemapSource
     * @param {logger} logger An instance of a logger.
     * @param {CDEPublishedContentListing} client the published listing client
     * @param {Object} param2 A configuration object
     * @param {string} param2.sitemapUrl The url to the sitemap
     */
    constructor(logger, client, { hostname="", sitemapUrl = false, additionalUrls = [], ignoreUrls = [] } = {}) {
        super(logger);

        if (!client) {
            throw new Error("You must supply a CDEPublishedContentListing client")
        }

        if (!hostname || typeof hostname !== 'string') {
            throw new Error("PubcontentListSource requires a hostname")
        }

        if (!additionalUrls || !Array.isArray(additionalUrls)) {
            throw new Error("PubcontentListSource additionalUrls must be an array")
        }

        if (!ignoreUrls || !Array.isArray(ignoreUrls)) {
            throw new Error("PubcontentListSource ignoreUrls must be an array")
        }

        this.client = client;
        this.sitemapUrl = sitemapUrl;
        this.additionalUrls = additionalUrls;
        this.ignoreUrls = ignoreUrls;
        this.hostname = hostname
    }

    /**
     * Called before any resources are loaded.
     */
    async begin() {
        return;
    }

    async fetchInstructionsRecursive(path) {

        const res = await this.client.getItemsForPath('PageInstructions', path);

        //Map directories to a promise and await
        const files = [
            ...(res.Files.map(f => `https://${this.hostname}${f.FullWebPath.replace('/PublishedContent/PageInstructions', "").replace(".xml", "")}`)),
            ...(await this.fetchDirs(res, path))
        ]

        return files;
    }

    async fetchDirs(res, parentPath) {

        if (res.Directories.length === 0) {
            return [];
        }

        const childFiles = (await Promise.all(
            res.Directories.map(dir => this.fetchInstructionsRecursive([
                ...parentPath,
                dir
            ]))
        )).reduce((ac,c) => [
            ...ac,
            ...c
        ],[]);

        return childFiles;
    }


    /**
     * Get a collection of resources from this source
     */
    async getRecords() {

        const urls = await this.fetchInstructionsRecursive('/');

        const excludes = new Set(this.ignoreUrls);
        const fullList = new Set(
            [
                ...urls,
                ...this.additionalUrls
            ].filter(url => !excludes.has(url))
        );
        const uniqueList = Array.from(fullList);

        return uniqueList;
    }

    /**
     * Method called after all resources have been loaded
     */
    async end() {
        return;
    }
    
    /**
     * Called upon a fatal loading error. Use this to clean up any items created on startup
     */
    async abort() {
        return;
    }    

    /**
     * A static method to validate a configuration object against this module type's schema
     * @param {Object} config configuration parameters to use for this instance.
     * @param {string} config.hostname The URL for the source github repo
     */
    static ValidateConfig(config) {
        let errors = [];

        if (!config["hostname"] || typeof config.hostname !== 'string') {
            errors.push(new Error("You must supply a hostname"));
        }        

        return errors;
    }        

    /**
     * A static helper function to get a configured source instance
     * @param {Object} logger the logger to use
     * @param {Object} config configuration parameters to use for this instance. See GithubResourceSource constructor.
     */
    static async GetInstance(logger, config) {
        if (!config) {
            throw new Error("Config must be supplied");
        }

        if (!config.hostname) {
            throw new Error("You must supply a source hostname");
        }

        //TODO: Find a better way to manage the agent so there can be one agent per 
        //application.  (and thus one pool of sockets)
        const agent = new HttpsAgent({
            maxSockets: 40
        });

        //Get instance of content listing with our custom https agent
        const client = new CDEPublishedContentListing(config.hostname, agent);

        return new PubcontentListSource(logger, client, config);
    }
}

module.exports = PubcontentListSource;