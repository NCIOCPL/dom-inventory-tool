# dom-inventory-tool
Node program to scrape a web site and inventory all IDs, Classes and script blocks.


## To run
1. run `npm install`
2. Create a local.json file and update any config settings.
2. run `node index.js`

## Data
* url - the page URL
* title - the <title> element
* contentid - the percussion content id. Pulled from body[data-cde-contentid]
* type - the percussion content type. pulled from body[data-cde-contenttype]
* template - the CDE template (without .aspx). Technically I think this is actually the name of the Page Template Collection content item that contains the .aspx as a Page Template Info. Pulled from body[data-cde-pagetemplate]
* ids - unique list of all of the *values* of the id attributes on the page
* classes - unique list of all of the *values* of the class attributes on the page
* data_attribs - unique list of all of the *names* of the data attributes on the page
* metadata - all <meta> tags with a property, name or http-equiv attribute.
* stylesheets - a list of all of the href values for <link> tags with a rel="stylesheet" attribute.
* scripts - a list of all of the src values for <script> tags
* script_blocks - The contents of any <script> elements without a src attribute.
* script_strings - Any string tokens as processes by esprima tokenize method. (e.g. `$("this is a string")`, `var foo = "this is too"`)
* script_strings - Any identifier tokens as processed by esprima tokenize method. 


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
