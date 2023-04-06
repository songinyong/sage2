// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014

"use strict";

/* global SAGE2_webrtc_ui_tracker SAGE2WebrtcPeerConnection */

/**
 * @module client
 * @submodule media_stream
 */

/**
 * Class for media streaming applications, no block streaming
 *
 * @class media_stream
 */
var media_stream = SAGE2_App.extend({

	/**
	* Init method, creates a 'img' tag in the DOM
	*
	* @method init
	* @param data {Object} contains initialization values (id, width, height, ...)
	*/
	init: function(data) {
		this.SAGE2Init("canvas", data);
		this.ctx = this.element.getContext('2d');
		this.bufferId = 0;

		this.img1LoadedFunc = this.img1Loaded.bind(this);
		this.img2LoadedFunc = this.img2Loaded.bind(this);

		this.img1 = new Image();
		this.img2 = new Image();

		this.img1IsLoaded = false;
		this.img2IsLoaded = false;

		this.img1.addEventListener('load', this.img1LoadedFunc, false);
		this.img2.addEventListener('load', this.img2LoadedFunc, false);

		this.resizeEvents = null;
		this.moveEvents   = null;
		this.date = data.date;

		this.webrtc_activateIfEnabled();
	},

	img1Loaded: function() {
		this.bufferId = 0;
		this.img1IsLoaded = true;
		this.draw(this.date);
		this.webrtc_fallbackStatusHideCheck();
	},

	img2Loaded: function() {
		this.img2IsLoaded = true;
		this.bufferId = 1;
		this.draw(this.date);
		this.webrtc_fallbackStatusHideCheck();
	},



	/**
	* Loads the app from a previous state
	*
	* @method load
	* @param state {Object} object to initialize or restore the app
	* @param date {Date} time from the server
	*/
	load: function(date) {
		this.date = date;

		var b64;
		if (this.state.encoding === "binary") {
			b64 = btoa(this.state.src);
		} else if (this.state.encoding === "base64") {
			b64 = this.state.src;
		}

		if (this.bufferId === 0) {
			this.img2.src = "data:" + this.state.type + ";base64," + b64;
		} else {
			this.img1.src = "data:" + this.state.type + ";base64," + b64;
		}


		// modifying img.src directly leads to memory leaks
		// explicitly allocate and deallocate: 'createObjectURL' / 'revokeObjectURL'

		// var base64;
		// if(state.encoding === "base64") base64 = state.src;
		// else if(state.encoding === "binary") base64 = btoa(state.src);
		// this.element.src = "data:" + state.type + ";base64," + base64;

		/*
		var bin;
		if (this.state.encoding === "binary") bin = this.state.src;
		else if (this.state.encoding === "base64") bin = atob(this.state.src);

		var buf  = new ArrayBuffer(bin.length);
		var view = new Uint8Array(buf);
		for (var i=0; i<view.length; i++) {
			view[i] = bin.charCodeAt(i);
		}

		var blob   = new Blob([buf], {type: this.state.type});
		var source = window.URL.createObjectURL(blob);

		if (this.src !== null) window.URL.revokeObjectURL(this.src);

		this.src = source;
		this.element.src = this.src;
		*/
	},

	/**
	* Draw function
	*
	* @method draw
	* @param date {Date} current time from the server
	*/
	draw: function(date) {
		if (this.bufferId === 0 && this.img1IsLoaded === true) {
			this.ctx.drawImage(this.img1, 0, 0, this.element.width, this.element.height);
		} else if (this.bufferId === 1 && this.img2IsLoaded === true) {
			this.ctx.drawImage(this.img2, 0, 0, this.element.width, this.element.height);
		}
	},

	/**
	* After resize
	*
	* @method resize
	* @param date {Date} current time from the server
	*/
	resize: function(date) {
	},

	/**
	* Handles event processing for the app
	*
	* @method event
	* @param eventType {String} the type of event
	* @param position {Object} contains the x and y positions of the event
	* @param user_id {Object} data about the user who triggered the event
	* @param data {Object} object containing extra data about the event,
	* @param date {Date} current time from the server
	*/
	event: function(eventType, position, user_id, data, date) {
		if (eventType === "keyboard") {
			// if (data.character === 'x') {
			// 	// Press 'x' to close itself
			// 	this.close();
			// }
		}
	},


	// ---------------------------------------------------------------------------------------------------
	// Webrtc checkin
	webrtc_activateIfEnabled: function() {
		console.log("media_stream checking if webrtc is enabled");
		if (SAGE2_webrtc_ui_tracker.enabled) {
			console.log("    ENABLED");
			this.webrtcParts = {}; // add storage for webrtc parts
			this.webrtc_addParts();
			this.webrtc_askUIForStreamInfo();
		} else {
			console.log("    DISABLED");
		}
	},

	// Add the visuals to the app, for now it covers the old stuff
	webrtc_addParts: function() {
		let vid = document.createElement("video");
		this.webrtcParts.videoElement = vid;
		this.webrtcParts.fallbackStatusHideCounter = 0;
		vid.style.position = "absolute";
		vid.style.left = "0px";
		vid.style.top = "0px";
		// auto play is an issue if not started from a user interaction
		vid.autoplay = true;
		// but no constraint yet on muted video
		vid.muted = true;
		vid.style.width = "100%";
		vid.style.height = "100%";

		this.element.parentNode.appendChild(vid);

		// Add information div to let user know about connection status
		let statusDiv = document.createElement("div");
		this.webrtcParts.status = statusDiv;
		statusDiv.style.position = "absolute";
		statusDiv.style.top = "0px";
		statusDiv.style.left = "0px";
		statusDiv.style.width = "100%";
		statusDiv.style.height = "100%";
		statusDiv.style.background = "white";
		statusDiv.innerHTML = "<h1>Trying to screenshare with WebRTC</h1>";
		statusDiv.innerHTML += "<h3>If this message is still visible after ~30 seconds"
			+ "WebRTC is probably blocked on the network</h3>"
			+ "<h3>If WebRTC doesn't work, disable WebRTC and restart the screenshare</h3>"
			+ "<h3>To do this, from UI access View > Settings > uncheck Use WebRTC</h3><br><br>";
		statusDiv.innerHTML += "<h1>Initializing WebRTC connection...</h1>";
		this.element.parentNode.insertBefore(statusDiv, this.element);
	},

	// Request stream info from UI, give it the UID from wsio to uniquely identify display client
	// The UID is used incase there are two display clients pointed at the same viewport
	webrtc_askUIForStreamInfo: function() {
		let isRemoteShare = false; // WARNING: only works one hop?
		// Remote share if there are three pipes: remote_server:port | client| stream id
		if (this.id.split("|").length === 3) {
			isRemoteShare = true;
		}
		if (!isRemoteShare) {
			// Need to handshake with the source client
			this.webrtcParts.streamerId = this.id.split("|")[0];
			// Send to client
			wsio.emit("sendDataToClient", {
				clientDest: this.webrtcParts.streamerId,
				func: "webrtc_SignalMessageFromDisplay",
				appId: this.id,
				destinationId: this.webrtcParts.streamerId,
				sourceId: wsio.UID,
				message: "appStarted"
			});
		} else {
			// This is a remotely shared ScreenShare, need to handshake with the original source client
			// Three parts, the middle is the source client
			this.webrtcParts.streamerId = this.id.split("|")[1];
			// Send to client
			wsio.emit("webRtcRemoteScreenShareSendingDisplayMessage", {
				clientDest: this.webrtcParts.streamerId,
				func: "webrtc_SignalMessageFromDisplay",
				appId: this.id,
				destinationId: this.webrtcParts.streamerId,
				sourceId: wsio.UID,
				message: "appStarted"
			});
		}
		this.webrtcParts.status.innerHTML += "<h1>Requesting Path from STUN server...</h1>";
	},

	webrtc_SignalMessageFromUi: function(responseObject) {

		// Could have only gotten here by knowing appId, check if for this display
		if (responseObject.destinationId === wsio.UID) {
			// If a peer has not yet been made, make it now
			if (!this.webrtcParts.s2wpc) {
				this.webrtcParts.s2wpc = new SAGE2WebrtcPeerConnection(
					this.id,                            // Id of this app
					responseObject.sourceId,            // UI id for identifying streamerid
					wsio.UID,                           // Goto specific display
					null,                               // Display doesn't have stream
					this.webrtcParts.videoElement,      // Display has destination video element
					responseObject.cameFromSourceServer // Only has a value if came from a remote source
				);
			}
			// Otherwise, let it get handled
			this.webrtcParts.s2wpc.readMessage(responseObject.message, () => {
				// This function triggers when a connection is detected
				this.webrtcParts.status.style.visibility = "hidden";
				this.showModeInTitle("Fast mode");
			});
		}
	},

	webrtc_fallbackStatusHideCheck: function() {
		this.webrtcParts.fallbackStatusHideCounter++;
		// If the img1Loaded or 2 is triggered more than three times, the client is sending frames outside of webrtc.
		if (this.webrtcParts.fallbackStatusHideCounter > 2) {
			this.webrtcParts.status.style.visibility = "hidden";
			this.showModeInTitle();
		}
	},

	showModeInTitle: function(mode) {
		if (mode) {
			var titleText = document.getElementById(this.id + "_text").textContent;
			titleText = titleText.substring(0, titleText.indexOf("een"));
			titleText += "een (" + mode + ")";
			document.getElementById(this.id + "_text").textContent = titleText;
		}
	}

});
