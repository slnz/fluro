

import FluroAPI from './fluro.api';
import FluroAuth from './fluro.auth';
import FluroAsset from './fluro.asset';
import FluroUtils from './fluro.utils';

///////////////////////////////////////

var Fluro = function(options) {



	if(!options) {
		options = {
			// apiURL,
			// applicationToken,
			// api:{}
		};
	}

	///////////////////////////////////////

	if(!options.apiURL || !options.apiURL.length) {
		options.apiURL = 'production';
	}

	///////////////////////////////////////

	switch(options.apiURL) {
		case 'production':
			options.apiURL = 'https://api.fluro.io';
		break;
		case 'staging':
			options.apiURL = 'https://api.staging.fluro.io';
		break;
		case 'local':
			options.apiURL = 'http://api.fluro.localhost:3000';
		break;
	}


	///////////////////////////////////////

	var core = {
		apiURL:options.apiURL,
	}

	///////////////////////////////////////

	Object.defineProperty(core, 'api', {
		value:new FluroAPI(core),
		writable:false,
	});

	Object.defineProperty(core, 'auth', {
		value:new FluroAuth(core),
		writable:false,
	});

	Object.defineProperty(core, 'asset', {
		value:new FluroAsset(core),
		writable:false,
	});

	Object.defineProperty(core, 'utils', {
		value:new FluroUtils(core),
		writable:false,
	});

	

	///////////////////////////////////////

	return core;


	
/**
	///////////////////////////////////////

	//Create a new instance of the fluro API
	var _api = new FluroAPI(options.apiURL, options.api);
	var _auth = new FluroAuth(_api, options.applicationToken);
	var _asset = new FluroAsset(_api, _auth);

	///////////////////////////////////////

	var service = {
		get api() {
			return _api;
		},
		get auth() {
			return _auth;
		},
		get asset() {
			return _asset;
		}
	}

	///////////////////////////////////////

	return service;
	/**/
}

///////////////////////////////////////
///////////////////////////////////////
///////////////////////////////////////

export default Fluro;



