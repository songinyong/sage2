// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014-2019

/**
 * Omicron connection module for SAGE2
 * Provides external input device support
 * https://github.com/uic-evl/omicron
 *
 * @module server
 * @submodule omicron
 * @requires node-coordinateCalculator, node-1euro
 */

// require variables to be declared
"use strict";

var dgram     = require('dgram');
var net       = require('net');
var util      = require('util');
var sageutils           = require('./node-utils');            // provides the current version number

var CoordinateCalculator = require('./node-coordinateCalculator');
var OneEuroFilter        = require('./node-1euro');

/* eslint consistent-this: ["error", "omicronManager"] */
var omicronManager; // Handle to OmicronManager inside of udp blocks (instead of this)
var drawingManager; // Connect to the node-drawing
/**
 * Omicron setup and opens a listener socket for an Omicron input server to connect to
 *
 * @class OmicronManager
 * @constructor
 * @param sysConfig {Object} SAGE2 system configuration file. Primararly used to grab display dimensions and Omicron settings
 */
function OmicronManager(sysConfig) {
	omicronManager = this;

	this.coordCalculator = null;

	this.oinputserverSocket = null;
	this.omicronDataPort = 9123;

	this.eventDebug   = false;
	this.gestureDebug = false;

	this.pointerOffscreen  = false;
	this.showPointerToggle = true;

	this.lastPosX = 0;
	this.lastPosY = 0;

	this.totalWidth  = 0;
	this.totalHeight = 0;

	// Touch
	this.enableTouch = true;
	this.touchOffset = [0, 0];
	this.wandScaleDelta = 250;
	this.acceleratedDragScale = 0;

	this.touchZoomScale = 520;
	this.moveEventCounter = 0;
	this.moveEventLimit = 100; // if 100, sends 1/100 of move events received

	// Mocap
	this.enableMocap = false;

	// Wand
	this.enableWand = false;
	this.wandLabel = "wandTracker";
	this.wandColor = "rgba(250, 5, 5, 1.0)";

	this.wandXFilter = null;
	this.wandYFilter = null;

	this.lastWandFlags     = 0;
	this.wandState = {};

	this.defaultWandMode = "window"; // App interaction mode (window/app)

	// 1 euro filtering
	var freq = 120;
	var mincutoff = 1.25;
	var beta = 2;
	var dcutoff = 10;

	this.wandXFilter = new OneEuroFilter(freq, mincutoff, beta, dcutoff);
	this.wandYFilter = new OneEuroFilter(freq, mincutoff, beta, dcutoff);

	this.curTime = 0;
	this.lastEventTime = 0;
	this.updateEventTimer = 0;

	if (sysConfig.experimental !== undefined) {
		this.config = sysConfig.experimental.omicron;
	}

	this.coordCalculator = new CoordinateCalculator(this.config);

	this.lastNonCritEventTime = Date.now();
	this.nonCriticalEventDelay = 10;

	var serverHost = sysConfig.host;

	// Used to determine the initial position of a zoom gesture
	// If the distance from the initial position exceeds threshold,
	// zoom becomes a drag
	this.initZoomPos = {};
	if (this.config && this.config.zoomToMoveGestureMinimumDistance) {
		this.zoomToMoveGestureMinimumDistance = this.config.zoomToMoveGestureMinimumDistance;
	} else {
		this.zoomToMoveGestureMinimumDistance = 100;
	}

	// Used to track changes in the pointer state (like a zoom becoming a move)
	this.pointerState = {};

	// Default Gestures
	this.enableDoubleClickMaximize = true;
	this.enableThreeFingerRightClick = true;
	this.enableTwoFingerWindowDrag = false;
	this.enableTwoFingerZoom = true;
	this.enableFiveFingerCloseApp = false;
	this.enableBigTouchPushToBack = true;
	this.bigTouchMinSize = 75;

	var clientParameters = 0;
	//clientParameters |= 1 << 0;	// Sending data to server (instead of receiving - default: off)
	//clientParameters |= 1 << 11;	// Use TCP for all data instead of by event type (default: off)
	//clientParameters |= 1 << 12;	// Use UDP for all data instead of by event type (default: off)

	// Request ServiceTypes (all on by default)
	clientParameters |= 1 << 1;		// Pointer
	clientParameters |= 1 << 2;		// Mocap
	//clientParameters |= 1 << 3;		// Keyboard
	//clientParameters |= 1 << 4;		// Controller
	//clientParameters |= 1 << 5;		// UI
	//clientParameters |= 1 << 6;		// Generic
	//clientParameters |= 1 << 7;		// Brain
	clientParameters |= 1 << 8;		// Wand
	clientParameters |= 1 << 9;		// Speech
	//clientParameters |= 1 << 10;	// Image
	clientParameters |= 1 << 13;	// Audio

	// Default config
	if (this.config === undefined) {
		this.config = {};
		this.config.enable = false;
		this.config.dataPort = 30005;
		this.config.eventDebug = false;

		this.config.zoomGestureScale = 2000;
		this.config.acceleratedDragScale = 0;
		this.config.gestureDebug = false;

		this.config.msgPort = 28000;
	}

	this.config.clientFlags = clientParameters;


	var defaultTouchExcludedApps = [
		"Webview",
		"googlemaps",
		"zoom"
	];

	// This is intentionally before the config disable check
	this.appsExcludedFromTouchInteraction = this.config.appsExcludedFromTouchInteraction === undefined ?
		defaultTouchExcludedApps : this.config.appsExcludedFromTouchInteraction;

	if (this.config.enable === false) {
		return;
	}

	this.nonCriticalEventDelay = this.config.nonCriticalEventDelay === undefined
		? this.nonCriticalEventDelay : this.config.nonCriticalEventDelay;

	// Config: Touch
	this.enableTouch = this.config.enableTouch === undefined ? true : this.config.enableTouch;
	console.log(sageutils.header('Omicron') + 'Touch Enabled: ', this.enableTouch);

	// Config: Mocap
	this.enableMocap =  this.config.enableMocap === undefined ? false : this.config.enableMocap;
	console.log(sageutils.header('Omicron') + 'Mocap Enabled: ', this.enableMocap);

	// Config: Wand
	this.enableWand =  this.config.enableWand === undefined ? false : this.config.enableWand;
	console.log(sageutils.header('Omicron') + 'Wand Enabled: ', this.enableWand);

	this.wandNames =  this.config.wandNames === undefined ? {} : this.config.wandNames;

	if (this.config.touchOffset) {
		this.touchOffset =  this.config.touchOffset;
		console.log(sageutils.header('Omicron') + 'Touch points offset by: ', this.touchOffset);
	}

	// Config: Gestures
	this.enableGestures =  this.config.enableGestures === undefined ? true : this.config.enableGestures;

	this.touchZoomScale =  this.config.zoomGestureScale === undefined ? this.touchZoomScale : this.config.zoomGestureScale;
	this.acceleratedDragScale =  this.config.acceleratedDragScale === undefined ?
		this.acceleratedDragScale : this.config.acceleratedDragScale;
	this.moveEventLimit =  this.config.moveEventLimit === undefined ? this.moveEventLimit : this.config.moveEventLimit;

	this.enableDoubleClickMaximize =  this.config.enableDoubleClickMaximize === undefined ?
		this.enableDoubleClickMaximize : this.config.enableDoubleClickMaximize;
	this.enableThreeFingerRightClick =  this.config.enableThreeFingerRightClick === undefined ?
		this.enableThreeFingerRightClick : this.config.enableThreeFingerRightClick;
	this.enableTwoFingerWindowDrag =  this.config.enableTwoFingerWindowDrag === undefined ?
		this.enableTwoFingerWindowDrag : this.config.enableTwoFingerWindowDrag;
	this.enableTwoFingerZoom =  this.config.enableTwoFingerZoom === undefined ?
		this.enableTwoFingerZoom : this.config.enableTwoFingerZoom;
	this.enableFiveFingerCloseApp = this.config.enableFiveFingerCloseApp === undefined ?
		this.enableFiveFingerCloseApp : this.config.enableFiveFingerCloseApp;
	this.enableBigTouchPushToBack = this.config.enableBigTouchPushToBack === undefined ?
		this.enableBigTouchPushToBack : this.config.enableBigTouchPushToBack;
	this.enableTouchMinSize = this.config.enableTouchMinimumSize === undefined ?
		this.enableTouchMinSize : this.config.enableTouchMinimumSize;

	this.enableStuckTouchDetection = this.config.enableStuckTouchDetection === undefined ?
		true : this.config.enableStuckTouchDetection;
	this.stuckTouchDetectionInterval = this.config.stuckTouchDetectionInterval === undefined ?
		500 : this.config.stuckTouchDetectionInterval;

	// Config: Omicron
	if (this.config.host === undefined) {
		sageutils.log('Omicron', 'Using web server hostname:', sysConfig.host);
	} else {
		serverHost = this.config.host;
		sageutils.log('Omicron', 'Using server hostname:', serverHost);
	}

	if (this.config.dataPort === undefined) {
		sageutils.log('Omicron', 'dataPort undefined. Using default:', this.omicronDataPort);
	} else {
		this.omicronDataPort =  this.config.dataPort;
		sageutils.log('Omicron', 'Listening for input server on port:', this.omicronDataPort);
	}

	if (this.config.touchOffset) {
		this.touchOffset =  this.config.touchOffset;
		sageutils.log('Omicron', 'Touch points offset by:', this.touchOffset);
	}

	if (this.config.eventDebug) {
		this.eventDebug =  this.config.eventDebug;
		sageutils.log('Omicron', 'Event Debug Info:', this.eventDebug);
	}

	if (this.config.gestureDebug) {
		this.gestureDebug =  this.config.gestureDebug;
		sageutils.log('Omicron', 'Gesture Debug Info:', this.gestureDebug);
	}

	if (sysConfig.resolution) {
		var columns = 1;
		var rows    = 1;

		if (sysConfig.layout) {
			columns = sysConfig.layout.columns;
			rows    = sysConfig.layout.rows;
		}

		this.totalWidth  = sysConfig.resolution.width * columns;
		this.totalHeight = sysConfig.resolution.height * rows;

		sageutils.log('Omicron', 'Touch Display Resolution:', this.totalWidth, this.totalHeight);
	} else {
		this.totalWidth  = 8160;
		this.totalHeight = 2304;
	}

	// For accepting input server connection
	var server = net.createServer(function(socket) {
		sageutils.log('Omicron', 'Input server',
			socket.remoteAddress, 'connected on port', socket.remotePort);

		socket.on('error', function(e) {
			sageutils.log('Omicron', 'Input server disconnected');
			socket.destroy(); // Clean up disconnected socket
		});

	});

	server.listen(this.omicronDataPort, serverHost);

	if (this.config.inputServerIP !== undefined) {
		omicronManager.oinputserverConnected = false;
		var msgPort = 28000;
		if (this.config.msgPort) {
			msgPort = this.config.msgPort;
		}

		omicronManager.connect(msgPort);

		// attempt to connect every 15 seconds, if connection failed
		setInterval(function() {
			if (omicronManager.oinputserverConnected === false) {
				omicronManager.connect(msgPort);
			}
		}, 15000);

		omicronManager.runTracker();
	}


	// Touch Point/Gesture Tracking
	this.touchList = new Map(); // All touch points
	this.touchGroups = new Map(); // Touch groups and their child points

	// Check for stuck touches
	setInterval(function() {
		if (omicronManager.enableStuckTouchDetection === true) {
			var curTime = Date.now();
			for (var tp of omicronManager.touchList.keys()) {
				var data = omicronManager.touchList.get(tp);
				var dt = curTime - data.timestamp;
				if (dt > omicronManager.stuckTouchDetectionInterval) {
					omicronManager.hidePointer(tp);
					sageutils.log('Omicron', 'Removed stuck touch: ' + tp);
					omicronManager.touchList.delete(tp);
				}
			}
		}
	}, omicronManager.stuckTouchDetectionInterval);
}

OmicronManager.prototype.setTouchEnabled = function(val) {
	omicronManager.enableTouch = val;
};

OmicronManager.prototype.setMocapEnabled = function(val) {
	omicronManager.enableMocap = val;
};
OmicronManager.prototype.setWandEnabled = function(val) {
	omicronManager.enableWand = val;
};

OmicronManager.prototype.openWebSocketClient = function(ws, req) {
	sageutils.log('Omicron', 'WebSocket Client connected: ' + req.connection.remoteAddress);
	omicronManager.sendToWebSocketClient({msg: "SAGE2_Hello"});
};

OmicronManager.prototype.sendToWebSocketClient = function(data) {
	omicronManager.wsServer.broadcast(JSON.stringify(data));
};

OmicronManager.prototype.isExcludedTouchApplication = function(val) {
	for (var i = 0; i < omicronManager.appsExcludedFromTouchInteraction.length; i++) {
		var appName = omicronManager.appsExcludedFromTouchInteraction[i];
		if (val == appName) {
			return true;
		}
	}
	return false;
};

/**
 * Initializes connection with Omicron input server
 *
 * @method connect
 */
OmicronManager.prototype.connect = function(msgPort) {
	sageutils.log('Omicron', 'Connecting to Omicron oinputserver at "' +
		omicronManager.config.inputServerIP + '" on msgPort: ' + msgPort + '.');

	omicronManager.oinputserverSocket = net.connect(msgPort, omicronManager.config.inputServerIP,  function() {
		// 'connect' listener
		sageutils.log('Omicron', 'Connection Successful. Requesting data on port',
			omicronManager.omicronDataPort);
		omicronManager.oinputserverConnected = true;

		var sendbuf = util.format("omicronV3_data_on,%d,%d\n", omicronManager.omicronDataPort, omicronManager.config.clientFlags);
		omicronManager.oinputserverSocket.write(sendbuf);
	});
	omicronManager.oinputserverSocket.on('error', function(e) {
		sageutils.log('Omicron', 'oinputserver connection error - code:', e.code);
		omicronManager.oinputserverConnected = false;
	});
	omicronManager.oinputserverSocket.on('end', function(e) {
		sageutils.log('Omicron', 'oinputserver disconnected');
		omicronManager.oinputserverConnected = false;
	});
	omicronManager.oinputserverSocket.on('data', function(e) {
		// sageutils.log('Omicron', 'oinputserver receiving data:', e);
		// TCP stream
		omicronManager.processIncomingEvent(e);
	});
};


/**
 * Sends disconnect signal to input server
 *
 * @method disconnect
 */
OmicronManager.prototype.disconnect = function() {
	if (this.oinputserverSocket) {
		var sendbuf = util.format("data_off");
		sageutils.log('Omicron', 'Sending disconnect signal');
		this.oinputserverSocket.write(sendbuf);
	}
};


/**
 * Links the drawing manager to the omicron server
 *
 * @method linkDrawingManager
 */
OmicronManager.prototype.linkDrawingManager = function(dManager) {
	drawingManager = dManager;
};


/**
 * Receives server pointer functions
 *
 * @method setCallbacks
 */
OmicronManager.prototype.setCallbacks = function(
	sagePointerList,
	createSagePointerCB,
	showPointerCB,
	pointerPressCB,
	pointerMoveCB,
	pointerPositionCB,
	hidePointerCB,
	pointerReleaseCB,
	pointerScrollStartCB,
	pointerScrollCB,
	pointerScrollEndCB,
	pointerDblClickCB,
	pointerCloseGestureCB,
	keyDownCB,
	keyUpCB,
	keyPressCB,
	createRadialMenuCB,
	omi_pointerChangeModeCB,
	kinectInputCB,
	remoteInteractionCB,
	wsCallFunctionOnAppCB,
	pointerSendToBackCB) {
	this.sagePointers        = sagePointerList;
	this.createSagePointer   = createSagePointerCB;
	this.showPointer         = showPointerCB;
	this.pointerPress        = pointerPressCB;
	this.pointerMove         = pointerMoveCB;
	this.pointerPosition     = pointerPositionCB;
	this.hidePointer         = hidePointerCB;
	this.pointerRelease      = pointerReleaseCB;
	this.pointerScrollStart  = pointerScrollStartCB;
	this.pointerScroll       = pointerScrollCB;
	this.pointerScrollEnd       = pointerScrollEndCB;
	this.pointerDblClick     = pointerDblClickCB;
	this.pointerCloseGesture = pointerCloseGestureCB;
	this.keyDown             = keyDownCB;
	this.keyUp               = keyUpCB;
	this.keyPress            = keyPressCB;
	this.createRadialMenu    = createRadialMenuCB;
	this.kinectInput 				 = kinectInputCB;
	this.pointerChangeMode = omi_pointerChangeModeCB;
	this.remoteInteraction = remoteInteractionCB;
	this.callFunctionOnApp = wsCallFunctionOnAppCB;
	this.pointerSendToBack = pointerSendToBackCB;
	// sageutils.log('Omicron', "Server callbacks set");
};

/**
 * Manages incoming input server data
 *
 * @method runTracker
 */
OmicronManager.prototype.runTracker = function() {
	if (this.config.enable === false) {
		return;
	}

	var udp = dgram.createSocket("udp4");

	udp.on("message", function(msg, rinfo) {
		omicronManager.processIncomingEvent(msg, rinfo);
	});

	udp.on("listening", function() {
		var address = udp.address();
		sageutils.log('Omicron', 'UDP listening on port', address.port);
	});

	udp.bind(this.omicronDataPort);
};

OmicronManager.prototype.sageToOmicronEvent = function(uniqueID, pointerX, pointerY, data, type, color) {
	var e = {};
	e.timestamp = Date.now();
	e.sourceId = uniqueID;
	e.serviceType = 0; // 0 = pointer
	e.type = type;
	e.flags = 0;
	e.posx = pointerX;
	e.posy = pointerY;
	e.posz = 0;
	e.orw = 0;
	e.orx = 0;
	e.ory = 0;
	e.orz = 0;
	e.extraDataType = 0;
	e.extraDataItems = 0;
	e.extraDataMask = 0;
	e.extraDataSize = 0;
	e.extraDataString = color;
	return e;
};

OmicronManager.prototype.processIncomingEvent = function(msg, rinfo) {
	omicronManager.curTime = Date.now();

	/*
	if(rinfo == undefined) {
		sageutils.log('Omicron', "incoming TCP");
	} else {
		sageutils.log('Omicron', "incoming UDP");
	}
	*/
	var offset = 0;
	var e = {};
	if (offset < msg.length) {
		e.timestamp = msg.readUInt32LE(offset); offset += 4;
	}
	if (offset < msg.length) {
		e.sourceId = msg.readUInt32LE(offset); offset += 4;
	}
	if (offset < msg.length) {
		e.serviceId = msg.readInt32LE(offset); offset += 4;
	}
	if (offset < msg.length) {
		e.serviceType = msg.readUInt32LE(offset); offset += 4;
	}
	if (offset < msg.length) {
		e.type = msg.readUInt32LE(offset); offset += 4;
	}
	if (offset < msg.length) {
		e.flags = msg.readUInt32LE(offset); offset += 4;
	}
	if (offset < msg.length) {
		e.posx = msg.readFloatLE(offset); offset += 4;
	}
	if (offset < msg.length) {
		e.posy = msg.readFloatLE(offset); offset += 4;
	}
	if (offset < msg.length) {
		e.posz = msg.readFloatLE(offset); offset += 4;
	}
	if (offset < msg.length) {
		e.orw  = msg.readFloatLE(offset); offset += 4;
	}
	if (offset < msg.length) {
		e.orx  = msg.readFloatLE(offset); offset += 4;
	}
	if (offset < msg.length) {
		e.ory  = msg.readFloatLE(offset); offset += 4;
	}
	if (offset < msg.length) {
		e.orz  = msg.readFloatLE(offset); offset += 4;
	}
	if (offset < msg.length) {
		e.extraDataType  = msg.readUInt32LE(offset); offset += 4;
	}
	if (offset < msg.length) {
		e.extraDataItems = msg.readUInt32LE(offset); offset += 4;
	}
	if (offset < msg.length) {
		e.extraDataMask  = msg.readUInt32LE(offset); offset += 4;
	}
	// Extra data types:
	//    0 ExtraDataNull,
	//    1 ExtraDataFloatArray,
	//    2 ExtraDataIntArray,
	//    3 ExtraDataVector3Array,
	//    4 ExtraDataString,
	//    5 ExtraDataKinectSpeech
	if (e.extraDataType == 0) {
		e.extraDataSize = 0;
	} else if (e.extraDataType == 1 || e.extraDataType == 2) {
		e.extraDataSize = e.extraDataItems * 4;
	} else if (e.extraDataType == 3) {
		e.extraDataSize = e.extraDataItems * 4 * 3;
	} else if (e.extraDataType == 4) {
		e.extraDataSize = e.extraDataItems;
	} else if (e.extraDataType == 5) {
		e.extraDataSize = e.extraDataItems;
	}

	// var r_roll  = Math.asin(2.0*e.orx*e.ory + 2.0*e.orz*e.orw);
	// var r_yaw   = Math.atan2(2.0*e.ory*e.orw-2.0*e.orx*e.orz , 1.0 - 2.0*e.ory*e.ory - 2.0*e.orz*e.orz);
	// var r_pitch = Math.atan2(2.0*e.orx*e.orw-2.0*e.ory*e.orz , 1.0 - 2.0*e.orx*e.orx - 2.0*e.orz*e.orz);
	var posX = e.posx * omicronManager.totalWidth;
	var posY = e.posy * omicronManager.totalHeight;
	posX += omicronManager.touchOffset[0];
	posY += omicronManager.touchOffset[1];

	var sourceID = e.sourceId;

	var time = new Date();
	// var timeStr = time.getHours() + ":" + time.getMinutes() + ":" + time.getSeconds() + "." + time.getMilliseconds();

	omicronManager.updateEventTimer += time - omicronManager.lastEventTime;
	omicronManager.lastEventTime = time;

	// serviceType:
	// 0 = Pointer
	// 1 = Mocap
	// 2 = Keyboard
	// 3 = Controller
	// 4 = UI
	// 5 = Generic
	// 6 = Brain
	// 7 = Wand
	// 8 = Speech
	// 9 = Ipad Framework
	var serviceType = e.serviceType;
	// console.log("Event service type: " + serviceType);

	// console.log(e.sourceId, e.posx, e.posy, e.posz);
	// serviceID:
	// (Note: this depends on the order the services are specified on the server)
	// 0 = Touch
	// 1 = Classic SAGEPointer
	// var serviceID = e.serviceId;

	// Appending sourceID to pointer address ID
	var address = sourceID;
	if (rinfo !== undefined) {
		address = rinfo.address + ":" + sourceID;
	} else {
		address = omicronManager.config.inputServerIP + ":" + sourceID;
	}

	// ServiceTypePointer
	//
	if (serviceType === 0 && omicronManager.enableTouch) {
		omicronManager.processPointerEvent(e, sourceID, posX, posY, msg, offset, address);
	} else if (serviceType === 1 && omicronManager.enableMocap) {

		// Kinect v2.0 data has 29 extra data fields
		if (this.kinectInput != undefined && e.extraDataItems == 29) {
			if (omicronManager.eventDebug) {
				sageutils.log('Omicron', "Kinect body " + sourceID +
					" head Pos: (" + e.posx + ", " + e.posy + "," + e.posz + ")");
			}

			var extraData = [];

			while (offset < msg.length) {
				extraData.push(msg.readFloatLE(offset));
				offset += 4;
			}

			var bodyParts = [
				"OMICRON_SKEL_HIP_CENTER",
				"OMICRON_SKEL_HEAD",
				"Junk",
				"Junk",
				"Junk",
				"Junk",
				"OMICRON_SKEL_LEFT_SHOULDER",
				"OMICRON_SKEL_LEFT_ELBOW",
				"OMICRON_SKEL_LEFT_WRIST",
				"OMICRON_SKEL_LEFT_HAND",
				"OMICRON_SKEL_LEFT_FINGERTIP",
				"OMICRON_SKEL_LEFT_HIP",
				"OMICRON_SKEL_LEFT_KNEE",
				"OMICRON_SKEL_LEFT_ANKLE",
				"OMICRON_SKEL_LEFT_FOOT",
				"Junk",
				"OMICRON_SKEL_RIGHT_SHOULDER",
				"OMICRON_SKEL_RIGHT_ELBOW",
				"OMICRON_SKEL_RIGHT_WRIST",
				"OMICRON_SKEL_RIGHT_HAND",
				"OMICRON_SKEL_RIGHT_FINGERTIP",
				"OMICRON_SKEL_RIGHT_HIP",
				"OMICRON_SKEL_RIGHT_KNEE",
				"OMICRON_SKEL_RIGHT_ANKLE",
				"OMICRON_SKEL_RIGHT_FOOT",
				"OMICRON_SKEL_SPINE",
				"OMICRON_SKEL_SHOULDER_CENTER",
				"OMICRON_SKEL_LEFT_THUMB",
				"OMICRON_SKEL_RIGHT_THUMB"
			];

			var bodyPartIndex = 0;
			var posIndex = 0;
			var skeletonData = {};
			while (bodyPartIndex < bodyParts.length) {
				const bodyPart = bodyParts[bodyPartIndex++];
				skeletonData[bodyPart] = {
					x: extraData[posIndex++],
					y: extraData[posIndex++],
					z: extraData[posIndex++]
				};
			}

			skeletonData.skeletonID = sourceID;
			skeletonData.type = "kinectInput";

			this.kinectInput(sourceID, skeletonData);
		} else {
			// Treat as single marker mocap
			if (omicronManager.eventDebug) {
				sageutils.log('Omicron', "MocapID " + sourceID +
					" (" + e.posx + ", " + e.posy + "," + e.posz + ")");
			}
		}
	} else if (serviceType === 7 && omicronManager.enableWand) {
		// ServiceTypeWand
		//
		// Wand Button Flags
		// var button1 = 1;
		var button2 = 2; // Circle
		var button3 = 4; // Cross
		// var specialButton1 = 8;
		// var specialButton2 = 16;
		// var specialButton3 = 32;
		// var button4 = 64;
		var button5 = 128; // L1
		var button6 = 256; // L3
		var button7 = 512; // L2
		var buttonUp = 1024;
		var buttonDown = 2048;
		var buttonLeft = 4096;
		var buttonRight = 8192;
		// var button8 = 32768;
		// var button9 = 65536;

		// Wand SAGE2 command mapping
		var clickDragButton = button3;
		var menuButton      = button2;
		var showHideButton  = button5;
		var scaleUpButton   = buttonUp;
		var scaleDownButton = buttonDown;
		var maximizeButton  = buttonRight;
		var previousButton  = buttonLeft;
		var nextButton      = buttonRight;
		var playButton      = buttonRight;
		var movePointerHold	= button7;
		var pointerModeButton	= button6;

		var wandID = sourceID;
		var updateWandPosition = (e.flags & movePointerHold) === movePointerHold;

		var wandName = omicronManager.wandNames[wandID] === undefined ?
			omicronManager.wandLabel + " " + sourceID : omicronManager.wandNames[wandID].label;
		var wandColor = omicronManager.wandNames[wandID] === undefined ?
			omicronManager.wandColor : omicronManager.wandNames[wandID].color;

		if (omicronManager.wandState[wandID] === undefined) {
			sageutils.log('Omicron', "New Wand Pointer id" + sourceID + " (" + wandName + ")");
			omicronManager.createSagePointer(wandID);

			omicronManager.wandState[wandID] = { visible: false, buttonState: 0, mode: omicronManager.defaultWandMode };

			if (omicronManager.wandState[wandID].visible === true) {
				omicronManager.showPointer(wandID, {
					label: wandName, color: wandColor
				});
			}
		}

		var screenPos = omicronManager.coordCalculator.wandToWallScreenCoordinates(
			e.posx, e.posy, e.posz, e.orx, e.ory, e.orz, e.orw
		);

		var timeSinceLastNonCritEvent = Date.now() - omicronManager.lastNonCritEventTime;
		var lastButtonState = omicronManager.wandState[wandID].buttonState;

		// Show/Hide Pointer
		if ((e.flags & showHideButton) === showHideButton &&
			(lastButtonState & showHideButton) === 0) {

			if (omicronManager.wandState[wandID].visible === true) {
				omicronManager.hidePointer(wandID);
				omicronManager.wandState[wandID].visible = false;
			} else {
				omicronManager.showPointer(wandID, {
					label: wandName, color: wandColor
				});
				omicronManager.wandState[wandID].visible = true;

				// Set initial wand position
				updateWandPosition = true;
			}
		}

		// Toggle pointer mode
		if ((e.flags & pointerModeButton) === pointerModeButton &&
			(lastButtonState & pointerModeButton) === 0) {

			omicronManager.pointerChangeMode(wandID);
			if (omicronManager.wandState[wandID].mode === "window") {
				omicronManager.wandState[wandID].mode = "app";
			} else {
				omicronManager.wandState[wandID].mode = "window";
			}
		}

		if (updateWandPosition) {
			if (screenPos.x !== -1 && screenPos.y !== -1) {
				var timestamp = e.timestamp / 1000;
				posX = screenPos.x;
				posY = screenPos.y;

				// 1euro filter
				posX = omicronManager.wandXFilter.filter(screenPos.x, timestamp);
				posY = omicronManager.wandYFilter.filter(screenPos.y, timestamp);

				posX *= omicronManager.totalWidth;
				posY *= omicronManager.totalHeight;

				omicronManager.lastPosX = posX;
				omicronManager.lastPosY = posY;

				//omicronManager.pointerPosition(wandID, { pointerX: posX, pointerY: posY });
			} else {
				posX = omicronManager.lastPosX;
				posY = omicronManager.lastPosY;
			}

			if (timeSinceLastNonCritEvent >= omicronManager.nonCriticalEventDelay) {
				omicronManager.pointerPosition(wandID, { pointerX: posX, pointerY: posY });
				omicronManager.lastNonCritEventTime = Date.now();
			}

			omicronManager.wandState[wandID].posX = posX;
			omicronManager.wandState[wandID].posY = posY;
		} else {
			// If pointer not moving, use last pointer position, instead of current wand position
			if (omicronManager.wandState[wandID].posX !== undefined) {
				posX = omicronManager.wandState[wandID].posX;
				posY = omicronManager.wandState[wandID].posY;
			}
		}

		// Select / Left Click
		if ((e.flags & clickDragButton) === clickDragButton &&
			(lastButtonState & clickDragButton) === 0) {

			omicronManager.pointerPress(wandID, posX, posY, { button: "left" });
		} else if ((e.flags & clickDragButton) === clickDragButton &&
			(lastButtonState & clickDragButton) === clickDragButton) {

			// Left Drag
			if (timeSinceLastNonCritEvent >= omicronManager.nonCriticalEventDelay) {
				omicronManager.pointerMove(wandID, posX, posY, { deltaX: 0, deltaY: 0, button: "left" });
				omicronManager.lastNonCritEventTime = Date.now();
			}
		} else if ((e.flags & clickDragButton) === 0 &&
			(lastButtonState & clickDragButton) === clickDragButton) {

			// Left Release
			omicronManager.pointerRelease(wandID, posX, posY, { button: "left" });
		}

		// Menu / Right Click
		if ((e.flags & menuButton) === menuButton &&
			(lastButtonState & menuButton) === 0) {

			omicronManager.pointerPress(wandID, posX, posY, { button: "right" });
		} else if ((e.flags & menuButton) === 0 &&
			(lastButtonState & menuButton) === menuButton) {

			omicronManager.pointerRelease(wandID, posX, posY, { button: "right" });
		}

		// Wand in application interaction mode --------------------------------------------
		if (omicronManager.wandState[wandID].mode === "app") {
			// Play / P
			if ((e.flags & playButton) === playButton &&
				(lastButtonState & playButton) === 0) {

				omicronManager.keyDown(wandID, posX, posY, { code: 80 });
			} else if ((e.flags & playButton) === 0 &&
				(lastButtonState & playButton) === playButton) {

				omicronManager.keyUp(wandID, posX, posY, { code: 80 });
			}

			// Previous / Left Arrow
			if ((e.flags & previousButton) === previousButton &&
				(lastButtonState & previousButton) === 0) {

				omicronManager.keyDown(wandID, posX, posY, { code: 37 });
			} else if ((e.flags & previousButton) === 0 &&
				(lastButtonState & previousButton) === previousButton) {

				omicronManager.keyUp(wandID, posX, posY, { code: 37 });
			}

			// Next  / Right Arrow
			if ((e.flags & nextButton) === nextButton &&
				(lastButtonState & nextButton) === 0) {

				omicronManager.keyDown(wandID, posX, posY, { code: 39 });
			} else if ((e.flags & nextButton) === 0 &&
				(lastButtonState & nextButton) === nextButton) {

				omicronManager.keyUp(wandID, posX, posY, { code: 39 });
			}

			// Up Arrow
			if ((e.flags & scaleUpButton) === scaleUpButton &&
				(lastButtonState & scaleUpButton) === 0) {

				omicronManager.keyDown(wandID, posX, posY, { code: 38 });
			} else if ((e.flags & scaleUpButton) === 0 &&
				(lastButtonState & scaleUpButton) === scaleUpButton) {

				omicronManager.keyUp(wandID, posX, posY, { code: 38 });
			} else if ((e.flags & scaleUpButton) === scaleUpButton &&
				(lastButtonState & scaleUpButton) === scaleUpButton) {

				// On button hold (Scrolling Webviews)
				omicronManager.keyDown(wandID, posX, posY, { code: 38 });
			}

			// Down Arrow
			if ((e.flags & scaleDownButton) === scaleDownButton &&
				(lastButtonState & scaleDownButton) === 0) {

				omicronManager.keyDown(wandID, posX, posY, { code: 40 });
			} else if ((e.flags & scaleDownButton) === 0 &&
				(lastButtonState & scaleDownButton) === scaleDownButton) {

				omicronManager.keyUp(wandID, posX, posY, { code: 40 });
			} else if ((e.flags & scaleDownButton) === scaleDownButton &&
				(lastButtonState & scaleDownButton) === scaleDownButton) {

				// On button hold (Scrolling Webviews)
				omicronManager.keyDown(wandID, posX, posY, { code: 40 });
			}

		} else {
			// Wand in window manipulation mode -------------------------------------------
			// Left Arrow
			if ((e.flags & previousButton) === previousButton &&
				(lastButtonState & previousButton) === 0) {
				// Send to back?

			} else if ((e.flags & previousButton) === 0 &&
				(lastButtonState & previousButton) === previousButton) {
				// Not used
			}

			// Right Arrow / Maximize
			if ((e.flags & maximizeButton) === maximizeButton &&
				(lastButtonState & maximizeButton) === 0) {

				omicronManager.pointerDblClick(wandID, posX, posY);
			} else if ((e.flags & maximizeButton) === 0 &&
				(lastButtonState & maximizeButton) === maximizeButton) {
				// Not used
			}

			// Up Arrow / Scale Window
			if ((e.flags & scaleUpButton) === scaleUpButton &&
				(lastButtonState & scaleUpButton) === 0) {

				omicronManager.pointerScrollStart(wandID, posX, posY);
				omicronManager.pointerScroll(wandID, {
					wheelDelta: -0.1 * omicronManager.touchZoomScale });
			} else if ((e.flags & scaleUpButton) === 0 &&
				(lastButtonState & scaleUpButton) === scaleUpButton) {
				omicronManager.pointerScrollEnd(wandID, posX, posY);
			}

			// Down Arrow / Scale Window
			if ((e.flags & scaleDownButton) === scaleDownButton &&
				(lastButtonState & scaleDownButton) === 0) {

				omicronManager.pointerScrollStart(wandID, posX, posY);
				omicronManager.pointerScroll(wandID, {
					wheelDelta: 0.1 * omicronManager.touchZoomScale });
			} else if ((e.flags & scaleDownButton) === 0 &&
				(lastButtonState & scaleDownButton) === scaleDownButton) {

				omicronManager.pointerScrollEnd(wandID, posX, posY);
			}
		}


		// Update button state
		omicronManager.wandState[wandID].buttonState = e.flags;
	} // ServiceTypeWand ends ///////////////////////////////////////////
};

/**
 * Manages pointer (serviceType = 0) type events
 *
 * @method processPointerEvent
 * @param e {Event} Omicron event
 * @param sourceID {Integer} Pointer ID
 * @param posX {Float} Pointer x position in screen coordinates
 * @param posY {Float} Pointer y position in screen coordinates
 * @param msg {Binary} Binary message. Used to get extraData values
 * @param offset {Integer} Current offset position of msg
 */
OmicronManager.prototype.processPointerEvent = function(e, sourceID, posX, posY, msg, offset, address) {
	// TouchGestureManager Flags:
	// 1 << 18 = User flag start (as of 8/3/14)
	// User << 1 = Unprocessed
	// User << 2 = Single touch
	// User << 3 = Big touch
	// User << 4 = 5-finger hold
	// User << 5 = 5-finger swipe
	// User << 6 = 3-finger hold
	var User = 1 << 18;

	var FLAG_SINGLE_TOUCH = User << 2;
	var FLAG_BIG_TOUCH = User << 3;
	var FLAG_FIVE_FINGER_HOLD = User << 4;
	var FLAG_FIVE_FINGER_SWIPE = User << 5;
	var FLAG_THREE_FINGER_HOLD = User << 6;
	var FLAG_SINGLE_CLICK = User << 7;
	var FLAG_DOUBLE_CLICK = User << 8;
	var FLAG_MULTI_TOUCH = User << 9;
	var FLAG_ZOOM = User << 10;

	var flagStrings = {};
	flagStrings[FLAG_SINGLE_TOUCH] = "FLAG_SINGLE_TOUCH";
	flagStrings[FLAG_BIG_TOUCH] = "FLAG_BIG_TOUCH";
	flagStrings[FLAG_FIVE_FINGER_HOLD] = "FLAG_FIVE_FINGER_HOLD";
	flagStrings[FLAG_FIVE_FINGER_SWIPE] = "FLAG_FIVE_FINGER_SWIPE";
	flagStrings[FLAG_THREE_FINGER_HOLD] = "FLAG_THREE_FINGER_HOLD";
	flagStrings[FLAG_SINGLE_CLICK] = "FLAG_SINGLE_CLICK";
	flagStrings[FLAG_DOUBLE_CLICK] = "FLAG_DOUBLE_CLICK";
	flagStrings[FLAG_MULTI_TOUCH] = "FLAG_MULTI_TOUCH";
	flagStrings[FLAG_ZOOM] = "FLAG_ZOOM";

	var typeStrings = {};
	typeStrings[0] = "Select";
	typeStrings[1] = "Toggle";
	typeStrings[2] = "ChangeValue";
	typeStrings[3] = "Update";
	typeStrings[4] = "Move";
	typeStrings[5] = "Down";
	typeStrings[6] = "Up";
	typeStrings[7] = "Trace/Connect";
	typeStrings[8] = "Untrace/Disconnect";
	typeStrings[9] = "Click";
	typeStrings[15] = "Zoom";
	typeStrings[18] = "Split";
	typeStrings[21] = "Rotate";

	var touchWidth  = 0;
	var touchHeight = 0;

	var extraDataFloats = {};


	if (e.extraDataItems >= 2) {
		extraDataFloats[0] = msg.readFloatLE(offset); offset += 4;
		extraDataFloats[1] = msg.readFloatLE(offset); offset += 4;
	}
	if (e.extraDataItems >= 4) {
		extraDataFloats[2] = msg.readFloatLE(offset); offset += 4;
		extraDataFloats[3] = msg.readFloatLE(offset); offset += 4;
	}
	if (e.extraDataItems >= 5) {
		extraDataFloats[4] = msg.readFloatLE(offset); offset += 4;
	}
	if (e.extraDataItems >= 6) {
		extraDataFloats[5] = msg.readFloatLE(offset); offset += 4;
	}

	touchWidth = extraDataFloats[0];
	touchHeight = extraDataFloats[1];

	// the touch size is normalized
	touchWidth *=  omicronManager.totalWidth;
	touchHeight *= omicronManager.totalHeight;

	if (drawingManager.drawingMode && e.type !== 6) {
		// If the touch is coming from oinput send it to node-drawing and stop after that
		// If touch up, still send to SAGE to clear touch
		drawingManager.pointerEvent(e, sourceID, posX, posY, touchWidth, touchHeight);
		return;
	}

	// If the user touches on the palette with drawing disabled, enable it
	if ((!drawingManager.drawingMode) && drawingManager.touchInsidePalette(posX, posY)
		&& e.type === 5) {
		// drawingManager.reEnableDrawingMode();
	}

	if (!omicronManager.enableGestures || e.flags === 0) {
		return;
	}

	omicronManager.touchList.set(address, {
		pointerX: posX, pointerY: posY, timestamp: omicronManager.curTime, address: address
	});

	var initX = 0;
	var initY = 0;

	var distance = 0;

	var touchGroupSize = 0;
	var touchGroupChildrenIDs = new Map();
	var secondaryEventFlag = -1;

	var centerX = e.orw * omicronManager.totalWidth;
	var centerY = e.orx * omicronManager.totalHeight;
	centerX += omicronManager.touchOffset[0];
	centerY += omicronManager.touchOffset[1];

	// var groupDiameter = e.ory;
	// var groupLongRangeDiameter = e.orz;

	// Set pointer mode
	var mode = "Window";
	if (omicronManager.config.interactionMode !== undefined) {
		mode = omicronManager.config.interactionMode;
	}

	if (omicronManager.pointerState[sourceID] === undefined) {
		omicronManager.pointerState[sourceID] = {gesture: "", mode: mode, zoomTriggered: false};
	}

	// As of 2018/7/3 all touch gesture events touch have an init value
	// (zoomDelta moved to extraData index 4 instead of 2)
	// ExtraDataFloats
	// [0] width
	// [1] height
	// [2] initX
	// [3] initY
	// [4] Secondary event flag
	// [5] touch count in group (or zoomDelta)
	// [c] id of touch n
	// [c+1] xPos of touch n
	// [c+2] yPos of touch n
	if (e.extraDataItems >= 4) {
		initX = extraDataFloats[2];
		initY = extraDataFloats[3];

		initX *= omicronManager.totalWidth;
		initY *= omicronManager.totalHeight;

		initX += omicronManager.touchOffset[0];
		initY += omicronManager.touchOffset[1];

		if (e.extraDataItems >= 5) {
			secondaryEventFlag = extraDataFloats[4];
		}

		if (e.extraDataItems >= 6 && e.flags !== FLAG_ZOOM) {
			touchGroupSize = extraDataFloats[5];

			for (var i = 0; i < touchGroupSize; i++) {
				var subTouchID = msg.readFloatLE(offset); offset += 4;
				var subTouchPosX = msg.readFloatLE(offset); offset += 4;
				var subTouchPosY = msg.readFloatLE(offset); offset += 4;

				subTouchPosX = subTouchPosX * omicronManager.totalWidth;
				subTouchPosY = subTouchPosY * omicronManager.totalHeight;
				subTouchPosX += omicronManager.touchOffset[0];
				subTouchPosY += omicronManager.touchOffset[1];

				touchGroupChildrenIDs.set(subTouchID, { pointerX: subTouchPosX, pointerY: subTouchPosY });
			}
		} else if (e.extraDataItems >= 6) {
			touchGroupSize = extraDataFloats[5];
		}
	} else {
		initX = posX;
		initY = posY;
	}

	if (e.type === 5) { // EventType: DOWN
		// Create the pointer
		omicronManager.createSagePointer(address);

		// Set the pointer style
		var pointerStyle = "Touch";
		if (omicronManager.config.style !== undefined) {
			pointerStyle = omicronManager.config.style;
		}
		omicronManager.showPointer(address, {
			label:  "Touch: " + sourceID,
			color: "rgba(242, 182, 15, 1.0)",
			sourceType: pointerStyle
		});

		if (mode === "App") {
			omicronManager.pointerChangeMode(address);
		}

		// Set the initial pointer position
		omicronManager.pointerPosition(address, { pointerX: posX, pointerY: posY, sourceType: "touch" });

		// Send 'click' event
		if (e.flags === FLAG_SINGLE_TOUCH) {
			omicronManager.pointerPress(address, posX, posY, { button: "left", sourceType: "touch" });
			if (omicronManager.gestureDebug) {
				console.log("Pointer click - ID: " + sourceID);
			}
		}
		// Send 'double click' event
		if (e.flags === FLAG_DOUBLE_CLICK) {
			if (this.enableDoubleClickMaximize === true) {
				omicronManager.pointerDblClick(address, posX, posY, { sourceType: "touch" });
			}
			if (omicronManager.gestureDebug) {
				console.log("Pointer double click - ID: " + sourceID);
			}
		}
	} else if (e.type === 4) { // EventType: MOVE
		if (mode === "Window") {
			// Exaggerate window drag movement
			var angle = Math.atan2(posY - initY, posX - initX);
			distance = Math.sqrt(Math.pow(Math.abs(posX - initX), 2) + Math.pow(Math.abs(posY - initY), 2));
			distance *= omicronManager.acceleratedDragScale;
			posX = posX + distance * Math.cos(angle);
			posY = posY + distance * Math.sin(angle);
		}

		// Only window drag if not zooming
		if (omicronManager.pointerState[sourceID].zoomTriggered === false) {
			omicronManager.pointerPosition(address, { pointerX: posX, pointerY: posY, sourceType: "touch" });
		}
	} else if (e.type === 6) { // EventType: UP
		// Send 'big touch' event
		if (e.flags === FLAG_BIG_TOUCH ||
			touchWidth > omicronManager.bigTouchMinSize ||
			touchHeight > omicronManager.bigTouchMinSize) {

			if (this.enableBigTouchPushToBack === true) {
				omicronManager.pointerSendToBack(address, posX, posY, { sourceType: "touch" });
			}
			if (omicronManager.gestureDebug) {
				console.log("Pointer big touch - ID: " + sourceID);
			}
		}

		// Hide pointer
		omicronManager.hidePointer(address);

		// Release event
		omicronManager.pointerRelease(address, posX, posY, { sourceType: "touch", button: "left" });

		omicronManager.touchList.delete(address);
	} else if (e.type === 15) { // zoom
		var zoomDelta =  extraDataFloats[5];

		if (omicronManager.enableTwoFingerZoom) {
			// Omicron zoom event extra data:
			// 0 = touchWidth (parsed above)
			// 1 = touchHeight (parsed above)
			// 2 = initX (parsed above)
			// 3 = initY (parsed above)
			// 4 = event second type ( parsed above: 1 = Down, 2 = Move, 3 = Up )
			// 5 = zoom delta
			if (secondaryEventFlag === 1) {
				if (omicronManager.gestureDebug) {
					console.log("Touch zoom start - ID: " + sourceID + " " + centerX + ", " + centerY);
				}
				omicronManager.pointerScrollStart(address, centerX, centerY, { sourceType: "touch" });
				omicronManager.pointerState[sourceID].zoomTriggered = true;
			} else if (secondaryEventFlag === 2) {
				if (omicronManager.gestureDebug) {
					console.log("Touch zoom move - ID: " + sourceID + " " + zoomDelta);
				}
				// Zoom gesture
				var wheelDelta = -zoomDelta * omicronManager.touchZoomScale;
				omicronManager.pointerScroll(address, { wheelDelta: wheelDelta, sourceType: "touch" });
			} else {
				// End zoom gesture
				omicronManager.pointerScrollEnd(address, centerX, centerY, { sourceType: "touch" });
				omicronManager.pointerRelease(address, centerX, centerY, { button: "left", sourceType: "touch" });
			}
		}
	}

	/*
	if (e.type === 4) { // EventType: MOVE

		if (omicronManager.gestureDebug) {
			sageutils.log('Omicron', "Touch " + sourceID + " move at - (" +
			posX.toFixed(2) + "," + posY.toFixed(2) + ") initPos: ("
			+ initX.toFixed(2) + "," + initY.toFixed(2) + ")");
		}

		if (omicronManager.pointerState[sourceID].gesture == "move" || mode == "Window") {
			var angle = Math.atan2(posY - initY, posX - initX);
			distance = Math.sqrt(Math.pow(Math.abs(posX - initX), 2) + Math.pow(Math.abs(posY - initY), 2));
			distance *= omicronManager.acceleratedDragScale;
			posX = posX + distance * Math.cos(angle);
			posY = posY + distance * Math.sin(angle);

			omicronManager.moveEventCounter++;

			if (omicronManager.moveEventCounter > omicronManager.moveEventLimit) {
				omicronManager.pointerMove(address, posX, posY, { deltaX: 0, deltaY: 0, button: "left" });
				omicronManager.moveEventCounter = 0;
			}
		}

		omicronManager.touchList.set(address, {
			pointerX: posX, pointerY: posY, timestamp: omicronManager.curTime, address: address
		});

		// Update pointer position
		if (touchGroupSize > 1) {
			omicronManager.pointerState[sourceID].zoomTriggered = true;
		}

		if (omicronManager.pointerState[sourceID].zoomTriggered === false) {
			omicronManager.pointerPosition(address, { pointerX: posX, pointerY: posY });
		}

		if (e.flags === FLAG_MULTI_TOUCH || e.flags === FLAG_SINGLE_TOUCH) {
			// Get previous touchgroup list
			var lastTouchGroupPoints = omicronManager.touchGroups.get(sourceID);
			if (lastTouchGroupPoints !== undefined) {
				for (var childID of lastTouchGroupPoints.keys()) {
					if (touchGroupChildrenIDs.has(childID) === false) {
						sageutils.log('Omicron', "TouchGroup ", sourceID, " has removed touch id ", childID);

						omicronManager.hidePointer(address + "_" + childID);
						omicronManager.touchList.delete(address + "_" + childID);
					}
				}
				for (childID of touchGroupChildrenIDs.keys()) {
					if (childID === sourceID) {
						continue;
					}
					var childX = touchGroupChildrenIDs.get(childID).pointerX;
					var childY = touchGroupChildrenIDs.get(childID).pointerY;

					if (lastTouchGroupPoints.has(childID) === false) {
						omicronManager.touchList.set(address + "_" + childID, {
							pointerX: childX, pointerY: childY, timestamp: omicronManager.curTime, id: childID, childID: true
						});

						// Create the pointer
						omicronManager.createSagePointer(address + "_" + childID);

						// Set the pointer style
						var pointerStyle = "Touch";
						if (omicronManager.config.style !== undefined) {
							pointerStyle = omicronManager.config.style;
						}
						omicronManager.showPointer(address + "_" + childID, {
							label:  "Touch: " + address + "_" + childID,
							color: "rgba(122, 92, 6, 1.0)",
							sourceType: pointerStyle
						});

						// Set the initial pointer position
						omicronManager.pointerPosition(address + "_" + childID, { pointerX: childX, pointerY: childY });
					} else {
						omicronManager.pointerPosition(address + "_" + childID, { pointerX: childX, pointerY: childY });
						omicronManager.touchList.set(address + "_" + childID, {
							pointerX: childX, pointerY: childY, timestamp: omicronManager.curTime, id: childID, childID: true
						});
					}
				}
				omicronManager.touchGroups.set(sourceID, touchGroupChildrenIDs);
			}
		}

	} else if (e.type === 5) { // EventType: DOWN
		omicronManager.touchList.set(address, {
			pointerX: posX, pointerY: posY, timestamp: omicronManager.curTime, id: sourceID,
			initX: initX, initY: initY
		});

		if (omicronManager.gestureDebug) {
			sageutils.log('Omicron',
				"Touch down at - (" + posX.toFixed(2) + "," + posY.toFixed(2) + ") initPos: ("
				+ initX.toFixed(2) + "," + initY.toFixed(2) + ") flags:" + e.flags);
		}

		// Create the pointer
		omicronManager.createSagePointer(address);

		// Set the pointer style
		pointerStyle = "Touch";
		if (omicronManager.config.style !== undefined) {
			pointerStyle = omicronManager.config.style;
		}
		omicronManager.showPointer(address, {
			label:  "Touch: " + sourceID,
			color: "rgba(242, 182, 15, 1.0)",
			sourceType: pointerStyle
		});

		if (mode === "App") {
			omicronManager.pointerChangeMode(address);
		}

		// Set the initial pointer position
		omicronManager.pointerPosition(address, { pointerX: posX, pointerY: posY });

		// Send 'click' event
		if (e.flags === FLAG_SINGLE_TOUCH) {
			omicronManager.pointerPress(address, posX, posY, { button: "left", sourceType: "touch" });
			if (omicronManager.gestureDebug) {
				console.log("Pointer click - ID: " + sourceID);
			}
		}

		// Set touchgroup child only if multi/single touch event (not gestures)
		if (e.flags === FLAG_MULTI_TOUCH || e.flags === FLAG_SINGLE_TOUCH) {
			omicronManager.touchGroups.set(sourceID, touchGroupChildrenIDs);
		}
	} else if (e.type === 6) { // EventType: UP
		omicronManager.touchList.delete(address);

		if (omicronManager.gestureDebug) {
			sageutils.log('Omicron', "Touch up at - (" + posX.toFixed(2) + "," + posY.toFixed(2) + ") initPos: ("
				+ initX.toFixed(2) + "," + initY.toFixed(2) + ") flags:" + e.flags);
		}

		// Hide pointer
		omicronManager.hidePointer(address);

		// Release event
		omicronManager.pointerRelease(address, posX, posY, { button: "left" });

		// Remove from touchgroup list only if multi/single touch event (not gestures)
		if (e.flags === FLAG_MULTI_TOUCH || e.flags === FLAG_SINGLE_TOUCH) {
			lastTouchGroupPoints = omicronManager.touchGroups.get(sourceID);
			if (lastTouchGroupPoints !== undefined) {
				for (childID of lastTouchGroupPoints.keys()) {
					omicronManager.hidePointer(address + "_" + childID);
					omicronManager.touchList.delete(address + "_" + childID);
				}
			}
			omicronManager.touchGroups.delete(sourceID);
		}
	} else if (e.type === 15) {
		// zoom
		if (omicronManager.enableTwoFingerZoom) {
			// Omicron zoom event extra data:
			// 0 = touchWidth (parsed above)
			// 1 = touchHeight (parsed above)
			// 2 = initX (parsed above)
			// 3 = initY (parsed above)
			// 4 = event second type ( parsed above: 1 = Down, 2 = Move, 3 = Up )
			// 5 = zoom delta

			// extraDataType 1 = float
			// console.log("Touch zoom " + e.extraDataType  + " " + e.extraDataItems );
			if (e.extraDataType === 1 && e.extraDataItems === 6) {
				var zoomDelta = msg.readFloatLE(offset); offset += 4;
				var eventType = secondaryEventFlag;

				// Zoom start/down
				if (eventType === 1) {
					if (omicronManager.gestureDebug) {
						console.log("Touch zoom start - ID: " + sourceID);
					}
					// Note: This disables zoom gestures for app interaction
					// and instead does window zoom
					if (mode === "App") {
						omicronManager.pointerChangeMode(address);
					}

					if (omicronManager.pointerState[sourceID].gesture !== "move") {
						omicronManager.pointerScrollStart(address, posX, posY);
						omicronManager.initZoomPos[sourceID] = {initX: posX, initY: posY};
						omicronManager.pointerState[sourceID].gesture = "zoom";
					}
				} else {
					if (omicronManager.initZoomPos[sourceID] !== undefined &&
						omicronManager.pointerState[sourceID].gesture === "zoom") {
						initX = omicronManager.initZoomPos[sourceID].initX;
						initY = omicronManager.initZoomPos[sourceID].initY;
					}

					distance = Math.sqrt(Math.pow(Math.abs(posX - initX), 2) + Math.pow(Math.abs(posY - initY), 2));

					// If two-finger move enabled and distance > minDistance, stop zooming and move
					if (omicronManager.enableTwoFingerWindowDrag && distance > omicronManager.zoomToMoveGestureMinimumDistance) {
						if (omicronManager.pointerState[sourceID].gesture === "zoom") {
							if (omicronManager.gestureDebug) {
								console.log("Touch zoom switched to 2-finger move - ID: " + address);
							}
							// End zoom gesture
							omicronManager.pointerScrollEnd(address, posX, posY);
							omicronManager.pointerRelease(address, posX, posY, { button: "left" });

							// Start drag gesture
							omicronManager.createSagePointer(address);
							omicronManager.pointerPress(address, posX, posY, { button: "left" });
							omicronManager.pointerState[sourceID].gesture = "move";
						}
					} else {
						// Zoom gesture
						var wheelDelta = -zoomDelta * omicronManager.touchZoomScale;
						omicronManager.pointerScroll(address, { wheelDelta: wheelDelta });
						// console.log("Touch zoom - ID: " + sourceID);
					}

					if (omicronManager.gestureDebug) {
						// console.log("Touch zoom at - (" + posX.toFixed(2) + "," + posY.toFixed(2) + ") initPos: ("
						// + initX.toFixed(2) + "," + initY.toFixed(2) + ")");
						// console.log("Touch zoom distance: " + distance);
						// console.log("Touch zoom state: " + omicronManager.pointerState[sourceID].gesture);
					}
				}
			}
		}
	} else {
		console.log("\t UNKNOWN event type ", e.type, typeStrings[e.type]);
	}
	*/
};

module.exports = OmicronManager;
