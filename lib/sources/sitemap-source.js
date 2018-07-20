const { AbstractRecordSource }  = require('loader-pipeline');
const https                     = require('https');
const sitemapper                = require('sitemapper');

/**
 * This class implements a source that pulls from an XML site map to
 * get a list of URLs.
 */
class SitemapSource extends AbstractRecordSource {

    /**
     * Creates a new instance of a SitemapSource
     * @param {logger} logger An instance of a logger.
     * @param {Object} param2 A configuration object
     * @param {string} param2.sitemapUrl The url to the sitemap
     */
    constructor(logger, { sitemapUrl = false, additionalUrls = [], ignoreUrls = [] } = {}) {
        super(logger);

        if (!sitemapUrl || typeof sitemapUrl !== 'string') {
            throw new Error("SitemapSource requires a sitemapUrl")
        }

        if (!additionalUrls || !Array.isArray(additionalUrls)) {
            throw new Error("SitemapSource additionalUrls must be an array")
        }

        if (!ignoreUrls || !Array.isArray(ignoreUrls)) {
            throw new Error("SitemapSource ignoreUrls must be an array")
        }

        this.sitemapUrl = sitemapUrl;
        this.additionalUrls = additionalUrls;
        this.ignoreUrls = ignoreUrls;
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

        const excludes = new Set(this.ignoreUrls);
        const fullList = new Set([
            ...res.sites,
            ...this.additionalUrls
        ]).filter(url => !excludes.has(url));

        return fullList;        
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