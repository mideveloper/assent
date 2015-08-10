var _ = require("lodash"),
    Promise = require("bluebird"),
    Util = require("util"),
    Goof = require("goof")(),
    Messages = Goof.Messages;

function isEmpty(value) {
    if (value === undefined || value === null || value === "" || ((Object.prototype.toString.call(value) === "[object Array]") && value.length === 0) || (typeof value === "string" && value.trim() === "") ) {
        return false;
    }
    return true;
}

function isBoolean(value) {

    if (value !== null && value !== undefined) {
        if (!(value === true || value === false)) {
            return false;
        }
    }
    return true;
}

function isArray(value) {
    if (Object.prototype.toString.call(value) !== "[object Array]") {
        return false;
    }
    return true;
}

function isNumber(value) {

    if (value !== null && value !== undefined) {
        if (typeof value === "object" || isNaN(value)) {
            return false;
        }
    }
    return true;
}

function isInteger(value) {

    if (value !== null && value !== undefined) {
        if (!isNumber(value)){return false;}
        else if (value % 1 !== 0) {
            return false;
        }
    }
    return true;
}

function isIntegerUnsigned(value) {
    if (value !== null && value !== undefined) {
        if (!isNumber(value)){return false;}
        else if (value % 1 !== 0 || value < 0) {
            return false;
        }
    }
    return true;
}

// Latitude is a value of floating data type between [-90, 90]
//
function isValidLatitude(value) {
    if (value !== null && value !== undefined) {
        if (!isNumber(value)){return false;}
        else if (value > 90 || value < -90) {
            return false;
        }
    }
    return true;
}

// Longitude is a value of floating data type between [-180, 180]
//
function isValidLongitude(value) {
    if (value !== null && value !== undefined) {
        if (!isNumber(value)){return false;}
        else if (value > 180 || value < -180) {
            return false;
        }
    }
    return true;
}

function isNumberInRange(value, rangeArgs) {

    if (rangeArgs && rangeArgs.length === 2) {
        var min = rangeArgs[0];
        var max = rangeArgs[1];

        if ((min && value < min) || (max && value > max)) {
            return false;
        }
    }
    else {
        return false;
    }
    return true;
}

function isLengthInRange(value, rangeArgs) {

    if (value !== null && value !== undefined) {
        if (value.length !== undefined) {
            if (!rangeArgs){return false;}
            if (rangeArgs.length === 1) {
                rangeArgs.push(rangeArgs[0]);
            }
            return isNumberInRange(value.length, rangeArgs);
        }
        else {
            return false;
        }
    }
    return true;
}

var all_validations = [
    {
        key: "required",
        method: isEmpty,
        error_message: Messages.getMessage("REQUIRED")
    },
    {
        key: "int",
        method: isInteger,
        error_message: Messages.getMessage("INVALID_FORMAT"),
        type: "integer"
    }, {
        key: "number",
        method: isNumber,
        error_message: Messages.getMessage("INVALID_FORMAT"),
        type: "number"
    }, {
        key: "boolean",
        method: isBoolean,
        error_message: Messages.getMessage("INVALID_FORMAT"),
        type: "boolean"
    }, {
        key: "length",
        method: isLengthInRange,
        error_message: Messages.getMessage("OUT_OF_RANGE")
    }, {
        key: "lat",
        method: isValidLatitude,
        error_message: Messages.getMessage("INVALID_LAT")
    }, {
        key: "lon",
        method: isValidLongitude,
        error_message: Messages.getMessage("INVALID_LON")
    }, {
        key: "array",
        method: isArray,
        error_message: Messages.getMessage("INVALID_FORMAT"),
        type: "array"
    }, {
        key: "custom",
        error_message: "Custom validation failed for {0}"
    },
    {
        key: "unsignedinteger",
        method: isIntegerUnsigned,
        error_message: Messages.getMessage("INVALID_FORMAT")
    }
];

function validateParameterRule(rule, param_value, param_name) {

    var key, rule_value, rule_args;

    key = rule.key;
    rule_value = rule.value;
    if (rule_value === undefined || rule_value === null){
        return "Incorrect validation rule";
    }

    if (rule_value.args) {
        rule_args = rule_value.args;
    }
    var validation = _.find(all_validations, function(v) {
        return v.key === key;
    });

    var is_valid;

    if (validation) {
        if (rule_value.method) {
            is_valid = rule_value.method(param_value);
        }
        else if (rule_value !== false) {
            is_valid = validation.method(param_value, rule_args);
        }
    }
    else {
        return "Unknown validation";
    }

    if (is_valid === false) {

        // set error_message, default if not provided
        var error_message = rule_value.error_message ? rule_value.error_message : validation.error_message;
        if (!error_message){error_message = "%s validation failed";}

        // prepare agrs to format error message
        var args = [param_name];
        if (validation.type){args.push(validation.type);}
        if (rule_args){args = args.concat(rule_args);}

        for (var i = 0; i < args.length; i++) {
            error_message = Util.format(error_message, args[i]);
        }

        return error_message;
    }
    return;
}

function returnErrorsAsPromise(err) {
    return new Promise(function(resolve) {
        return resolve(err); //in previous version it was throwing error
    });
}

function validateAsyncCustomRules(async_rules) {

    if (async_rules && async_rules.length > 0) {

        var async_methods = [];
        var errors = [];

        _.each(async_rules, function(rule){

            var p = new Promise(function(resolve, reject) {
                var err_msg = rule.error_message ? rule.error_message : "async validation failed";
                rule.method().then(function(res) {
                    if (res === false) {
                        errors.push(err_msg);
                        reject(err_msg);
                        return;
                    }
                    resolve();
                    return;
                });
            });

            async_methods.push(p);

        });

        return Promise.all(async_methods).spread(function() {
            return;
        }).catch (function() {
            return returnErrorsAsPromise(errors);
        });
    }
    else {
        return new Promise(function(resolve) {
            resolve();
            return;
        });
    }
}

function validateCustomRules(rules) {

    var sync_rules = rules.sync;
    // var async_rules = rules.async;

    var error_messages = [];

    for (var i = 0; i < sync_rules.length; i++) {

        var rule = sync_rules[i];

        if (rule.method) {
            var is_validate = rule.method(rule);
            if (is_validate === false) {
                var error_message = rule.error_message ? rule.error_message : "custom validation failed";
                error_messages.push(error_message);
            }
        }
        else {
            error_messages.push("Method not defined for custom sync rule");
        }
    }
    if (error_messages.length > 0) {
        return returnErrorsAsPromise(error_messages);
    }
    else{
        return validateAsyncCustomRules(rules.async);
    }
}

function validateRules(params, rules) {
    if (!params || params.length === 0) {
        return returnErrorsAsPromise("Empty parameters object");
    }

    var default_rules = rules.default;
    var custom_rules = rules.custom;

    var error_messages = [];

    for (var i = 0; i < default_rules.length; i++) {

        var rule = default_rules[i];

        var param_name;
        var param_rules;

        for (var name in rule) {
            param_name = name;
            param_rules = rule[name];
        }

        var param_value = params[param_name];

        for (var r in param_rules) {
            var err = validateParameterRule({
                key: r,
                value: param_rules[r]
            }, param_value, param_name);
            if (err) {
                error_messages.push(err);
                break;
            }
        }
    }

    if (error_messages.length > 0) {
        return returnErrorsAsPromise(error_messages);
    }
    else {
        return validateCustomRules(custom_rules);
    }
}

function validate(params, rules){

    return validateRules(params, rules.get());

}

module.exports.validate = validate;
