const { AbstractRecordTransformer } = require('loader-pipeline');
const axios                         = require('axios');
const https                         = require('https');
const path                          = require('path');
const fs                            = require('fs');
const util                          = require('util');
const { HttpsAgent }                = require('agentkeepalive');

const statAsync = util.promisify(fs.stat);
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);
const timeout = util.promisify(setTimeout);

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

class PageFetcher extends AbstractRecordTransformer {

    constructor(logger, axclient, config) {
        super(logger);

        this.axclient = axclient;

        this.cacheFolderPath = path.join(__dirname, "../../html-cache");        
        this.ioQueueMaxHandles = 50; //The maximum open read & write file handles. We wont worry about stat handles for now
        this.ioQueueOpenHandles = 0;
        this.ioQueueHandleWait = 50;

        this.instrumenting = false;
        this.stats = {
            pendingRequests: 0,
            pendingStats: 0,
            pendingReads: 0,
            pendingWrites: 0
        }
    }

    updateStats(statType, op) {
        if (!this.instrumenting) {
            return;
        }

        if (op === '+') {
            this.stats['pending' + statType]++;
        } else if (op === '-') {
            this.stats['pending' + statType]--;
        } else {
            throw new Error("Unknown stat update operand")
        }
        this.printStats(statType + op);
    }

    printStats(prefix) {
        if (!this.instrumenting)
            return;
        this.logger.debug(`PageFetcher:\t\t${prefix}: Stats: ${this.stats.pendingStats}, Reads: ${this.stats.pendingReads}, Writes: ${this.stats.pendingWrites}, Net: ${this.stats.pendingRequests}`);
    }

    async instStat(filePath) {        
        let stat;
        try {
            this.updateStats("Stats", "+");
            stat = await statAsync(filePath);
            this.updateStats("Stats", "-");
        } catch (err) {
            this.updateStats("Stats", "-");
            throw err;
        }
        return stat;
    }

    async instReadFile(filePath, enc) {
        let content;
        try {
            this.updateStats("Reads", "+");
            content = await this.queuedFileRead(filePath, enc)
            this.updateStats("Reads", "-");
        } catch (err) {
            this.updateStats("Reads", "-");
            throw err;
        }
        return content;
    }

    async instWriteFile(filePath, pageContent) {
        try {
            this.updateStats("Writes", "+");
            await this.queuedFileWrite(filePath, pageContent);            
            this.updateStats("Writes", "-");
        } catch (err) {
            this.updateStats("Writes", "-");
            throw err;
        }
    }

    async instNetReq(url) {
        let res;
        try {
            this.updateStats("Requests", "+");
            res = await this.axclient.get(url);
            this.updateStats("Requests", "-");
        } catch (err) {
            this.updateStats("Requests", "-");
            throw err;            
        }
        return res;
    }

    async queuedFileWrite(filePath, pageContent) {

        if (this.ioQueueOpenHandles <= this.ioQueueMaxHandles) {
            try {
                this.ioQueueOpenHandles++;
                await writeFileAsync(filePath, pageContent);
                this.ioQueueOpenHandles--;
            } catch (err) {
                this.ioQueueOpenHandles--;
                throw err;
            }
        } else {
            await timeout(this.ioQueueHandleWait); //Wait if a space opens
            await this.queuedFileWrite(filePath, pageContent);
        }
    }

    async queuedFileRead(filePath, enc) {

        if (this.ioQueueOpenHandles <= this.ioQueueMaxHandles) {
            try {
                this.ioQueueOpenHandles++;
                const content = await readFileAsync(filePath, enc);
                this.ioQueueOpenHandles--;
                return content;
            } catch (err) {
                this.ioQueueOpenHandles--;
                throw err;
            }
        } else {
            await timeout(this.ioQueueHandleWait); //Wait if a space opens
            return await this.queuedFileRead(filePath, enc);
        }
    }

    /**
     * Called before any resources are transformed -- load mappers and anything else here.
     */
    async begin() {
        return;
    }

    /**
     * Gets a file path for a URL
     * @param {*} url 
     */
    getPathForUrl(url) {        
        const cleanUrl = url.replace(/https:\/\/www.cancer.gov\//,"").replace(/[:\/]/g,"_");
        if (cleanUrl === '') {
            return path.join(this.cacheFolderPath, "__homepage__.html");
        }
        return path.join(this.cacheFolderPath, cleanUrl + ".html");
    }

    /**
     * Checks the HTML cache for a url before fetching
     * @param {string} url The URL to fetch
     * @returns {string|undefined} The HTML contents if the page was in the cache and 
     * no more than 24 hours old.
     */
    async getFromCache(url) {

        //TODO: Make it so www.cancer.gov is not assumed to be the site.
        const filePath = this.getPathForUrl(url);

        let stat;

        try {
            stat = await this.instStat(filePath);
        } catch (err) {
            
            //File does not exist
            if (err.code == 'ENOENT') {
                //this.logger.debug(`${url} not found in cache`);
                return undefined;
            } else {
                //Something went wrong, so bail
                this.logger.error(`Could not get cache entry for ${url}`)
                throw err;
            }
        }

        if ((Date.now() - stat.mtime) < TWENTY_FOUR_HOURS) {
            //this.logger.debug(`Reading ${url} from cache`);
            //Read file            
            return await this.instReadFile(filePath, 'utf8');
        } else {
            //Too old, need to refetch
            //this.logger.debug(`${url} expired in cache`);
            return undefined;
        }
    }

    /**
     * Fetches a single URL from the server
     * @param {*} url 
     */
    async fetchUrl(url) {
        let res;
        try {
            this.logger.debug(`PageFetcher:\t\tFetching ${url}`);
            res = await this.instNetReq(url);
            this.logger.debug(`PageFetcher:\t\tCompleted Fetching ${url}`);
        } catch (err) {

            if (err.response && err.response.status) {
                //throw new Error(`Bad status, ${res.status} , while fetching url ${url}`)
                this.logger.error(`Bad status, ${err.response.status} , while fetching url ${url}`)
                return undefined;
            }

            if (err.errno && err.code === 'ECONNRESET') {
                this.logger.debug(`PageFetcher:\t\tRetrying fetch of ${url}`);
                await timeout(10000); //Wait 10 seconds before trying again
                return await this.fetchUrl(url);
            }
    
            this.logger.error(`Could not fetch url, ${url}.`)
            throw err;
        }

        if (res.status !== 200) {
            //throw new Error(`Bad status, ${res.status} , while fetching url ${url}`)
            this.logger.error(`Bad status, ${res.status} , while fetching url ${url}`)
            return;
        }

        //If it is not HTML, then we need to move on.
        if (res.headers['content-type'] !== 'text/html; charset=utf-8') {
            return "||FILEDATA||"; //A marker to identify this was a file.
        }

        return res.data;
    }

    /**
     * Saves the contents of a page to the file system
     * @param {*} url 
     * @param {*} pageContent 
     */
    async saveToCache(url, pageContent) {
        const filePath = this.getPathForUrl(url);

        try {
            await this.instWriteFile(filePath, pageContent);
        } catch(err) {
            this.logger.error(`Could not save ${url} to ${filePath}`)
            throw err;
        }

    }

    /**
     * Transforms the resource 
     * @param {Object} data the object to be transformed
     * @returns the transformed object
     */
    async transform(url) {        
        this.printStats(`Start ${url}`);
        let xformed;
        try {
            xformed = await this.transformCaching(url);            
            this.printStats(`Done ${url}`);            
        } catch (err) {
            this.printStats(`Error ${url}`);
            throw err;
        }        
        
        return xformed;
    }

    /**
     * Caching version of transform
     * @param {Object} data the object to be transformed
     * @returns the transformed object
     */
    async transformCaching(url) {

        let pageContent = await this.getFromCache(url);

        if (!pageContent) {
            pageContent = await this.fetchUrl(url);

            if (pageContent) {
                await this.saveToCache(url, pageContent);
            }
        }

        if (!pageContent) {
            return undefined;
        }

        //This was not a real HTML Page, so skip
        if (pageContent === '||FILEDATA||') {
            return undefined;
        }


        return {
            url: url,
            content: pageContent
        };
    }

    /**
     * Non-caching version of transform
     * @param {*} url 
     */
    async transformNonCaching(url) {
        const pageContent = await this.fetchUrl(url);

        //This was not a real HTML Page, so skip
        if (pageContent === '||FILEDATA||') {
            return undefined;
        }

        return {
            url: url,
            content: pageContent
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
        const agent = new HttpsAgent({
            maxSockets: 40
        });

        //Get instance of axios with our custom https agent
        const axiosInstance = axios.create({
            httpsAgent: agent
        })

        return new PageFetcher(logger, axiosInstance, config);
    }    
}

module.exports = PageFetcher;