var fs = require('fs'),
  webpage = require('webpage'),
  system = require('system');

if (system.args[1] == '/?') {
  console.log('Available params:');
  console.log('\t--out=screens\t\tOutput directory');
  console.log('\t--env=qa\t\tBooking form environment (qa, qa2, prod)');
  console.log('\t--tag\t\tOnly run scenarions with given tag. Multiple tags are allowed');
  console.log('\t--lng=ru\t\tBooking form language');
  console.log('\t--cur\t\tBooking form currency');
  console.log('\t--provider=2796\t\tBooking form provider');
  console.log('\t--theme=default\t\tBooking form theme');
  console.log('\t--size=lg\t\tScreen size (xs, sm, md, lg)');
  console.log('');
  console.log('Example: phantom bfscreener.js --out=imgs --env=prod --tag=xs --tag=transfers');
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

  renderPage: function(page, outDir, scenario) {
    for (var i = 0;; i++) {
      var path = outDir + '/' + scenario.index + '.' + i + '. ' 
        + scenario.name  +  ' (' + scenario.tags.join(', ') + ')' + '.png';

      if (!fs.exists(path)) {
        page.render(path);
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
    }, 10000);
  },

  clickElement: function(page, selector, successCb) {
    page.evaluate(function(selector) {
      document.querySelector(selector).click();
    }, selector);

    setTimeout(function() {
      successCb();
    }, 300);
  },

  formatDate: function(date) {
    return date.toISOString().slice(0, 10);
  }

}; 

var Config = function() {

  var defaults = {
    env: 'qa',
    language: 'ru',
    currency: '',
    provider: '2796',
    theme: 'default',
    size: 'lg'
  };

  var globalParams = {
    env: Utils.getInputVar('env', defaults.env),
    language: Utils.getInputVar('lng', defaults.language),
    currency: Utils.getInputVar('cur', defaults.currency),
    provider: Utils.getInputVar('provider', defaults.provider),
    theme: Utils.getInputVar('theme', defaults.theme),
    size: Utils.getInputVar('size', defaults.size)
  };

  var viewport = {
    xs: {
      width: 320,
      height: 480
    },
    sm: {
      width: 500,
      height: 1080
    },
    md: {
      width: 760,
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

    var query = [];
    var queryParams = ['language', 'currency', 'accommodationMode', 'date', 'nights'];
    queryParams.forEach(function(param) {
      if (params.hasOwnProperty(param)) {
        query.push(param + '=' + params[param]);
      }
    });

    return baseUrl + '/' + params.provider + '/' + params.theme + '/?' + params.provider 
      + '&' + query.join('&');
  };

  var mergeParams = function() {
    var result = {};
    for (var i=0; i<arguments.length; i++) {
      var params = arguments[i];
      for (var name in params) {
        result[name] = params[name];
      }
    }
    return result;
  };

  this.combine = function(scenarioParams) {
    var params = mergeParams(globalParams, scenarioParams);
    
    params['url'] = getUrl(params);
    
    if (!params.hasOwnProperty('viewport')) {
      params['viewport'] = viewport[params.size];
    }

    return params;
  }
};

var ScenarioRunner = function(config, allowedTags) {
  
  var context = this;
  var scenarios = [];
  var total = 0;

  var runNextScenario = function() {
    if (scenarios.length > 0) {
      var scenario = scenarios.shift();
      console.log('[' + scenario.index + '/' + total + '] ' + scenario.name 
        + ' (' + scenario.tags.join(', ') + ')');
      scenario.run();
    } else {
      console.log('DONE');
      phantom.exit();
    }
  };

  var done = function() {
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
    if (allowedTags.length && !tags.some(function(tag) {
        return allowedTags.indexOf(tag) >= 0;
      })) {
      return;
    }

    total++;
    var scenario = {
      name: name,
      index: total,
      tags: tags,
      run: function() {
        var params = config.combine(scenarioParams);
        var page = webpage.create();

        console.log(params.url);

        page.viewportSize = params.viewport;
        page.open(params.url, function (status) {
          if (status !== 'success') {
            failed('cant open ' + params.url + ' (' + status + ')');
          } else {
            scenarioCb(page, scenario, done, failed);
          }
        });
      }
    };
    scenarios.push(scenario);
  };
};

var ScenarioCallChain = function() {
  var context = this;
  var chain = [];

  var init = function(page, scenario, successCb, failedCb) {
    context.page = page;
    context.scenario = scenario;
    context.successCb = successCb;
    context.failedCb = failedCb;
    resolveChain();
  }

  var resolveChain = function() {
    var func = chain.shift();
    func && func();
  };

  this.done = function() {
    chain.push(function() {
      context.successCb();
    });
    return init;
  };

  this.wait = function(selector) {
    chain.push(function() {
      Utils.waitForElement(context.page, selector, function() {
        resolveChain();
      }, context.failedCb);
    });
    return context;
  };

  this.click = function(selector) {
    chain.push(function() {
      Utils.waitForElement(context.page, selector, function() {
        Utils.clickElement(context.page, selector, function() {
          resolveChain();
        });
      }, context.failedCb);
    });
    return context;
  };

  this.render = function(outDir) {
    chain.push(function() {
      Utils.renderPage(context.page, outDir, context.scenario);
      resolveChain();
    });
    return context;
  };
};

var Selectors = {
  searchFilterPage: '.p-search-filter__form',
  searchCalendar: '.x-datepicker__input',
  searchButton: '.p-search-filter__button',
  
  roomsListPage: '.room__list',
  roomRateExpand: '.rate-plan__title .x-title',
  roomRatesExpand: '.rate-plan__expand',
  roomDescriptionExpand: '.room__name .x-title',
  roomInfoButton: '.room__list .x-room-group',
  roomBookButton: '.x-rate-plan-list .rate-plan__book-btn',
  roomQuantitySelect: '.x-rate-plan-list .ui-select-container .selectize-input',
  roomQuantitySelectOption: '.x-rate-plan-list .ui-select-container .ui-select-choices-row:nth-child(2)',

  roomInfoPage: '.room-info',
  roomInfoRateDetails: '.rate-plan__open-details',

  previewPage: '.p-preview',
  previewTransferExpand: '.x-transfer .x-title',

  paymentPage: '.x-payment-list',
  paymentOrderExpand: '.x-order__summary',
  paymentCancellationExpand: '.x-order__cancellation-btn',
  
  cartProccedBooking: '.x-cart__summary-btn',
  
  modalClose: '.x-modal__close-btn'
};

// STARTUP

var allowedTags = Utils.getInputVar('tag', [], true);
var outDir = Utils.getInputVar('out', 'screens');

var config = new Config();
var runner = new ScenarioRunner(config, allowedTags);

Utils.cleanDir(outDir);

// SCENARIOS

// common vars

var today = new Date();
var monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 5) % 7) + 14);
var tuesday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 4) % 7) + 14);
var wednesday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 3) % 7) + 14);
var nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

// register scenarios

runner.register('Common screen width (1980px) with manual accommodation', ['lg', 'manual', 'search', 'rooms', 'preview'], {
  accommodationMode: 'manual',
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .wait(Selectors.searchFilterPage)
    .render(outDir)
    .click(Selectors.searchButton)
    .wait(Selectors.roomsListPage)
    .render(outDir)
    .click(Selectors.roomRateExpand)
    .click(Selectors.roomRatesExpand)
    .click(Selectors.roomDescriptionExpand)
    .render(outDir)
    .click(Selectors.roomRateExpand)
    .click(Selectors.roomRatesExpand)
    .click(Selectors.roomDescriptionExpand)
    .click(Selectors.roomQuantitySelect)
    .click(Selectors.roomQuantitySelectOption)
    .render(outDir)
    .click(Selectors.cartProccedBooking)
    .wait(Selectors.previewPage)
    .click(Selectors.previewTransferExpand)
    .render(outDir)
    .click(Selectors.cartProccedBooking)
    .click(Selectors.paymentOrderExpand)
    .click(Selectors.paymentCancellationExpand)
    .wait(Selectors.paymentPage)
    .render(outDir)
    .done()
);

runner.register('Minimum screen width (200px) with auto accommodation', ['xs', 'auto', 'search', 'rooms', 'preview'], {
  viewport: {
    width: 200,
    height: 800
  },
  accommodationMode: 'auto',
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .wait(Selectors.searchFilterPage)
    .render(outDir)
    .click(Selectors.searchButton)
    .wait(Selectors.roomsListPage)
    .render(outDir)
    .click(Selectors.roomInfoButton)
    .wait(Selectors.roomInfoPage)
    .render(outDir)
    .click(Selectors.roomInfoRateDetails)
    .render(outDir)
    .click(Selectors.modalClose)
    .click(Selectors.roomBookButton)
    .wait(Selectors.previewPage)
    .click(Selectors.previewTransferExpand)
    .render(outDir)
    .click(Selectors.cartProccedBooking)
    .click(Selectors.paymentOrderExpand)
    .click(Selectors.paymentCancellationExpand)
    .wait(Selectors.paymentPage)
    .render(outDir)
    .done()
);

runner.register('Azimut', ['lg', 'manual', 'search', 'rooms', 'payment', 'azimut'], {
  provider: '86207',
  theme: 'azimut',
  date: Utils.formatDate(nextMonth),
  accommodationMode: 'auto'
}, new ScenarioCallChain()
    .wait(Selectors.searchFilterPage)
    .render(outDir)
    .click(Selectors.searchButton)
    .wait(Selectors.roomsListPage)
    .render(outDir)
    .click(Selectors.roomBookButton)
    .click(Selectors.paymentOrderExpand)
    .click(Selectors.paymentCancellationExpand)
    .wait(Selectors.paymentPage)
    .render(outDir)
    .done()
);

runner.register('Calendar with common screen width (1980px)', ['lg', 'calendar'], {
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .click(Selectors.searchCalendar)
    .render(outDir)
    .done()
);

runner.register('Calendar with phone screen width (320px)', ['xs', 'calendar'], {
  size: 'xs',
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .click(Selectors.searchCalendar)
    .render(outDir)
    .done()
);

// END SCENARIOS

runner.run();