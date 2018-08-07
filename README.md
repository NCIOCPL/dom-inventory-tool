# dom-inventory-tool
Node program to scrape a web site and inventory all IDs, Classes and script blocks.


## To run
1. run `npm install`
2. Create a local.json file and update any config settings.
2. run `node index.js`

## To query
```
//All of these are a POST to 
//http://ESHOST:9200/dominventory_v1/_search

//Finding a specific identifier on a page:
//NOTE: Identifiers are tokenized, so if you want s.prop10,
//search for prop10, and not s.prop10
{
  "query": 
	{ "match": { "script_identifiers._fulltext": "prop10" } }
}

//Search for text in string
{
  "query": 
	{ "match": { "script_strings._fulltext": "dropdowncc" } }
  
}

//Get all identifiers
{
  "aggs": {
	"identifiers": {
		"terms": { "field" : "script_identifiers", "size": 50000 }
		
	}
  }
}

//Get all templates that reference the pdq-hp-patient-toggle class
{
  "query": {
	"term": { "classes": "pdq-hp-patient-toggle" }
  },
  "aggs": {
	"identifiers": {
		"terms": { "field" : "template", "size": 50000 }
		
	}
  }
}

//Same as above without hits
{
  "size": 0,
  "query": {
	"term": { "classes": "pdq-hp-patient-toggle" }
  },
  "aggs": {
	"identifiers": {
		"terms": { "field" : "template", "size": 50000 }
		
	}
  }
}
```
