// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014

/* global */

"use strict";

/**
 * This is to support notificaiton and settings for live editing of remote sites.
 *
 * @module client
 * @submodule RemoteSiteInfo
 */

/**
* Constructor for RemoteSiteInfo object
*
* @class RemoteSiteInfo
* @constructor
* @param json_cfg {Object} configuration structure
* @param clientID {Number} ID of the display client (-1, 0, ...N)
*/
function RemoteSiteInfoBuilder(json_cfg, clientID) {
	// Save the wall configuration object
	this.json_cfg = json_cfg;
	this.clientID = clientID;
	if (this.clientID === -1) {
		this.offsetX = 0;
		this.offsetY = 0;
	} else {
		// Position of the tile
		var x = this.json_cfg.displays[this.clientID].column;
		var y = this.json_cfg.displays[this.clientID].row;
		// Calculate offsets for borders
		var borderx  = (x + 1) * this.json_cfg.resolution.borders.left + x * this.json_cfg.resolution.borders.right;
		var bordery  = (y + 1) * this.json_cfg.resolution.borders.top  + y * this.json_cfg.resolution.borders.bottom;
		this.offsetX = x * this.json_cfg.resolution.width  + borderx;
		this.offsetY = y * this.json_cfg.resolution.height + bordery;
	}
	this.displayMessages = {};
	// Get handle on the main div
	// this.bg   = document.getElementById("background");
	this.main = document.getElementById("main");




	// ------------------------------------------------------------------------
	// AcceptReject message functions
	this.showAcceptRejectMessage = function(paramObj) {
		this.displayMessages.acceptReject.text.textContent = paramObj.message;
		this.displayMessages.acceptReject.dialog.style.display = "block";

		if (paramObj.hideAccept) {
			this.setAcceptRejectButtonVisibility("accept", false);
		} else {
			this.setAcceptRejectButtonVisibility("accept", true);
		}
		if (paramObj.hideReject) {
			this.setAcceptRejectButtonVisibility("reject", false);
		} else {
			this.setAcceptRejectButtonVisibility("reject", true);
		}
	};

	this.hideAcceptRejectMessage = function() {
		this.displayMessages.acceptReject.dialog.style.display = "none";
	};

	this.setAcceptRejectButtonVisibility = function(whichButton, flag) {
		this.displayMessages.acceptReject;
		if (whichButton === "accept") {
			this.displayMessages.acceptReject.accept.style.display =
				(flag) ? "block" : "none";
		} else if (whichButton === "reject") {
			this.displayMessages.acceptReject.reject.style.display =
				(flag) ? "block" : "none";
		}
	};

	this.checkForAcceptRejectMessageAndMakeIfNeeded = function() {
		// If exists, OK to use.
		if (this.displayMessages.acceptReject) {
			return;
		}
		// Otherwise need to make it.
		this.displayMessages.acceptReject = {};
		let ar = this.displayMessages.acceptReject;

		// 1. Make message box:
		ar.dialog =  document.createElement("div");
		ar.id = "remoteSiteMessageAcceptReject";
		ar.dialog.id = ar.id + "Dialog";
		// Most of these values match the data sharing request dialog, the numbers match server UI element creation. See setUpRemoteSiteDialogsAsInteractableObjects.
		let dialogWidth = 26; // units: ui title bar
		let dialogHeight = 10;
		let titleBarHeight = this.json_cfg.ui.titleBarHeight;
		let titleTextSize = this.json_cfg.ui.titleTextSize;
		ar.dialog.style.position = "absolute";
		ar.dialog.style.top = (-this.offsetY + (2 * titleBarHeight)).toString() + "px";
		ar.dialog.style.left = (-this.offsetX + (this.json_cfg.totalWidth / 2
			- dialogWidth / 2 * titleBarHeight)).toString() + "px";
		ar.dialog.style.width = (dialogWidth * titleBarHeight).toString() + "px";
		ar.dialog.style.height = (dialogHeight * titleBarHeight).toString() + "px";
		ar.dialog.style.webkitBoxSizing = "border-box";
		ar.dialog.style.mozBoxSizing = "border-box";
		ar.dialog.style.boxSizing = "border-box";
		ar.dialog.style.backgroundColor =  "#666666";
		ar.dialog.style.border =  "2px solid #000000";
		ar.dialog.style.padding = (titleBarHeight / 4).toString() + "px";
		// Keeping zIndez to match datasharing
		ar.dialog.style.zIndex = 8999;
		ar.dialog.style.display = "none";
		// 2. Make
		ar.text = document.createElement("p");
		// Keeping convention from datasharing
		ar.text.id = ar.id + "_text";
		ar.text.textContent = "";
		ar.text.style.fontSize = Math.round(2 * titleTextSize) + "px";
		ar.text.style.color = "#FFFFFF";
		ar.text.style.marginBottom = (titleBarHeight / 4).toString() + "px";
		ar.text.style.whiteSpace = "pre";
		// 3. Accept button
		ar.accept = document.createElement("div");
		ar.accept.id = ar.id + "_accept";
		ar.accept.style.position = "absolute";
		ar.accept.style.left = (titleBarHeight / 4).toString() + "px";
		ar.accept.style.bottom = (titleBarHeight / 4).toString() + "px";
		ar.accept.style.width = (9 * titleBarHeight).toString() + "px";
		ar.accept.style.height = (3 * titleBarHeight).toString() + "px";
		ar.accept.style.webkitBoxSizing = "border-box";
		ar.accept.style.mozBoxSizing = "border-box";
		ar.accept.style.boxSizing = "border-box";
		ar.accept.style.backgroundColor =  "rgba(55, 153, 130, 1.0)";
		ar.accept.style.border =  "2px solid #000000";
		ar.accept.style.textAlign = "center";
		ar.accept.style.lineHeight = (3 * titleBarHeight).toString() + "px";
		// 4. Accept text
		ar.acceptText = document.createElement("p");
		ar.acceptText.id = ar.id + "_acceptText";
		ar.acceptText.textContent = "Accept";
		ar.acceptText.style.fontSize = Math.round(2 * titleTextSize) + "px";
		ar.acceptText.style.color = "#FFFFFF";
		ar.accept.appendChild(ar.acceptText);
		// 5. Reject button
		ar.reject = document.createElement("div");
		ar.reject.id = ar.id + "_reject";
		ar.reject.style.position = "absolute";
		ar.reject.style.right = (titleBarHeight / 4).toString() + "px";
		ar.reject.style.bottom = (titleBarHeight / 4).toString() + "px";
		ar.reject.style.width = (9 * titleBarHeight).toString() + "px";
		ar.reject.style.height = (3 * titleBarHeight).toString() + "px";
		ar.reject.style.webkitBoxSizing = "border-box";
		ar.reject.style.mozBoxSizing = "border-box";
		ar.reject.style.boxSizing = "border-box";
		ar.reject.style.backgroundColor =  "rgba(173, 42, 42, 1.0)";
		ar.reject.style.border =  "2px solid #000000";
		ar.reject.style.textAlign = "center";
		ar.reject.style.lineHeight = (3 * titleBarHeight).toString() + "px";
		ar.rejectText = document.createElement("p");
		ar.rejectText.id = ar.id + "_rejectText";
		ar.rejectText.textContent = "Reject";
		ar.rejectText.style.fontSize = Math.round(2 * titleTextSize) + "px";
		ar.rejectText.style.color = "#FFFFFF";
		ar.reject.appendChild(ar.rejectText);
		ar.dialog.appendChild(ar.text);
		ar.dialog.appendChild(ar.accept);
		ar.dialog.appendChild(ar.reject);
		this.main.appendChild(ar.dialog);
	};

	// ------------------------------------------------------------------------
	// Handling AcceptReject interaction
	this.handleInteraction = function(pointer_data) {
		let arDialog = this.displayMessages.acceptReject.dialog;
		// Only allow interaction with visible pointers (pointer mode)
		if (pointer_data.visible) {
			// If block, then should be visible and prompting for accept / reject
			if (arDialog.style.display === "block") {
				// Hide
				arDialog.style.display === "none";
			}
		}
	};

	// ------------------------------------------------------------------------

	// Add message elements to UI.
	this.checkForAcceptRejectMessageAndMakeIfNeeded();
}
