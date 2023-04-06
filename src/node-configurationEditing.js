// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago"s Electronic Visualization Laboratory (EVL)
// and University of Hawai"i at Manoa"s Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014

// require variables to be declared
"use strict";


// Built in
var fs            = require("fs");               // filesystem access
var {spawn}       = require("child_process");    // Needed for restart
var path          = require("path");
// Defined in package.json
var json5         = require("json5");            // Relaxed JSON format
var chalk         = require("chalk");
// Custom
var sageutils     = require("../src/node-utils");


var shouldAllowFileEditing = true; // Maybe want easy way to disable real file changes



/**
 * Function to handle background Image update
 * @param url {String} URL of image
 * @param config {Object} Current configuration file
 * @param clients {Array} all clients array
 */
function configUpdateBackgroundImage(url, config, clients) {

	// // Update and keep changes made to the configuration file.
	// var json_str   = fs.readFileSync(configLocation, "utf8");
	// // Parse it using json5 syntax (more lax than strict JSON)
	// var userConfig = json5.parse(json_str);

	// Ensure an entry for background.image exists
	if (!config.background.image) {
		config.background.image = {};
	}
	config.background.image.url = url;


	// Write file to keep changes.
	// TODO enable this after sure it works
	// fs.writeFileSync(pathToSageUiPwdFile, jsonString);

	// Send to each display client an updated value for the background image
	for (let i = 0; i < clients.length; i++) {
		if (clients[i].clientType === "display") {
			clients[i].emit("updateDisplayConfiguration", config);
		}
	}

}

/**
 * For rechecking the config file after updated
 *
 * @param pathToConfigFile {String} Path to the config file
 * @param config {Object} Current configuration that was read (file might have changes)
 * @param clients {Array} all clients array
 */
function recheckConfiguration(pathToConfigFile, currentConfig, clients,
	initializeRemoteSites) {
	console.log("TODO implmenent recheckConfiguration");


	console.log("TODO: remove debugging: remotesites recheck");

	// Read the specified configuration file
	var json_str   = fs.readFileSync(pathToConfigFile, "utf8");
	// Parse it using json5 syntax (more lax than strict JSON)
	var userConfig = json5.parse(json_str);


	// Manual update of the remote sites
	currentConfig.remote_sites = userConfig.remote_sites;

	// Must now recheck
	initializeRemoteSites();
}

/**
 * For rechecking the config file after updated
 *
 * @param pathToConfigFile {String} Path to the config file
 * @param config {Object} Current configuration that was read (file might have changes)
 * @param clients {Array} all clients array
 */
function checkForFieldsThatDontNeedRestart(diffResults, submittedConfig, currentConfig, initializeRemoteSites) {
	let diffString = JSON.stringify(diffResults);
	if (diffString.includes("remote_sites")) {
		currentConfig.remote_sites = submittedConfig.remote_sites;
		// Must now recheck
		initializeRemoteSites();
	}
}



/**
 * Pass back appropriate configuration file data
 *
 * @param currentConfig {Object} Current file
 * @param wsio {Object} who asked
 */
function handlerForRequestCurrentConfigurationFile(currentConfig, wsio) {
	// For minimal changes the tips property needs to be filled out.
	var tips = {};
	tips.layoutWidth  = "";
	tips.layoutHeight = "";
	tips.resolutionWidth  = "";
	tips.resolutionHeight = "";

	currentConfig.tips = tips;
	// Must now recheck
	wsio.emit("requestConfigAndTipsResponse", currentConfig);
}

/**
 * Pass back appropriate configuration file data
 *
 * @param currentConfig {Object} Current file
 * @param wsio {Object} who asked
 */
function handlerForAssistedConfigSend(wsio, submittedConfig, currentConfig, initializeRemoteSites) {
	// For minimal changes the tips property needs to be filled out.
	console.log("erase me, server received config from assistedConfig. btw submitted config:", submittedConfig);
	let diff = determineDifferentFields(submittedConfig, currentConfig);

	//TODO probably need to move this up, in particular before restarting
	applyChangesToActualFile(submittedConfig);

	if (submittedConfig.makeCerts) {
		updateCertificates(submittedConfig, () => {
			restartIfChangedFieldsRequire(diff);
			checkForFieldsThatDontNeedRestart(diff, submittedConfig, currentConfig, initializeRemoteSites);
		});
	} else {
		restartIfChangedFieldsRequire(diff);
		checkForFieldsThatDontNeedRestart(diff, submittedConfig, currentConfig, initializeRemoteSites);
	}
	console.log("erase me, adding starter entry {} to differences for formatting");
	diff.splice(0, 0, {});
	console.log("erase me, ", diff);

}
// -------------------------------------------------------------------------------------------------

/**
 * Will return a description of changes.
 *
 * @param submittedConfig {Object} Config submitted that might have changes
 * @param currentConfig {Object} Current config known by server
 */
function determineDifferentFields(submittedConfig, currentConfig) {
	// Copy over fields. NOTE: these need to be undone at end of function
	currentConfig.index_port = currentConfig.port;
	currentConfig.port = currentConfig.secure_port;

	// Setup for diff check
	let scKeys = Object.keys(submittedConfig);
	let ccKeys = Object.keys(currentConfig);
	let differences = [];
	let n1, n2;

	// First go through submitted config
	for (let i = 0; i < scKeys.length; i++) {
		if (ccKeys.includes(scKeys[i])) {
			// Basic check, if property is an object, then use basic comparison with string
			if (typeof submittedConfig[scKeys[i]] === "object") {
				n1 = JSON.stringify(submittedConfig[scKeys[i]]);
				n2 = JSON.stringify(currentConfig[scKeys[i]]);
				if (n1 !== n2) {
					n1 = {};
					n1["sc_" + scKeys[i]] = JSON.stringify(submittedConfig[scKeys[i]]);
					n1["cc_" + scKeys[i]] = JSON.stringify(currentConfig[scKeys[i]]);
					differences.push(n1);
				} // For non-object, basic comparison is enough just to detect difference.
			} else if (submittedConfig[scKeys[i]] !== currentConfig[scKeys[i]]) {
				n1 = {};
				n1["sc_" + scKeys[i]] = submittedConfig[scKeys[i]];
				n1["cc_" + scKeys[i]] = currentConfig[scKeys[i]];
				differences.push(n1);
			}
		} else { // entries unique to the submitted
			n1 = {};
			n1[scKeys[i]] = submittedConfig[scKeys[i]];
			n1.uniqueToSubmitted = true;
			differences.push(n1);
		}
	}
	// Find entries only within the current
	for (let i = 0; i < ccKeys.length; i++) {
		if (!scKeys.includes(ccKeys[i])) {
			n1 = {};
			n1[ccKeys[i]] = (typeof currentConfig[ccKeys[i]] === "object") ?
				JSON.stringify(currentConfig[ccKeys[i]]) : currentConfig[ccKeys[i]];
			n1.uniqueToCurrent = true;
			differences.push(n1);
		}
	}

	// Undo swap from beginning of function for correct diff'ing
	currentConfig.secure_port = currentConfig.port;
	currentConfig.port = currentConfig.index_port;
	return differences;
}

/**
 * Checks diff for field changes that require restart.
 *
 * @param currentConfig {Object} Current file
 * @param wsio {Object} who asked
 */
function applyChangesToActualFile(submittedConfig) {
	if (!shouldAllowFileEditing) {
		return; // not allowed, just return
	}
	// Based on the sabi server.js file at function socketOnAssistedConfigSend()
	let entriesToCopyOver = [
		"layout",
		// "displays", // Not sure this should be copied over.
		"host",
		"port",
		"index_port",
		"resolution",
		"alternate_hosts",
		"remote_sites"
	];
	// Path first
	var pathToWinDefaultConfig		= path.join(homedir(), "Documents", "SAGE2_Media", "config", "defaultWin-cfg.json");
	var pathToMacDefaultConfig		= path.join(homedir(), "Documents", "SAGE2_Media", "config", "default-cfg.json");
	var pathToMacTesting		= path.join(homedir(), "Documents", "SAGE2_Media", "config", "configTesting-cfg.json");
	// Then open config file
	var cfg;
	if (process.platform === "win32") {
		cfg = json5.parse(fs.readFileSync(pathToWinDefaultConfig));
	} else if (process.platform === "darwin") {
		cfg = json5.parse(fs.readFileSync(pathToMacDefaultConfig));
	// } else if (process.platform === "linux") {
	} else {
		sageutils.log("SAGE2", chalk.red.bold("Unknown platform " + process.platform + ". Unable to config edit"));
	}
	// Copy over fields
	for (let i = 0; i < entriesToCopyOver.length; i++) {
		cfg[entriesToCopyOver[i]] = submittedConfig[entriesToCopyOver[i]];
	}
	sageutils.log("SAGE2", chalk.green.bold("Updating configuration file"));
	fs.writeFileSync(pathToMacTesting, json5.stringify(cfg, null, 4));
	// TODO update to actual
}

/**
 * Generates homedir path based on OS
 *
 */
function homedir() {
	var env  = process.env;
	var home = env.HOME;
	var user = env.LOGNAME || env.USER || env.LNAME || env.USERNAME;
	if (process.platform === "win32") {
		return env.USERPROFILE || env.HOMEDRIVE + env.HOMEPATH || home || null;
	}
	if (process.platform === "darwin") {
		return home || (user ? "/Users/" + user : null);
	}
	if (process.platform === "linux") {
		return home || (process.getuid() === 0 ? "/root" : (user ? "/home/" + user : null));
	}
	return home || null;
}

/**
 * Test if file is exists
 *
 * @method fileExists
 * @param filename {String} name of the file to be tested
 * @return {Bool} true if exists
 */
// function fileExists(filename) {
// 	try {
// 		var res = fs.statSync(filename);
// 		return res.isFile();
// 	} catch (err) {
// 		return false;
// 	}
// }

/**
 * Starts certificate generation if requested
 *
 */
function updateCertificates(submittedConfig, callbackForRestart) {
	console.log("erase me, TODO updateCertificates needs to be filled out");
	//
	// let pathToConfig; //config name differs depending on OS.
	// let platform = os.platform() === "win32" ? "Windows" : os.platform() === "darwin" ? "Mac OS" : "Linux";
	// if (platform === "Windows") {
	// 	pathToConfig = path.join(homedir(), "Documents", "SAGE2_Media", "config", "defaultWin-cfg.json");
	// } else if (platform === "Mac OS") {
	// 	pathToConfig = path.join(homedir(), "Documents", "SAGE2_Media", "config", "default-cfg.json");
	// } else {
	// 	sageutils.log("SAGE2", chalk.green.bold("Problem trying to update configuration file"));
	// 	return;
	// }

	// if (!fileExists(pathToConfig)) {
	// 	sageutils.log("SAGE2", chalk.green.bold("Error, config doesn't exist."));
	// 	return;
	// }
	// Keeping above incase support for other OS might be implemented

	let host = submittedConfig.host;
	let alternate = submittedConfig.alternate_hosts;
	var pathToSabiConfigFolder		= path.join(homedir(), "Documents", "SAGE2_Media", "sabiConfig");
	var pathToGoWindowsCertGenFile	= path.join(pathToSabiConfigFolder, "scripts", "GO-windows.bat");
	var pathToActivateGoWindowsCert = path.join(pathToSabiConfigFolder, "scripts", "activateWindowsCertGenerator.bat");
	let rewriteContents = "REM Must be run as administrator\n";
	//rewriteContents += "pushd %~dp0\n"; //Not sure what this does... it stores the directory the script is run from. But to retrieve the path, a popd must be used. No other scripts in the chain seem to use it.
	rewriteContents += "call init_webserver.bat localhost\n";
	rewriteContents += "call init_webserver.bat 127.0.0.1\n";
	rewriteContents += "call init_webserver.bat " + host + "\n";
	for (let i = 0; i < alternate.length; i++) {
		rewriteContents += "call init_webserver.bat " + alternate[i] + "\n";
	}
	fs.writeFileSync(pathToGoWindowsCertGenFile, rewriteContents);

	rewriteContents = "@echo off\n\n";
	rewriteContents += 'start /MIN /D "..\\keys" ' + pathToGoWindowsCertGenFile;
	fs.writeFileSync(pathToActivateGoWindowsCert, rewriteContents);
	let file = path.normalize(pathToActivateGoWindowsCert); // convert Unix notation to windows
	let proc = spawn(file, []);
	proc.stdout.on('data', function (data) {
		console.log('stdout: ' + data);
	});
	proc.stderr.on('data', function (data) {
		console.log('stderr: ' + data);
	});
	proc.on('exit', function (code) {
		console.log('child process exited with code ' + code);
		if (callbackForRestart) {
			callbackForRestart();
		}
	});
}

/**
 * Checks diff for field changes that require restart.
 *
 * @param currentConfig {Object} Current file
 * @param wsio {Object} who asked
 */
function restartIfChangedFieldsRequire(differences) {
	// For "only these entries cause restart"
	let entriesToTriggerRestart = [
		"host",
		"port",
		"index_port",
		"resolution",
		"layout",
		"experimental",
		"alternate_hosts"
	];
	// // For "anything except these entries cause restart"
	// let entriesThatDontTriggerRestart = [
	// 	"remote_sites",
	// 	"makeCerts",
	// 	"uniqueToSubmitted",
	// 	"uniqueToCurrent",
	// 	"rproxy_port",
	// ];
	let shouldRestart = false;
	console.log("erase me, string check on diff:" + JSON.stringify(differences));
	// For "only these entries cause restart"
	let diffString = JSON.stringify(differences);
	for (let i = 0; i < differences.length; i++) {
		// Need the sc_ and cc_ prefix for submitted vs current context
		if ((diffString.includes('"sc_' + entriesToTriggerRestart[i] + '":'))
			|| (diffString.includes('"cc_' + entriesToTriggerRestart[i] + '":'))
		) {
			sageutils.log("SAGE2", chalk.red.bold("Configuration change in field [" + entriesToTriggerRestart[i] + "] detected"));
			shouldRestart = true;
			break;
		}
	}
	// // For "anything except these entries cause restart"
	// let diffKeys = [];
	// for (let i = 0; i < differences.length; i++) {
	// 	diffKeys.push(...Object.keys(differences[i]));
	// }
	// console.log("erase me, diffkeys:", diffKeys);
	// console.log("erase me, also as a string diffKeys:", diffKeys);
	// for (let i = 0; i < diffKeys.length; i++) {

	// 	if (!entriesThatDontTriggerRestart.includes(diffKeys[i].substring(3))) {
	// 		sageutils.log("SAGE2", chalk.red.bold("Configuration change in field [" + diffKeys[i] + "] detected"));
	// 		shouldRestart = true;
	// 		break;
	// 	}
	// }
	if (shouldRestart) {
		console.log("erase me, need to restart, but need better way");
		serverRestarter();
	}
}

/**
 * Will attempt to restart the server
 *
 */
function serverRestarter() {
	sageutils.log("SAGE2", chalk.red.bold("Restarting"));

	if (process.platform === "win32") {
		console.log("windows restarter bat");
	}
	if (process.platform === "darwin") { // mac
		console.log("mac restarter");
		// spawn(process.argv0, process.argv.slice(1), {
		// 	detached: true,
		// 	stdio: "inherit"
		// 	// stdio: ["ignore", out, err]
		// }).unref();
	}
	// if (process.platform === "linux") { }
	process.exit();
}

/**
 * Will attempt to stop the server
 *
 */
function serverStopper() {
	sageutils.log("SAGE2", chalk.red.bold("STOPPING"));
	process.exit();
}
// -------------------------------------------------------------------------------------------------

module.exports.configUpdateBackgroundImage = configUpdateBackgroundImage;
module.exports.recheckConfiguration = recheckConfiguration;
module.exports.handlerForRequestCurrentConfigurationFile = handlerForRequestCurrentConfigurationFile;
module.exports.handlerForAssistedConfigSend = handlerForAssistedConfigSend;
module.exports.serverStopper = serverStopper;
