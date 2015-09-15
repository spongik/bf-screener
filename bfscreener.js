var fs = require('fs'),
	webpage = require('webpage'),
	system = require('system');

var Utils = {

	getInputVar: function(varName, defaultValue, isArray) {
		isArray = isArray == undefined ? false : isArray;
		
		var argsMap = system.args.slice(1).map(function(arg) {
			return arg.explode('=');
		});
			
		if (isArray) {
			var found = argsMap.filter(function(arg) {
				return arg[0] == '--' + varName;
			}).map(function(arg) {
				return arg[1];
			});
			return found.length ? found : defaultValue;
		} else {
			var found = argsMap.filter(function(arg) {
				return arg[0] == '--' + varName;
			});
			return found.length ? found[0][1] : defaultValue;
		}
	},

	selectors: {
		rooms: '.room__list'
	},

	waitForElement: function(page, selector, successCb, timeoutCb) {
		var timeout;
		var wait = setInterval(function() {
			var exists = page.evaluate(function(selector) {
				return document.querySelector(selector) != null;
			}, selector);

			if (exists) {
				clearTimeout(timeout);
				clearInterval(wait);
				successCb();
			}
		}, 100);

		timeout = setTimeout(function() {
			clearInterval(wait);
			timeoutCb('waitForElement("' + selector + '") timeout');
		}, 4000);
	}
}; 

var Config = function() {

	var defaults = {
		env: 'qa',
		provider: '42',
		theme: '42',
		size: 'lg'
	};

	var globalParams = {
		env: Utils.getInputVar('env', defaults.env),
		provider: Utils.getInputVar('provider', defaults.provider),
		theme: Utils.getInputVar('theme', defaults.theme),
		size: Utils.getInputVar('size', defaults.size)
	};

	var viewport = {
		xs: {
		  width: 300,
		  height: 1080
		},
		sm: {
		  width: 1920,
		  height: 1080
		},
		md: {
		  width: 1920,
		  height: 1080
		},
		lg: {
		  width: 1920,
		  height: 1080
		}
	};

	var getUrl = function(params) {
		var baseUrl;
		switch(params.env) {
			case 'qa': baseUrl = 'https://qatl.ru/booking2/hotel'; break;
			case 'qa2': baseUrl = 'https://qatl2.ru/booking2/hotel'; break;
			case 'prod': baseUrl = 'https://travelline.ru/booking2/hotel'; break;
		}
		return baseUrl + '/' + params.provider + '/' + params.theme + '/?' + params.provider
	};

	var mergeParams = function(params1, params2) {
		var result = {};
		for (var name in params1) {
			result[name] = params2.hasOwnProperty(name) ? params2[name] : params1[name];
		}
		return result;
	};

	this.combine = function(scenarioParams) {
		var params = mergeParams(globalParams, scenarioParams);
		params['url'] = getUrl(params);
		params['viewport'] = viewport[params.size];

		return params;
	}
};

var ScenarioRunner = function(config) {
	
	var context = this;
	var scenarios = [];

	var runNextScenario = function() {
		var scenario = scenarios.shift();
		console.log('Running ' + scenario.name);
		scenario.run();
	};

	var done = function() {
		if (scenarios.length == 0) {
			phantom.exit();
		}
		runNextScenario();
	};

	var failed = function(error) {
		console.log('Error: ' + error);
		done();
	};

	this.run = function() {
		runNextScenario();
	};

	this.register = function(name, scenarioParams, scenarioCb) {
		scenarios.push({
			name: name,
			run: function() {
				var params = config.combine(scenarioParams);
				var page = webpage.create();
				
				page.viewportSize = params.viewport;
				page.open(params.url, function (status) {
					if (status !== 'success') {
						failed('cant open ' + params.url + ' (' + status + ')');
					} else {
						scenarioCb(page, done, failed);
					}
				});
			}
		});
	};
};

var config = new Config();
var runner = new ScenarioRunner(config);

// SCENARIOS

runner.register('Test', {}, function(page, successCb, failedCb) {
	Utils.waitForElement(page, Utils.selectors.rooms, function() {
		page.render('test.png');
		successCb();
	}, failedCb);
});

runner.register('Test', { size: 'xs' }, function(page, successCb, failedCb) {
	setTimeout(function() {
		page.render('test2.png');
		successCb();
	}, 2000);
});

// END SCENARIOS

runner.run();