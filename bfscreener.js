var fs = require('fs'),
	webpage = require('webpage'),
    system = require('system');

var getInputVar = function(varName, defaultValue, isArray) {
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
};

var defaults = {
	env: 'qa',
	provider: '42',
	theme: '42',
	size: 'lg'
};

var globalParams = {
	env: getInputVar('env', defaults.env),
	provider: getInputVar('provider', defaults.provider),
	theme: getInputVar('theme', defaults.theme),
	size: getInputVar('size', defaults.size)
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
}

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
}

var scenarios = [];

var doneScenario = function() {
	if (scenarios.length == 0) {
		phantom.exit();
	}
	runScenarios();
};

var registerScenario = function(name, description, scenarioParams, scenarioCb) {
	scenarios.push(function() {
		var params = mergeParams(globalParams, scenarioParams);
		var url = getUrl(params);
		var page = webpage.create();
		
		page.viewportSize = viewport[params.size];
		page.open(url, function (status) {
			if (status !== 'success') {
			} else {
				scenarioCb(page, doneScenario);
			}
		});
	});
};

var runScenarios = function() {
	var scenario = scenarios.shift();
	scenario();
};

// SCENARIOS

registerScenario('Test', 'simple test', {}, function(page, doneCb) {
	console.log('test');
	page.render('test.png');
	console.log('test done');
	doneCb();
});

registerScenario('Test', 'simple test', { size: 'xs' }, function(page, doneCb) {
	console.log('test2');
	page.render('test2.png');
	console.log('test2 done');
	doneCb();
});

runScenarios();