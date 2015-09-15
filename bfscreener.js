var fs = require('fs'),
  webpage = require('webpage'),
  system = require('system');

if (system.args[1] == '/?') {
  console.log('Available params:');
  console.log('\t--out=screens\t\tOutput directory');
  console.log('\t--env=qa\t\tBooking form environment (qa, qa2, prod)');
  console.log('\t--provider=42\t\tBooking form provider');
  console.log('\t--theme=default\t\tBooking form theme');
  console.log('\t--theme=size\t\tScreen size (xs, sm, md, lg)');
  console.log('');
  console.log('Example: phantom bfscreener.js --out=imgs --env=prod');
  console.log('');
  phantom.exit();
}

var Utils = {

  getInputVar: function(varName, defaultValue, isArray) {
    isArray = isArray == undefined ? false : isArray;
    
    var argsMap = system.args.slice(1).map(function(arg) {
      return arg.split('=');
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

  cleanDir: function(dir) {
    if (fs.isDirectory(dir)) {
      for (var i = 1;; i++) {
        var path = dir + ' [' + i + ']';
        if (!fs.isDirectory(path)) {
          fs.copyTree(dir, path);
          fs.removeTree(dir);
          return;
        }
      }
    }
  },

  _renderPageIndex: 1,

  renderPage: function(page, outDir, name) {
    for (var i = 0;; i++) {
      var path = outDir + '/' + this._renderPageIndex + '. ' 
        + name + (i > 0 ? ' [' + i + ']' : '') + '.png';

      if (!fs.exists(path)) {
        page.render(path);
        this._renderPageIndex++;
        return;
      }
    }
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
        setTimeout(function() {
          successCb();
        }, 200);
      }
    }, 100);

    timeout = setTimeout(function() {
      clearInterval(wait);
      timeoutCb('waitForElement("' + selector + '") timeout');
    }, 5000);
  }
}; 

var Config = function() {

  var defaults = {
    env: 'qa',
    provider: '42',
    theme: 'default',
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
  var total = 0;

  var runNextScenario = function() {
    var scenario = scenarios.shift();
    var remains = total - scenarios.length;
    console.log('[' + remains + '/' + total + '] ' + scenario.name + ' (' + scenario.tags.join(', ') + ')');
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

  this.register = function(name, tags, scenarioParams, scenarioCb) {
    total++;
    scenarios.push({
      name: name,
      tags: tags,
      run: function() {
        var params = config.combine(scenarioParams);
        var page = webpage.create();
        
        page.viewportSize = params.viewport;
        page.open(params.url, function (status) {
          if (status !== 'success') {
            failed('cant open ' + params.url + ' (' + status + ')');
          } else {
            scenarioCb(page, name, done, failed);
          }
        });
      }
    });
  };
};

var Selectors = {
  searchFilter: '.p-search-filter__form',
  rooms: '.room__list'
};

var config = new Config();
var runner = new ScenarioRunner(config);

var outDir = Utils.getInputVar('out', 'screens');
Utils.cleanDir(outDir);

// SCENARIOS

runner.register('Large screen size', ['lg'], {
    size: 'lg'
  }, function(page, name, successCb, failedCb) {
  Utils.waitForElement(page, Selectors.searchFilter, function() {
    Utils.renderPage(page, outDir, name);
    successCb();
  }, failedCb);
});

runner.register('Phone screen size', ['xs'], {
    size: 'xs'
  }, function(page, name, successCb, failedCb) {
  Utils.waitForElement(page, Selectors.searchFilter, function() {
    Utils.renderPage(page, outDir, name);
    successCb();
  }, failedCb);
});

// END SCENARIOS

runner.run();