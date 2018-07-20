const { PipelineProcessor } = require('loader-pipeline');
const path                  = require('path');
const winston               = require('winston');
const config                = require('config');

async function main() {

    // This should be based on a config really...
    const logger = winston.createLogger({
        level: config.has("logging.level") ? config.get("logging.level") : 'info',
        format: winston.format.simple(),
        transports: [
            new winston.transports.Console()
        ]
    })

    logger.info(`Beginning process with PID: ${process.pid}`)
    let processor;

    try {
        const rawConfig = config.get("pipeline");
        const cleanConfig = {
            ...rawConfig,
            searchPaths: [ __dirname ]
        }
        processor = new PipelineProcessor(logger, cleanConfig);
    } catch(err) {        
        logger.error("Terminal Errors occurred.")
        console.error(err);
        logger.error("Exiting...")
        process.exit(1);
    }
    
    try {    
        await processor.run();
        logger.info("Successfully completed processing.")
        process.exit(0);
    } catch(err) {
        logger.error("Terminal Errors occurred.")
        console.error(err);
        logger.error("Exiting...")
        process.exit(2);        
    }
}

main();