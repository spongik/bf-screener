var fs = require('fs'),
  webpage = require('webpage'),
  system = require('system');

if (system.args[1] == '/?') {
  console.log('Available params:');
  console.log('\t--out=screens\t\tOutput directory');
  console.log('\t--env=qa\t\tBooking form environment (qa, qa2, prod)');
  console.log('\t--tag\t\tOnly run scenarions with given tag. Multiple tags are allowed');
  console.log('\t--lng=ru\t\tBooking form language (ru, en, fr, uk, kk, cs, zh)');
  console.log('\t--cur\t\tBooking form currency (RUB, USD, EUR, AMD, AZN, BYR, CNY, GBP, KGS, KZT, TJS, UAH, CHF, TND, GEL)');
  console.log('\t--provider=2796\t\tBooking form provider');
  console.log('\t--theme=default\t\tBooking form theme');
  console.log('\t--size=lg\t\tScreen size (xs, sm, md, lg)');
  console.log('\t--promo\t\tApply promo code');
  console.log('');
  console.log('Example: phantom bfscreener.js --out=imgs --env=prod --tag=xs --tag=transfers');
  console.log('');
  phantom.exit();
}

console.log('Help: phantomjs bfscreener.js /?');

var BF_QUERY_PARAMS = ['language', 'currency', 'accommodationMode', 'date', 'nights', 'adults', 'children', 'promoCodePlain', 'roomTypes', 'ratePlans', 'state'];

var Utils = {

  getInputVar: function(varName, defaultValue, isArray) {
    isArray = isArray == undefined ? false : isArray;
    
    var argsMap = system.args.slice(1).map(function(arg) {
      return arg.split('=');
    });
      
    if (isArray) {
      var found = argsMap.filter(function(arg) {
        return arg[0] == '--' + varName && arg[1] != '';
      }).map(function(arg) {
        return arg[1];
      });
      return found.length ? found : defaultValue;
    } else {
      var found = argsMap.filter(function(arg) {
        return arg[0] == '--' + varName;
      });
      return found.length && found[0][1] != '' ? found[0][1] : defaultValue;
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
    for (var i = 1;; i++) {
      var path = outDir + '/' + scenario.index + '.' + i + '. ' 
        + scenario.name  +  ' (' + scenario.tags.join(', ') + ')' + '.png';

      if (!fs.exists(path)) {
        page.render(path);
        return;
      }
    }
  },

  renderElement: function(page, outDir, scenario, selector) {
    var originalViewport = page.clipRect;
    var viewport = page.evaluate(function(selector) {
      return $(selector).get(0).getBoundingClientRect();
    }, selector);

    if (viewport) {
      var padding = 50;
      page.clipRect = {
        top: Math.max(0, viewport.top - padding),
        left: Math.max(0, viewport.left - padding),
        width: viewport.width + padding * 2,
        height: viewport.height + padding * 2
      };
    }

    Utils.renderPage(page, outDir, scenario);
    page.clipRect = originalViewport;
  },

  waitForElement: function(page, selector, successCb, timeoutCb) {
    var timeout;
    var wait = setInterval(function() {
      var exists = page.evaluate(function(selector) {
        return $(selector).get(0) != null;
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
    }, 20000);
  },

  clickElement: function(page, selector, successCb) {
    page.evaluate(function(selector) {
      $(selector).get(0).click();
    }, selector);

    setTimeout(function() {
      successCb();
    }, 300);
  },

  setElementValue: function(page, selector, value, successCb) {
    page.evaluate(function(selector, value) {
      $(selector).val(value).change();
    }, selector, value);

    setTimeout(function() {
      successCb();
    }, 100);
  },

  formatDate: function(date) {
    return date.toISOString().slice(0, 10);
  }

}; 

var Config = function() {

  this.defaults = {
    env: 'qa',
    language: 'ru',
    provider: '2796',
    theme: 'default',
    size: 'lg',
    roomTypes: '26030',
    ratePlans: '17024',
    promoCodePlain: '123',
    cancellationNumber: '20160916-2796-679386',
    cancellationCode: 'SSR5R',
  };

  var globalParams = {
    env: Utils.getInputVar('env', this.defaults.env),
    language: Utils.getInputVar('lng', this.defaults.language),
    currency: Utils.getInputVar('cur', null),
    provider: Utils.getInputVar('provider', this.defaults.provider),
    theme: Utils.getInputVar('theme', this.defaults.theme),
    size: Utils.getInputVar('size', this.defaults.size),
    promoCodePlain: Utils.getInputVar('promo', null)
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
      case 'dev': baseUrl = 'http://localhost:8800'; break;
      case 'qa': baseUrl = 'https://qatl.ru/booking2/hotel/' + params.provider + '/' + params.theme; break;
      case 'qa2': baseUrl = 'https://qatl2.ru/booking2/hotel/' + params.provider + '/' + params.theme; break;
      case 'prod': baseUrl = 'https://travelline.ru/booking2/hotel/' + params.provider + '/' + params.theme; break;
    }

    var query = [];
    BF_QUERY_PARAMS.forEach(function(param) {
      if (params.hasOwnProperty(param) && params[param] != null) {
        query.push(param + '=' + params[param]);
      }
    });

    return baseUrl + '/?' + params.provider + '&' + query.join('&');
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
  var errors = 0;

  this.tags = [];

  var runNextScenario = function() {
    if (scenarios.length > 0) {
      var scenario = scenarios.shift();
      console.log('[' + scenario.index + '/' + total + ']\t' + scenario.name 
        + ' (' + scenario.tags.join(', ') + ')');
      scenario.run();
    } else {
      console.log('DONE WITH ' + errors + ' ERRORS');
      phantom.exit();
    }
  };

  var done = function() {
    runNextScenario();
  };

  var failed = function(error) {
    console.log('Error: ' + error);
    errors++;
    done();
  };

  this.run = function() {
    runNextScenario();
  };

  this.register = function(name, tags, scenarioParams, scenarioCb) {

    tags.forEach(function(tag) {
      if (context.tags.indexOf(tag) < 0) {
        context.tags.push(tag);
      }
    });

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

        console.log('\t' + params.url);
        console.log('');

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

  this.sleep = function(delay) {
    chain.push(function() {
      setTimeout(function() {
        resolveChain();
      }, delay);
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

  this.value = function(selector, value) {
    chain.push(function() {
      Utils.waitForElement(context.page, selector, function() {
        Utils.setElementValue(context.page, selector, value, function() {
          resolveChain();
        });
      }, context.failedCb);
    });
    return context;
  };

  this.render = function(outDir, selector) {
    if (selector) {
      chain.push(function() {
        Utils.waitForElement(context.page, selector, function() {
          Utils.renderElement(context.page, outDir, context.scenario, selector);
          resolveChain();
        }, context.failedCb);
      });
    } else {
      chain.push(function() {
        Utils.renderPage(context.page, outDir, context.scenario);
        resolveChain();
      });
    }
    return context;
  };
};

var Selectors = {
  searchFilterPage: '.p-search-filter__form',
  searchCalendarButton: '.x-datepicker__input',
  searchCalendar: '.x-datepicker__popover',
  searchButton: '.p-search-filter__button',
  
  roomsListPage: '.room__list',
  roomRateExpand: '.rate-plan__title.x-title',
  roomRatesExpand: '.rate-plan__expand',
  roomDescriptionExpand: '.room__name.x-title',
  roomPriceDetailsButton: '.rate-plan__popover-btn',
  roomPriceDetails: '.x-popover',
  roomInfoButton: '.room__list .x-room-group',
  roomBookButton: '.x-rate-plan-list .rate-plan__book-btn',
  roomQuantitySelect: '.rate-plan__quantity-select .x-select__match',
  roomQuantitySelectOption: '.rate-plan__quantity-select .x-select__choice:nth-child(2)',
  roomCancellationRuleButton: '.rate-plan__cancellation_rule._with_text',
  roomCancellationRule: '.x-rate-plan__popover',

  roomConstructor: '.rate-plan__price-details:has(.rate-plan__form)',
  roomConstructorSelect: '.rate-plan__price-details:has(.rate-plan__multiple-placeholder) .x-select__match',
  roomConstructorSelectOption1: '.rate-plan__price-details:has(.rate-plan__multiple-placeholder) .x-select__choice:nth-child(2)',
  roomConstructorSelectOption2: '.rate-plan__price-details:has(.rate-plan__multiple-placeholder) .x-select__choice:nth-child(3)',
  roomConstructorExtra: '.rate-plan__extra .x-title',

  roomUnavailable: '.room__list-item:has(.room__availability-calendar)',
  roomAvailabilityExpand: '.x-availability-calendar-expandable__button.x-title',
  roomAvailability: '.x-availability-calendar-price__item-price._state_valid',

  noRoomsPage: '.p-no-rooms-view__message',

  roomInfoPage: '.room-info',
  roomInfoRateDetails: '.rate-plan__info-open',

  previewPage: '.p-preview',
  previewTransfer: '.x-transfer__container',
  previewTransferExpand: '.x-transfer .x-title',
  previewOption: '.p-preview__item:last',
  previewOptionExpand: '.p-preview__item:last .x-title',

  paymentPage: '.x-payment-list',
  paymentBook: '.x-payment-list__book-btn',
  paymentOrder: '.x-order',
  paymentOrderExpand: '.x-order__summary',
  paymentCancellationExpand: '.x-order__cancellation-btn',
  paymentTerms: '.x-payment-list__agreement a, .payment__user-agreement a',
  paymentInstruction: '.x-payment-list__info-payment-instruction a',
  paymentOfficeButton: '.x-payment-list__info-description-icon-wrap',
  paymentOffice: '.x-popover',

  paymentCitizenship: '.x-guest-info__guest-citizenship .selectize-input',
  paymentFormPhone: '[name=contactPhoneNumber]',
  paymentFormEmail: '[name=email]',
  paymentFormLastName: '[name^=lastname]',
  paymentFormFirstName: '[name^=firstname]',

  completePage: '.complete__voucher-content',

  cartProccedBooking: '.x-cart__summary-btn',
  
  modalContent: '.x-modal .modal-content',
  modalClose: '.x-modal__close-btn',

  cancellationPage: '.p-auth',
  cancellationFormNumber: '[name=bookingNumber]',
  cancellationFormCode: '[name=confirmationCode]',
  cancellationDetailsButton: '.p-auth__submit',
  cancellationDetails: '.p-cancellation',
  cancellationAgreeButton: '.p-cancellation__agree',

  selectDropdownTl: '.x-select._opened .x-select__choices',
  selectDropdown: '.selectize-dropdown:not(.ng-hide)'
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
var monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 5) % 7) + 14); // 2796 qa with unavailable rooms
var tuesday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 4) % 7) + 14); // 2796 qa no rooms
var wednesday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 3) % 7) + 14); // 2796 qa all rooms
var nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
var nextMonthTuesday =  new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextMonth.getDate() - ((nextMonth.getDay() + 4) % 7) + 14);

// register scenarios

runner.register('Common screen width (1980px) with manual accommodation', ['lg', 'manual', 'search', 'rooms', 'preview', 'complete'], {
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
    .render(outDir)
    .click(Selectors.cartProccedBooking)
    .wait(Selectors.paymentPage)
    .render(outDir)
    .value(Selectors.paymentFormPhone, '1111111111')
    .value(Selectors.paymentFormEmail, 'test@test.test')
    .value(Selectors.paymentFormLastName, 'Lastname')
    .value(Selectors.paymentFormFirstName, 'Firstname')
    .sleep(3000)
    .click(Selectors.paymentBook)
    .wait(Selectors.completePage)
    .render(outDir)
    .done()
);

runner.register('Minimum screen width (200px) with auto accommodation', ['xs', 'auto', 'search', 'rooms', 'preview', 'complete'], {
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
    .render(outDir)
    .click(Selectors.cartProccedBooking)
    .wait(Selectors.paymentPage)
    .render(outDir)
    .value(Selectors.paymentFormPhone, '1111111111')
    .value(Selectors.paymentFormEmail, 'test@test.test')
    .value(Selectors.paymentFormLastName, 'Lastname')
    .value(Selectors.paymentFormFirstName, 'Firstname')
    .sleep(3000)
    .click(Selectors.paymentBook)
    .wait(Selectors.completePage)
    .render(outDir)
    .done()
);

runner.register('Azimut with common screen width (1980px)', ['lg', 'auto', 'search', 'rooms', 'payment', 'azimut'], {
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

runner.register('Azimut with phone screen width (320px)', ['xs', 'auto', 'search', 'rooms', 'payment', 'azimut'], {
  provider: '86207',
  theme: 'azimut',
  size: 'xs',
  date: Utils.formatDate(nextMonth),
  accommodationMode: 'auto'
}, new ScenarioCallChain()
    .wait(Selectors.searchFilterPage)
    .render(outDir)
    .click(Selectors.searchButton)
    .wait(Selectors.roomsListPage)
    .render(outDir)
    .click(Selectors.roomInfoButton)
    .wait(Selectors.roomInfoPage)
    .render(outDir)
    .click(Selectors.roomBookButton)
    .click(Selectors.paymentOrderExpand)
    .click(Selectors.paymentCancellationExpand)
    .wait(Selectors.paymentPage)
    .render(outDir)
    .done()
);

runner.register('Rooms page with small screen width (500px)', ['sm', 'manual', 'rooms'], {
  size: 'sm',
  nights: 2,
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .click(Selectors.roomRateExpand)
    .click(Selectors.roomRatesExpand)
    .click(Selectors.roomDescriptionExpand)
    .render(outDir)
    .done()
);

runner.register('Rooms page with medium screen width (760px)', ['md', 'manual', 'rooms'], {
  size: 'md',
  nights: 2,
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .click(Selectors.roomRateExpand)
    .click(Selectors.roomRatesExpand)
    .click(Selectors.roomDescriptionExpand)
    .render(outDir)
    .done()
);

runner.register('Rooms page with passed room', ['lg', 'auto', 'rooms'], {
  roomTypes: config.defaults.roomTypes,
  accommodationMode: 'auto',
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .wait(Selectors.searchFilterPage)
    .render(outDir)
    .click(Selectors.searchButton)
    .wait(Selectors.roomsListPage)
    .render(outDir)
    .done()
);

runner.register('Rooms page with passed rate', ['lg', 'auto', 'rooms'], {
  ratePlans: config.defaults.ratePlans,
  accommodationMode: 'auto',
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .wait(Selectors.searchFilterPage)
    .render(outDir)
    .click(Selectors.searchButton)
    .wait(Selectors.roomsListPage)
    .render(outDir)
    .done()
);

runner.register('Rooms page with passed room and rate', ['lg', 'auto', 'rooms'], {
  roomTypes: config.defaults.roomTypes,
  ratePlans: config.defaults.ratePlans,
  accommodationMode: 'auto',
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .wait(Selectors.searchFilterPage)
    .render(outDir)
    .click(Selectors.searchButton)
    .wait(Selectors.roomsListPage)
    .render(outDir)
    .done()
);

runner.register('Room availability calendar', ['availability'], {
  nights: 1,
  date: Utils.formatDate(monday)
}, new ScenarioCallChain()
    .click(Selectors.roomAvailabilityExpand)
    .wait(Selectors.roomAvailability)
    .render(outDir, Selectors.roomUnavailable)
    .done()
);

runner.register('Unavailable rooms with availability calendar (1980px)', ['lg', 'availability'], {
  nights: 1,
  date: Utils.formatDate(tuesday)
}, new ScenarioCallChain()
    .wait(Selectors.noRoomsPage)
    .render(outDir)
    .done()
);

runner.register('Unavailable rooms with availability calendar (320px)', ['xs', 'availability'], {
  nights: 1,
  size: 'xs',
  date: Utils.formatDate(tuesday)
}, new ScenarioCallChain()
    .wait(Selectors.roomAvailability)
    .render(outDir)
    .done()
);

runner.register('Unavailable rooms without availability calendar', ['availability'], {
  nights: 1,
  date: Utils.formatDate(nextMonthTuesday)
}, new ScenarioCallChain()
    .wait(Selectors.noRoomsPage)
    .render(outDir)
    .done()
);

runner.register('Rate plan price details popover', ['details'], {
  nights: 4,
  adults: 2,
  children: 2,
  date: Utils.formatDate(wednesday),
  accommodationMode: 'auto'
}, new ScenarioCallChain()
    .click(Selectors.roomPriceDetailsButton)
    .render(outDir, Selectors.roomPriceDetails)
    .done()
);

runner.register('Order with common screen width (1980px)', ['lg', 'order'], {
  accommodationMode: 'auto',
  nights: 3,
  adults: 2,
  children: 2,
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .click(Selectors.roomBookButton)
    .wait(Selectors.previewPage)
    .click(Selectors.cartProccedBooking)
    .click(Selectors.paymentOrderExpand)
    .click(Selectors.paymentCancellationExpand)
    .render(outDir, Selectors.paymentOrder)
    .done()
);

runner.register('Order with phone screen width (320px)', ['xs', 'order'], {
  accommodationMode: 'auto',
  size: 'xs',
  nights: 3,
  adults: 2,
  children: 2,
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .click(Selectors.roomInfoButton)
    .click(Selectors.roomBookButton)
    .wait(Selectors.previewPage)
    .click(Selectors.cartProccedBooking)
    .click(Selectors.paymentOrderExpand)
    .click(Selectors.paymentCancellationExpand)
    .render(outDir, Selectors.paymentOrder)
    .done()
);

runner.register('Promo rate plan', ['auto', 'rooms', 'promo'], {
  nights: 1,
  adults: 1,
  date: Utils.formatDate(wednesday),
  promoCodePlain: config.defaults.promoCodePlain,
  accommodationMode: 'auto'
}, new ScenarioCallChain()
    .wait(Selectors.roomsListPage)
    .render(outDir)
    .done()
);

runner.register('Transfers with common screen width (1980px)', ['lg', 'transfers'], {
  date: Utils.formatDate(wednesday),
  nights: 1,
  adults: 2,
  accommodationMode: 'auto'
}, new ScenarioCallChain()
    .click(Selectors.roomBookButton)
    .click(Selectors.previewTransferExpand)
    .render(outDir, Selectors.previewTransfer)
    .done()
);

runner.register('Transfers with phone screen width (320px)', ['xs', 'transfers'], {
  size: 'xs',
  date: Utils.formatDate(wednesday),
  nights: 1,
  adults: 2,
  accommodationMode: 'auto'
}, new ScenarioCallChain()
    .click(Selectors.roomInfoButton)
    .click(Selectors.roomBookButton)
    .click(Selectors.previewTransferExpand)
    .render(outDir, Selectors.previewTransfer)
    .done()
);

runner.register('Expandable option with common screen width (1980px)', ['lg', 'option'], {
  date: Utils.formatDate(wednesday),
  nights: 1,
  adults: 2,
  accommodationMode: 'auto'
}, new ScenarioCallChain()
    .click(Selectors.roomBookButton)
    .render(outDir, Selectors.previewOption)
    .click(Selectors.previewOptionExpand)
    .render(outDir, Selectors.previewOption)
    .done()
);

runner.register('Expandable option with phone screen width (320px)', ['xs', 'option'], {
  size: 'xs',
  date: Utils.formatDate(wednesday),
  nights: 1,
  adults: 2,
  accommodationMode: 'auto'
}, new ScenarioCallChain()
    .click(Selectors.roomInfoButton)
    .click(Selectors.roomBookButton)
    .render(outDir, Selectors.previewOption)
    .click(Selectors.previewOptionExpand)
    .render(outDir, Selectors.previewOption)
    .done()
);

runner.register('Stay constructor with common screen width (1980px)', ['lg', 'constructor'], {
  date: Utils.formatDate(wednesday),
  nights: 1,
  accommodationMode: 'manual'
}, new ScenarioCallChain()
    .click(Selectors.roomConstructorSelect)
    .click(Selectors.roomConstructorSelectOption1)
    .render(outDir, Selectors.roomConstructor)
    .click(Selectors.roomConstructorExtra)
    .click(Selectors.roomConstructorSelect)
    .click(Selectors.roomConstructorSelectOption2)
    .render(outDir, Selectors.roomConstructor)
    .done()
);

runner.register('Stay constructor with phone screen width (320px)', ['xs', 'constructor'], {
  size: 'xs',
  date: Utils.formatDate(wednesday),
  nights: 1,
  accommodationMode: 'manual'
}, new ScenarioCallChain()
    .click(Selectors.roomInfoButton)
    .click(Selectors.roomConstructorSelect)
    .click(Selectors.roomConstructorSelectOption1)
    .render(outDir)
    .click(Selectors.roomConstructorExtra)
    .click(Selectors.roomConstructorSelect)
    .click(Selectors.roomConstructorSelectOption2)
    .render(outDir)
    .done()
);

runner.register('Calendar with common screen width (1980px)', ['lg', 'calendar'], {
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .click(Selectors.searchCalendarButton)
    .render(outDir, Selectors.searchCalendar)
    .done()
);

runner.register('Calendar with phone screen width (320px)', ['xs', 'calendar'], {
  size: 'xs',
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .click(Selectors.searchCalendarButton)
    .render(outDir, Selectors.searchCalendar)
    .done()
);

runner.register('Terms with common screen width (1980px)', ['lg', 'terms'], {
  accommodationMode: 'auto',
  nights: 1,
  adults: 1,
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .click(Selectors.roomBookButton)
    .wait(Selectors.previewPage)
    .click(Selectors.cartProccedBooking)
    .click(Selectors.paymentTerms)
    .render(outDir, Selectors.modalContent)
    .done()
);

runner.register('Terms with phone screen width (320px)', ['xs', 'terms'], {
  accommodationMode: 'auto',
  size: 'xs',
  nights: 1,
  adults: 1,
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .click(Selectors.roomInfoButton)
    .click(Selectors.roomBookButton)
    .wait(Selectors.previewPage)
    .click(Selectors.cartProccedBooking)
    .click(Selectors.paymentTerms)
    .render(outDir, Selectors.modalContent)
    .done()
);

runner.register('Payment instruction popup', ['instruction'], {
  accommodationMode: 'auto',
  nights: 1,
  adults: 1,
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .click(Selectors.roomBookButton)
    .wait(Selectors.previewPage)
    .click(Selectors.cartProccedBooking)
    .click(Selectors.paymentInstruction)
    .render(outDir, Selectors.modalContent)
    .done()
);

runner.register('Office description tooltip', ['office'], {
  accommodationMode: 'auto',
  nights: 1,
  adults: 1,
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .click(Selectors.roomBookButton)
    .wait(Selectors.previewPage)
    .click(Selectors.cartProccedBooking)
    .click(Selectors.paymentOfficeButton)
    .render(outDir, Selectors.paymentOffice)
    .done()
);

runner.register('Cancellation rule tooltip', ['rule'], {
  accommodationMode: 'auto',
  nights: 1,
  adults: 1,
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .click(Selectors.roomCancellationRuleButton)
    .render(outDir, Selectors.roomCancellationRule)
    .done()
);

runner.register('Rooms select', ['select'], {
  accommodationMode: 'manual',
  nights: 1,
  adults: 1,
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .click(Selectors.roomQuantitySelect)
    .render(outDir, Selectors.selectDropdownTl)
    .done()
);

runner.register('Citizenship select', ['select'], {
  accommodationMode: 'auto',
  nights: 1,
  adults: 1,
  date: Utils.formatDate(wednesday)
}, new ScenarioCallChain()
    .click(Selectors.roomBookButton)
    .wait(Selectors.previewPage)
    .click(Selectors.cartProccedBooking)
    .click(Selectors.paymentCitizenship)
    .render(outDir, Selectors.selectDropdown)
    .done()
);

runner.register('Cancellation with common screen width (1980px)', ['lg', 'cancellation'], {
  state: 'cancellation'
}, new ScenarioCallChain()
    .wait(Selectors.cancellationPage)
    .value(Selectors.cancellationFormNumber, config.defaults.cancellationNumber)
    .value(Selectors.cancellationFormCode, config.defaults.cancellationCode)
    .sleep(1000)
    .render(outDir)
    .click(Selectors.cancellationDetailsButton)
    .wait(Selectors.cancellationDetails)
    .render(outDir)
    .click(Selectors.cancellationAgreeButton)
    .render(outDir)
    .done()
);

runner.register('Cancellation with phone screen width (320px)', ['xs', 'cancellation'], {
  state: 'cancellation',
  size: 'xs'
}, new ScenarioCallChain()
    .wait(Selectors.cancellationPage)
    .value(Selectors.cancellationFormNumber, config.defaults.cancellationNumber)
    .value(Selectors.cancellationFormCode, config.defaults.cancellationCode)
    .sleep(1000)
    .render(outDir)
    .click(Selectors.cancellationDetailsButton)
    .wait(Selectors.cancellationDetails)
    .render(outDir)
    .click(Selectors.cancellationAgreeButton)
    .render(outDir)
    .done()
);

runner.register('Static rooms list with common screen width (1980px)', ['lg', 'list'], {
  state: 'rooms'
}, new ScenarioCallChain()
    .wait(Selectors.roomsListPage)
    .sleep(500)
    .render(outDir)
    .done()
);

runner.register('Static rooms list with phone screen width (320px)', ['xs', 'list'], {
  state: 'rooms',
  size: 'xs'
}, new ScenarioCallChain()
    .wait(Selectors.roomsListPage)
    .sleep(500)
    .render(outDir)
    .done()
);

// END SCENARIOS

console.log('Available tags: ' + runner.tags.join(', '));
console.log('');

runner.run();