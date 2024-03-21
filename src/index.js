#! /usr/bin/env node
"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANGUAGE_DEFAULT = void 0;
var boxen_1 = require("boxen");
var chalk_1 = require("chalk");
var yargs_1 = require("yargs");
exports.LANGUAGE_DEFAULT = "en";
var _isWindows = false;
var _isMacintosh = false;
var _isLinux = false;
var _isLinuxSnap = false;
var _isNative = false;
var _isCI = false;
var nodeProcess = undefined;
if (typeof process !== "undefined" &&
    typeof ((_a = process === null || process === void 0 ? void 0 : process.versions) === null || _a === void 0 ? void 0 : _a.node) === "string") {
    // Native environment (non-sandboxed)
    nodeProcess = process;
}
// Native environment
if (typeof nodeProcess === "object") {
    _isWindows = nodeProcess.platform === "win32";
    _isMacintosh = nodeProcess.platform === "darwin";
    _isLinux = nodeProcess.platform === "linux";
    _isLinuxSnap =
        _isLinux && !!nodeProcess.env["SNAP"] && !!nodeProcess.env["SNAP_REVISION"];
    _isCI =
        !!nodeProcess.env["CI"] ||
            !!nodeProcess.env["BUILD_ARTIFACTSTAGINGDIRECTORY"];
    _isNative = true;
}
var usage = chalk_1.default.hex("#8F00FF")("\nUsage: mycli -l <language>  -s <sentence> \n" +
    (0, boxen_1.default)(chalk_1.default.green("\n" + "Translates a sentence to specific language" + "\n"), { padding: 1, borderColor: "green", dimBorder: true }) +
    "\n");
var options = yargs_1.default
    .usage(usage)
    .option("l", {
    alias: "language",
    describe: "Translate to language",
    type: "string",
    demandOption: false,
})
    .option("s", {
    alias: "sentence",
    describe: "Sentence to be translated",
    type: "string",
    demandOption: false,
})
    .help(true).argv;
console.log("Test");
