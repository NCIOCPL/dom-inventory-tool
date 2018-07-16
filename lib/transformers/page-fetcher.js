const { AbstractRecordTransformer } = require('loader-pipeline');
const axios                         = require('axios');
const https                         = require('https');

class PageFetcher extends AbstractRecordTransformer {

    constructor(logger, axclient, config) {
        super(logger);

        this.axclient = axclient;
    }

    /**
     * Called before any resources are transformed -- load mappers and anything else here.
     */
    async begin() {
        return;
    }

    /**
     * Transforms the resource 
     * @param {Object} data the object to be transformed
     * @returns the transformed object
     */
    async transform(url) {

        let res;
        try {
            res = await this.axclient.get(url);
        } catch (err) {
            logger.error(`Could not fetch url, ${url}.`)
            throw err;
        }

        if (res.status !== 200) {
            throw new Error(`Bad status, ${res.status} , while fetching url ${url}`)
        }

        //If it is not HTML, then we need to move on.
        if (res.headers['content-type'] !== 'text/html; charset=utf-8') {
            return undefined;
        }

        return {
            url: url,
            content: res.data
        };
    }

    /**
     * Method called after all resources have been transformed
     */
    async end() {
        return; //I have nothing to do here...
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
     */
    static ValidateConfig(config) {

        let errors = [];        

        return errors;
    }

    static async GetInstance(logger, config) {

        //TODO: Find a better way to manage the agent so there can be one agent per 
        //application.  (and thus one pool of sockets)
        const agent = new https.Agent({
            keepAlive: true,
            maxSockets: 80
        });

        //Get instance of axios with our custom https agent
        const axiosInstance = axios.create({
            httpsAgent: agent
        })

        return new PageFetcher(logger, axiosInstance, config);
    }    
}

module.exports = PageFetcher;