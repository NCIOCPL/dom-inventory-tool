const { AbstractRecordSource }  = require('loader-pipeline');
const https                     = require('https');
const sitemapper                = require('sitemapper');

/**
 * This class implements a Resource Source wherin the content lives in the 
 * r4rcontent structure of Github.
 */
class SitemapSource extends AbstractRecordSource {

    /**
     * Creates a new instance of a SitemapSource
     * @param {logger} logger An instance of a logger.
     * @param {Object} param2 A configuration object
     * @param {string} param2.sitemapUrl The url to the sitemap
     */
    constructor(logger, { sitemapUrl = false } = {}) {
        super(logger);

        if (!sitemapUrl || typeof sitemapUrl !== 'string') {
            throw new Error("SitemapSource requires a sitemapUrl")
        }

        this.sitemapUrl = sitemapUrl;
    }

    /**
     * Called before any resources are loaded.
     */
    async begin() {
        return;
    }

    /**
     * Get a collection of resources from this source
     */
    async getRecords() {
        const sitemap = new sitemapper({
            url: this.sitemapUrl,
            timeout: 120000
        })

        const res = await sitemap.fetch();

        return res.sites;
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
     * @param {string} config.repoUrl The URL for the source github repo
     */
    static ValidateConfig(config) {
        let errors = [];

        if (!config["sitemapUrl"] || typeof config.sitemapUrl !== 'string') {
            errors.push(new Error("You must supply a sitemap URL"));
        }        

        return errors;
    }        

    /**
     * A static helper function to get a configured source instance
     * @param {Object} logger the logger to use
     * @param {Object} config configuration parameters to use for this instance. See GithubResourceSource constructor.
     */
    static async GetInstance(logger, config) {
        return new SitemapSource(logger, config);
    }
}

module.exports = SitemapSource;