// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2019

// Require variables to be declared
"use strict";

// Used for colorizing the console output
var chalk = require('chalk');
// SAGE2 modules
var sageutils = require('../src/node-utils');

var remoteSiteBlockName = "SAGE2_versionWarning";

/**
 * VersionChecker container object.
 *
 * @class VersionChecker
 * @constructor
 * @param  {object} obj - Object containing necessary references to function at server top level
 */
function VersionChecker(obj) {
	sageutils.log("Version", "Starting...");
	sageutils.log("Version", "Base: " + obj.version.base);
	sageutils.log("Version", "Branch: " + obj.version.branch);
	sageutils.log("Version", "Date: " + obj.version.date);
	this.myVersion = obj.version;

	this.config = obj.config;
	// Just the remote site section from the config
	this.remote_sites = obj.config.remote_sites;
	// Keep the function references
	this.showGenericInfoPaneOnDisplay = obj.showGenericInfoPaneOnDisplay;
	// For updating clients
	this.clients = obj.clients;

	// Using this to ensure all messages are visible.
	this.messageQueue = [];

	// Use for quick reference of mismatch status
	this.versionMismatchExists = false;
	this.mismatchVersionLog = "";
	this.remoteSiteBlockReference = obj.block;
}


/**
 * Function doesThisServerKnowAboutRemoteSite is to determine if
 * local server know about a particular remote_sites.
 *
 * @method doesThisServerKnowAboutRemoteSite
 * @param  {String} host - String of the host address for remote site.
 */
VersionChecker.prototype.doesThisServerKnowAboutRemoteSite = function(host) {
	let found = false;
	for (var i = 0; i < this.remote_sites.length; i++) {
		if (host.includes(this.remote_sites[i].host)
			|| this.remote_sites[i].host.includes(host)) {
			found = i;
			break;
		}
	}
	if (found === false) {
		this.setMismatchToTrue();
		let info = "Incomming remote connection initiated by site '" + host
		+ " not specified by local config.  ";
		sageutils.log("Version", chalk.red(info));
		this.addToMismatchLog(info);
	}
	return found;
};


/**
 * Function determineIfVersionMismatch to detect if remote site has a
 * different version from the local version.
 *
 * @method determineIfVersionMismatch
 * @param  {Object} remoteData - Data remote site sends about its remote config
 * @param  {Object} site - Information part of the socket handler for the remote site
 * @param  {String} remotesocketAddress - Address of the remote socket for reporting.
 */
VersionChecker.prototype.determineIfVersionMismatch = function(remoteData, site, remotesocketAddress) {
	// Need to know if remote site know about this server
	// Note: only possible to determine if verion is after ~2019 05
	let found = this.doesRemoteSiteKnowAboutThisServer(remoteData);
	// Versioning between remote sites.
	let mismatch = this.determineIfVersionMismatchBetweenRemoteSiteAndThiServer(remoteData);

	if (mismatch || !found) {
		// If a mismatch, then OK to state version mismatch
		if (mismatch) {
			// Start message here
			this.addToMismatchLog("# --- " + site.name + " - Version Mismatch Detected ---#");
			this.addToMismatchLog("");
		} else {
			// Otherwise it was just awareness of site
			// Start message here
			this.addToMismatchLog("# --- " + site.name + " - Not Aware Of This Site ---#");
			this.addToMismatchLog("");
		}
	}

	if (!found) {
		this.setMismatchToTrue();
		this.addToMismatchLog(remotesocketAddress + " isn't aware of this site and cannot share back");
	}

	if (mismatch) {
		this.setMismatchToTrue();
		let mismatchMessage = [
			"----- Version mismatch detected -----",
			"Warning mismatch with " + site.name
		];
		if (mismatch.beforeCheckVersion) {
			mismatchMessage.push(site.name + " has an older version and is unable to report its version");
			this.addToMismatchLog("* " + mismatchMessage[mismatchMessage.length - 1]);
		}
		if (mismatch.base) {
			mismatchMessage.push(site.name + " has "
			+ mismatch.baseOfRemote + " version and may not work well with this site");
			mismatchMessage.push("This site (" + this.myVersion.base
			+ ") vs (" + remoteData.version.base + ") remote site");
			this.addToMismatchLog(mismatchMessage[mismatchMessage.length - 2]);
			this.addToMismatchLog(mismatchMessage[mismatchMessage.length - 1]);
		}
		if (mismatch.branch) {
			if (mismatch.branchOfRemote.trim().length === 0) {
				mismatchMessage.push(site.name + " did not state their branch");
				mismatchMessage.push("This site (" + this.myVersion.branch
				+ ") vs ( ??? ) remote site");
				this.addToMismatchLog(mismatchMessage[mismatchMessage.length - 2]);
				this.addToMismatchLog(mismatchMessage[mismatchMessage.length - 1]);
			} else {
				mismatchMessage.push(site.name + " has a different branch ("
				+ mismatch.branchOfRemote + ") and may not work well with this site");
				mismatchMessage.push("This site (" + this.myVersion.branch
				+ ") vs (" + remoteData.version.branch + ") remote site");
				this.addToMismatchLog(mismatchMessage[mismatchMessage.length - 2]);
				this.addToMismatchLog(mismatchMessage[mismatchMessage.length - 1]);
			}
		}
		if (mismatch.date) {
			mismatchMessage.push(site.name + " has a "
			+ mismatch.dateOfRemote + " release and may not work well with this site");
			mismatchMessage.push("This site (" + this.myVersion.date
			+ ") vs (" + remoteData.version.date + ") remote site");
			this.addToMismatchLog(mismatchMessage[mismatchMessage.length - 2]);
			this.addToMismatchLog(mismatchMessage[mismatchMessage.length - 1]);
		}
		mismatchMessage.push("----- End of report -----");
		mismatchMessage.forEach((line) => {
			sageutils.log("Version", chalk.red(line));
		});
	}
};


/**
 * Function doesRemoteSiteKnowAboutThisServer is to determine if
 * remote site lists this server in its config.remote_sites.
 *
 * @method doesRemoteSiteKnowAboutThisServer
 * @param  {Object} remoteData - Data remote site gave
 */
VersionChecker.prototype.doesRemoteSiteKnowAboutThisServer = function(remoteData) {
	// Check if remote_sites given. Only exists after ~2019 05 update
	let found = false;
	if (remoteData.locationInformation && remoteData.locationInformation.remote_sites) {
		for (var i = 0; i < remoteData.locationInformation.remote_sites.length; i++) {
			if (this.config.host === remoteData.locationInformation.remote_sites[i].host) {
				found = true;
				break;
			}
		}
		// Can only check if remote site know about this one post previously mentioned update
		if (!found) {
			this.setMismatchToTrue();
			sageutils.log("Version",
				chalk.red("The site " + remoteData.locationInformation.host
					+ " is not configured to share back."));
		}
	}
	return found;
};


/**
 * Function determineIfVersionMismatchBetweenRemoteSiteAndThiServer is to determine if
 * remote site lists this server in its config.remote_sites.
 *
 * @method determineIfVersionMismatchBetweenRemoteSiteAndThiServer
 * @param  {Object} remoteData - Data remote site gave
 */
VersionChecker.prototype.determineIfVersionMismatchBetweenRemoteSiteAndThiServer = function(remoteData) {
	let mismatch = false;
	if (remoteData.version) {
		if (remoteData.version.base !== this.myVersion.base) {
			mismatch = {
				base: "mismatch",
				baseOfRemote: (this.myVersion.base > remoteData.version.base) ? "OLDER" : "NEWER"
			};
		}
		if (remoteData.version.branch !== this.myVersion.branch) {
			mismatch = (mismatch) ? mismatch : {};
			mismatch.branch = "mismatch";
			mismatch.branchOfRemote = remoteData.version.branch;
		}
		if (remoteData.version.date !== this.myVersion.date) {
			mismatch = (mismatch) ? mismatch : {};
			mismatch.date = "mismatch";
			mismatch.dateOfRemote = (this.myVersion.date > remoteData.version.date) ? "OLDER" : "NEWER";
		}
	} else {
		mismatch = {};
		mismatch.beforeCheckVersion = true;
	}

	return mismatch;
};

/**
 * Function tryShowMessageOnDisplay will attempt to ensure all messages get shown.
 * Assumes message SHOULD be shown.
 *
 * @method tryShowMessageOnDisplay
 */
VersionChecker.prototype.tryShowMessageOnDisplay = function(messageData, remoteData, remotesocketAddress) {

	/*
		If the message queue has something in it, then wait.
		Messages in the queue look like:
			{
				remoteData:
				messageData: messageData
			}
	*/
	if (this.messageQueue.length == 0) {
		// Show the message
		this.showGenericInfoPaneOnDisplay(true, messageData);
	}
	let queueData = {
		remoteData,
		messageData
	};
	// Double check index reference
	let remoteSiteIndex = this.doesThisServerKnowAboutRemoteSite(remotesocketAddress);
	if (remoteSiteIndex) {
		// Able to find valid index
		queueData.remoteSiteIndex = remoteSiteIndex;
		if (this.remote_sites[remoteSiteIndex].hasAcceptedNotification) {

			// NOTE! Return here if already asked the question
			return;
		}
	}
	// Push the message now
	this.messageQueue.push(queueData);
};


/**
 * Function tryShowNextMesageInQueueOnDisplay will attempt
 * to ensure all messages get shown. Assumes message SHOULD be shown.
 *
 * @method tryShowNextMesageInQueueOnDisplay
 */
VersionChecker.prototype.tryShowNextMesageInQueueOnDisplay = function(acceptOrReject) {
	// Remote the first message
	this.messageQueue.splice(0, 1);
	// MODIFY STATUS OF ACCEPT REJECT
	sageutils.log("Version", chalk.red("MODIFIED STATUS OF ACCEPT REJECT"));
	if (this.messageQueue.length > 0) {
		// Show the message
		this.showGenericInfoPaneOnDisplay(true, this.messageQueue[0].messageData);
	}
};


/**
 * Function reportReject is to handle the result of a prompt.
 *
 * @method reportReject
 */
VersionChecker.prototype.reportReject = function() {
	sageutils.log("Version", "Reporting REJECT");
	setTimeout(() => {
		this.tryShowNextMesageInQueueOnDisplay("REJECT");
	}, 1500);
};


/**
 * Function reportAccept is to handle the result of a prompt.
 *
 * @method reportAccept
 */
VersionChecker.prototype.reportAccept = function() {
	sageutils.log("Version", "Reporting ACCEPT");

	if (this.messageQueue[0].remoteSiteIndex) {
		this.remote_sites[this.messageQueue[0].remoteSiteIndex].hasAcceptedNotification = true;
	}
	setTimeout(() => {
		this.tryShowNextMesageInQueueOnDisplay("ACCEPT");
	}, 1500);
};

/**
 * Function to get the log.
 *
 * @method setMismatchToTrue
 * @param  {String} info - string of info to add to log
 */
VersionChecker.prototype.setMismatchToTrue = function() {
	this.remoteSiteBlockReference.connected = "off-mismatch";
	let site = {
		name: this.remoteSiteBlockReference.name,
		connected: this.remoteSiteBlockReference.connected,
		geometry: this.remoteSiteBlockReference.geometry};
	if (!this.versionMismatchExists) {
		for (let i = 0; i < this.clients.length; i++) {
			if (this.clients[i].clientType === "display") {
				this.clients[i].emit('addRemoteSite', site);
			}
		}
	}
	this.versionMismatchExists = true;

};

/**
 * Function to add to the log. Mainly used to populate the QuickNote
 *
 * @method addToMismatchLog
 * @param  {String} info - string of info to add to log
 */
VersionChecker.prototype.addToMismatchLog = function(info, addToBottom = true) {
	if (addToBottom) {
		this.mismatchVersionLog += info + "\n";
	} else {
		this.mismatchVersionLog = info + "\n" + this.mismatchVersionLog;
	}
};

/**
 * Function to get the log.
 *
 * @method getMismatchLog
 * @param  {String} info - string of info to add to log
 */
VersionChecker.prototype.getMismatchLog = function() {
	return this.mismatchVersionLog;
};


module.exports = VersionChecker;
module.exports.remoteSiteBlockName = remoteSiteBlockName;
