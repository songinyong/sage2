//
// SAGE2 application: remoteSiteControls
// by: Dylan Kobayashi <dylank@hawaii.edu>
//
// Copyright (c) 2018
//

"use strict";


// Please see https://bitbucket.org/sage2/sage2/wiki/SAGE2%20Webview%20Container for instructions


var remoteSiteControls = sage2_webview_appCoreV01_extendWebview({
	webpageAppSettings: {
		setSageAppBackgroundColor: true,  // Web pages without background values will be transparent.
		backgroundColor: "white",         // Used if above is true, can also use rgb and hex strings
		enableRightClickNewWindow: false, // If true, right clicking on images or links open new webview
		printConsoleOutputFromPage: true, // If true, when web page uses console.log, container will console.log that value in display client

		// If you want your context entries to appear before or after the default
		putAdditionalContextMenuEntriesBeforeDefaultEntries: true,
		// The following will include the default Webview context menu entry if set to true.
		enableUiContextMenuEntries: {
			navigateBack:       false, // alt left-arrow
			navigateForward:    false, // alt right-arrow
			reload:             true, // alt r
			autoRefresh:        false, // must be selected from UI context menu
			consoleViewToggle:  false, // must be selected from UI context menu
			zoomIn:             true, // alt up-arrow
			zoomOut:            true, // alt down-arrow
			urlTyping:          false, // must be typed from UI context menu
			copyUrlToClipboard: false, // must be typed from UI context menu
		},
	},
	init: function(data) {
		// Will be called after initial SAGE2 init()
		// this.element will refer to the webview tag
		this.resizeEvents = "continuous"; // Recommended not to change. Options: never, continuous, onfinish

		// Path / URL of the page you want to show
		this.changeURL(this.resrcPath + "/webpage/" + this.state.pageToShow, false);
		this.thereCanOnlyBeOne();
		if (remoteSiteControls.sitesToShareWith === undefined) {
			remoteSiteControls.sitesToShareWith = [];
		}
		if (remoteSiteControls.hasAddedNewAppMonitoring === undefined) {
			remoteSiteControls.hasAddedNewAppMonitoring = false;
		}
		if (remoteSiteControls.applicationsThatWillBeShared === undefined) {
			remoteSiteControls.applicationsThatWillBeShared = [
				"image_viewer",
				"movie_player",
				"pdf_viewer",
				"Webview"
			];
		}
	},
	load: function(date) {
		// OPTIONAL
		// The state will be automatically passed to your webpage through the handler you gave to SAGE2_AppState
		// Use this if you want to alter the state BEFORE it is passed to your webpage. Access with this.state
	},
	draw: function(date) {
		// OPTIONAL
		// Your webpage will be in charge of its view
		// Use this if you want to so something within the SAGE2 Display variables
		// Be sure to set 'this.maxFPS' within init() if this is desired.
		// FPS only works if instructions sets animation true
	},
	resize: function() {
		// OPTIONAL
	},
	getContextEntries: function() {
		// OPTIONAL
		// This can be used to allow UI interaction to your webpage
		// Entires are added after entries of enableUiContextMenuEntries 
		var entries = [];
		// entries.push({
		// 	description: "This text is seen in the UI",
		// 	callback: "makeAFunctionMatchingThisString", // The string will specify which function to activate
		// 	parameters: {},
		// 	// The called function will be passed an Object.
		// 	// Each of the parameter properties will be in that object
		// 	// Some properties are reserved and may be automatically filled in.
		// });
		return entries;
	},
	// ----------------------------------------------------------------------------------------------------
	// ----------------------------------------------------------------------------------------------------
	// ----------------------------------------------------------------------------------------------------
	// Support functions
	thereCanOnlyBeOne: function() {
		// the newest one is the survivor
		let allas = applications;
		let ids = Object.keys(allas);
		let app = null;
		for (let i = 0; i < ids.length; i++) {
			app = allas[ids[i]];
			if (app.application === "remoteSiteControls") {
				if (app.id != this.id) {
					wsio.emit("deleteApplication", {appId: app.id});
					console.log("erase me, tried to delete?");
				} 
			}
		}
	},

	// ----------------------------------------------------------------------------------------------------
	// ----------------------------------------------------------------------------------------------------
	// ----------------------------------------------------------------------------------------------------
	// Functions that interact with webpage

	// Functions can be called from the webpage, see the webpage/main.js file for example
	consolePrint: function (value) {
		console.log(value);
	},

	webpageRequestingUiSize: function(params) {
		this.callFunctionInWebpage("handlerForUiSize", ui.titleTextSize);
		this.callFunctionInWebpage("handleSiteNotification", this.state.remoteSiteInformation);
		if (remoteSiteControls.sitesToShareWith
			&& remoteSiteControls.sitesToShareWith.includes(this.state.remoteSiteInformation.name)) {
				this.callFunctionInWebpage("handleSharingState", true);
			}
	},

	sendKnock: function(params) {
		if (isMaster) {
			console.log("Received from webpage knock action", params);
			wsio.emit("remoteSiteKnockSend", params);
		}
	},

	shareEverythingNew: function(params) {
		console.log("Received from webpage shareEverythingNew", params);
		this.addSiteSharing(params);
		this.callFunctionInWebpage("handleSharingState", true);
	},
	stopShareEverythingNew: function(params) {
		this.removeSiteSharing(params);
		this.callFunctionInWebpage("handleSharingState", false);
	},

	addSiteSharing: function(site) {
		if (!remoteSiteControls.hasAddedNewAppMonitoring) {
			remoteSiteControls.hasAddedNewAppMonitoring = true;
			this.addAppMonitoring();
			console.log("hasAddedNewAppMonitoring");
		}
		let stsw = remoteSiteControls.sitesToShareWith;
		if (!stsw.includes(site.name)) {
			stsw.push(site.name);
		}

		console.log("erase me, addSiteSharing calling");
		// Try add the icon to the bar.
		ui.setRemoteIconVisibility(site.name, "iconShare", true);
		console.log("erase me, why not done?");
	},

	addAppMonitoring() {
		// cannot use wsio.on('createAppWindow', function(data) {
		// Reason: it overwrites the function
		// TODO: alernative
		remoteSiteControls.original_createAppWindow = wsio.messages["createAppWindow"];
		wsio.messages["createAppWindow"] = function(data) {
			remoteSiteControls.original_createAppWindow(data);
			if (remoteSiteControls.applicationsThatWillBeShared.includes(data.application)){
				if (data.application === "pdf_viewer") {
					setTimeout(function() {
						let stsw = remoteSiteControls.sitesToShareWith;
						for (let i = 0; i < stsw.length; i++) {
								console.log("TODO share the app with related sites", data.id);
								if (isMaster) {
									// wsCallFunctionOnApp();
									console.log("Should be trying to send " + data.id);
									wsio.emit("callFunctionOnApp", {
										app: data.id,
										func: "SAGE2_shareWithSite",
										parameters: {
											remoteSiteName: stsw[i]
										} 
									});
								}
						}
					}, 2000);
				} else {
					window.requestAnimationFrame(function() {
						let stsw = remoteSiteControls.sitesToShareWith;
						for (let i = 0; i < stsw.length; i++) {
								console.log("TODO share the app with related sites", data.id);
								if (isMaster) {
									// wsCallFunctionOnApp();
									console.log("Should be trying to send " + data.id);
									wsio.emit("callFunctionOnApp", {
										app: data.id,
										func: "SAGE2_shareWithSite",
										parameters: {
											remoteSiteName: stsw[i]
										} 
									});
								}
						}
					});
				}
			}
		};
	},

	removeSiteSharing: function(site) {
		let stsw = remoteSiteControls.sitesToShareWith;
		if (stsw.indexOf(site.name) !== -1) {
			stsw.splice(stsw.indexOf(), 1);
		}
		ui.setRemoteIconVisibility(site.name, "iconShare", false);
	},

	awayStatus: function(params) {
		if (isMaster) {
			console.log("Received from webpage awayStatus", params);
			if (params) {
				console.log("Should only be available to the following site", params);
			} else {
				console.log("Should not be available to anyone");
			}
			for (let i = 0; i < ui.addedRemoteSites.length; i++) {
				if (params && (params.name === ui.addedRemoteSites[i])) {
					ui.setRemoteIconVisibility(ui.addedRemoteSites[i], "iconUnavailable", false);
				} else {
					ui.setRemoteIconVisibility(ui.addedRemoteSites[i], "iconUnavailable", true);
				}
			}
			wsio.emit("remoteSiteUnavailable", params);
		}
	},

	containerStartKnockAudioWithClick: function(params) {
		// Simulate a mouse click
		this.element.sendInputEvent({
			type: "mouseDown",
			x: 10, y: 10,
			button: "left",
			modifiers: null,
			clickCount: 1
		});
	},

});