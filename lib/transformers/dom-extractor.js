const { AbstractRecordTransformer } = require('loader-pipeline');
const { JSDOM }                     = require('jsdom');

class DomExtractor extends AbstractRecordTransformer {

    constructor(logger, config) {
        super(logger);

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
    async transform(data) {

        //If it is not to be xformed, it will be undefined.
        if (!data) {
            return data;
        }

        const dom = new JSDOM(data.content);
        const document = dom.window.document;

        //Lets get the metadata
        const metadata = Array.from(document.getElementsByTagName("meta"))
                              .map(el => {
                                if (el.attributes["property"]) {
                                    return {
                                        name: el.attributes["property"].value,
                                        content: el.content,
                                        type: 'property'
                                    }
                                } else if (el.httpEquiv) {
                                    return {
                                        name: el.httpEquiv,
                                        content: el.content,
                                        type: 'http'
                                    }
                                } else if (el.name) {
                                    return {
                                        name: el.name,
                                        content: el.content,
                                        type: 'name'
                                    }
                                } else {
                                    return undefined;
                                }            
                            }).filter(meta => meta)        

        const ids = Array.from(document.querySelectorAll('*[id]:not([id=""])'))
                         .map(el => el.id);
        
        const classes = Array.from(document.querySelectorAll('*[class]:not([class=""])'))
                             .map(el => Array.from(el.classList))
                             .reduce( (ac, c) => {               
                                 return [
                                    ...ac,
                                    ...c.filter(cls => !ac.includes(cls))
                             ]}, []);
        
        const scripts = Array.from(document.querySelectorAll('script[src]:not([src=""])'))
                             .map(el => el.src);

        const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]:not([href=""])'))
                                 .map(el => el.href);

        //Get CDE info
        const datatags = document.body.dataset;

        const docInfo = {
            url: data.url,
            title: document.title,            
            contentid: datatags["cdeContentid"],
            type: datatags["cdeContenttype"],
            template: datatags["cdePagetemplate"],
            ids,
            metadata,
            classes,
            scripts,
            stylesheets
        };

        return docInfo;
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
        return new DomExtractor(logger, config);
    }    
}

module.exports = DomExtractor;