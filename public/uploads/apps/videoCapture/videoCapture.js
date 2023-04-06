//
// SAGE2 application: videoCapture
// by: Luc Renambot <renambot@gmail.com>
//
// Copyright (c) 2015-19
//

"use strict";

/* global  */

var videoCapture = SAGE2_App.extend({
	init: function(data) {
		// Create a video element into the DOM
		this.SAGE2Init("video", data);
		// Set the DOM id
		this.element.id = "vid_" + data.id;
		// Set the background to black
		this.element.style.backgroundColor = 'gray';

		// move and resize callbacks
		this.resizeEvents = "onfinish"; // onfinish continuous
		// this.moveEvents   = "continuous";

		// Keep a copy of the title string
		this.title = data.title;

		// SAGE2 Application Settings
		this.audioInputDevices  = [];
		this.audioOutputDevices = [];
		this.videoDevices = [];
		this.resolution   = "1920";

		// default settings on the video tag
		// this.element.controls = true;
		this.element.muted = false;

		// Transforms to zoom/flip video
		this.zoomLevel = 1;
		this.flip = "";
		this.flop = "";

		if (isMaster) {
			let _this = this;

			// video device selected
			this.videoID    = undefined;
			this.audioInID  = "none";
			this.audioOutID = "none";

			navigator.mediaDevices.enumerateDevices().then(function(deviceInfos) {
				for (var i = 0; i !== deviceInfos.length; ++i) {
					var deviceInfo = deviceInfos[i];
					if (deviceInfo.kind === 'audioinput') {
						let text = deviceInfo.label || 'microphone ' + i;
						_this.audioInputDevices.push({
							id: deviceInfo.deviceId,
							name: text
						});
					} else if (deviceInfo.kind === 'audiooutput') {
						let text = deviceInfo.label || 'speaker ' + i;
						_this.audioOutputDevices.push({
							id: deviceInfo.deviceId,
							name: text
						});
					} else if (deviceInfo.kind === 'videoinput') {
						_this.videoID = deviceInfo.deviceId;
						let text = deviceInfo.label || 'camera ' + i;
						_this.videoDevices.push({
							id: deviceInfo.deviceId,
							name: text
						});
					} else {
						console.log('videoCapture> Some other kind of source/device: ', deviceInfo);
					}
				}
				// rebuild the context menu (inluding the list of devices)
				_this.getFullContextMenuAndUpdate();
				// start
				_this.changeDevice({
					resolution: _this.resolution,
					video: {id: _this.videoID}
				});
			}).catch(function(err) {
				// handle the error
				console.log('videoCapture> Failed to enumerateDevices', err);
			});
		}
	},

	load: function(date) {
		this.refresh(date);
	},

	draw: function(date) {
		// Called when window is drawn
	},

	resize: function(date) {
		// Called when window is resized
		this.refresh(date);
	},

	move: function(date) {
		// Called when window is moved (set moveEvents to continuous)
		this.refresh(date);
	},

	quit: function() {
		this.stop();
	},

	stop: function() {
		// Make sure to delete stuff (timers, ...)
		let stream = this.element.srcObject;
		if (stream) {
			let tracks = stream.getTracks();
			tracks.forEach(function(track) {
				track.stop();
			});
			this.element.srcObject = null;
		}
	},

	/**
	 * Flip and flop the video
	 *
	 * @method     transformVideo
	 * @param      {Object}  responseObject  The response object
	 */
	transformVideo: function (responseObject) {
		if (responseObject.direction === "horizontal") {
			// this.element.style.transform += " scaleX(-1)";
			this.flip += "scaleX(-1)";
		} else if (responseObject.direction === "vertical") {
			// this.element.style.transform += " rotate(180deg) scaleX(-1)";
			this.flop += "rotate(180deg) scaleX(-1)";
		} else if (responseObject.zoom) {
			this.zoomLevel = parseFloat(responseObject.zoom);
		} else {
			this.flip = "";
			this.flop = "";
			this.zoomLevel = 1;
		}
		this.element.style.transform = this.flip + " " + this.flop + " " +
			"scale(" + this.zoomLevel + ")";
	},

	/**
	 * Select a new capture device
	 *
	 * @method     changeDevice
	 * @param      {Object}  responseObject  The response object
	 */
	changeDevice: function (responseObject) {
		var _this = this;

		if (responseObject.video) {
			this.videoID = responseObject.video.id;
		}
		if (responseObject.resolution) {
			this.resolution = responseObject.resolution;
		}
		if (responseObject.audio_in) {
			if (responseObject.audio_in === "none") {
				this.audioInID = "none";
			} else {
				this.audioInID = responseObject.audio_in.id;
			}
		}
		if (responseObject.audio_out) {
			if (responseObject.audio_out === "none") {
				this.audioOutID = "none";
			} else {
				this.audioOutID = responseObject.audio_out.id;
			}
		}

		// stop the existing stream, if any
		this.stop();

		// From the width, choose the height in 16/9 aspect ratio
		let w, h;
		if (this.resolution === "3840") {
			w = 3840;
			h = 2160;
		} else if (this.resolution === "1920") {
			w = 1920;
			h = 1080;
		} else if (this.resolution === "1280") {
			w = 1280;
			h =  720;
		} else if (this.resolution === "640") {
			w = 640;
			h = 360;
		}
		// building a constraint request
		let constraints = {
			audio: {deviceId: (this.audioInID !== "none") ? {exact: this.audioInID} : undefined},
			video: {
				deviceId:    { exact: this.videoID },
				width:       { ideal: w },
				height:      { ideal: h },
				frameRate:   { ideal: 30, min: 15, max: 60 },
				aspectRatio: { exact: 16 / 9 }
			}
		};

		navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
			var vtracks = stream.getVideoTracks();
			let label = "";
			for (var i = vtracks.length - 1; i >= 0; i--) {
				let trk = vtracks[i];
				label += trk.label;
				let videoConfig;
				try {
					let settings = trk.getSettings();
					videoConfig = settings.width + 'x' + settings.height + '@' + settings.frameRate;
					label += ' ' + videoConfig;
				} catch (e) {
					videoConfig = '';
				}
				console.log('videoCapture> V_Track', i, ":", trk.label, "-", trk.kind, trk.readyState, "-", videoConfig);
			}
			var atracks = stream.getAudioTracks();
			if (atracks && atracks[0]) {
				let trk = atracks[0];
				label += " + audio "  + trk.label;
				console.log('videoCapture> A_Track 0', ":", trk.label, "-", trk.kind, trk.readyState);
			}
			// Update the title of the window
			_this.updateTitle(_this.title + " - " + label);
			// Use the stream
			_this.element.srcObject = stream;
			// Play it into the video tag
			_this.element.onloadedmetadata = function(e) {
				_this.changeAudioOutput();
				_this.element.play();
			};
		}).catch(function(err) {
			// handle the error
			console.log('videoCapture> Failed to get a stream', err);
		});

	},

	changeAudioOutput: function() {
		let sinkId = this.audioOutID;
		if (sinkId !== "none") {
			this.element.muted = false;
			// set audio ouput
			if (typeof this.element.sinkId !== 'undefined') {
				this.element.setSinkId(sinkId).then(function() {
					console.log('videoCapture> Success, audio output device attached');
				}).catch(function(error) {
					var errorMessage = error;
					if (error.name === 'SecurityError') {
						errorMessage = 'videoCapture> You need to use HTTPS for selecting audio output ' +
						'device: ' + error;
					}
					console.error(errorMessage);
				});
			} else {
				console.warn('videoCapture> Browser does not support output device selection.');
			}
		} else {
			// mute the audio output
			this.element.muted = true;
		}
	},

	/**
	* To enable right click context menu support,
	* this function needs to be present with this format.
	*/
	getContextEntries: function() {
		var entries = [];
		var entry;

		for (var i = 0; i < this.videoDevices.length; i++) {
			entry = {};
			entry.description = "Device " + i + " : " + this.videoDevices[i].name;
			entry.callback = "changeDevice";
			entry.accelerator = i.toString();
			entry.parameters = {
				video: this.videoDevices[i]
			};
			entries.push(entry);
		}

		entry = {};
		entry.description = "separator";
		entries.push(entry);

		entry = {};
		entry.description = "Resolution: 4K (3840x2160)";
		entry.callback = "changeDevice";
		entry.parameters = {
			resolution: "3840"
		};
		entries.push(entry);

		entry = {};
		entry.description = "Resolution: HD (1920x1080)";
		entry.callback = "changeDevice";
		entry.parameters = {
			resolution: "1920"
		};
		entries.push(entry);

		entry = {};
		entry.description = "Resolution: HD720 (1280x720)";
		entry.callback = "changeDevice";
		entry.parameters = {
			resolution: "1280"
		};
		entries.push(entry);

		entry = {};
		entry.description = "Resolution: TV (640x360)";
		entry.callback = "changeDevice";
		entry.parameters = {
			resolution: "640"
		};
		entries.push(entry);

		// separator
		entries.push({description: "separator"});

		// Video transformations
		entry = {};
		entry.description = "Video Flip - Horizontal";
		entry.callback = "transformVideo";
		entry.parameters = {
			direction: "horizontal"
		};
		entries.push(entry);

		entry = {};
		entry.description = "Video Flip - Vertical";
		entry.callback = "transformVideo";
		entry.parameters = {
			direction: "vertical"
		};
		entries.push(entry);

		entry = {};
		entry.description = "Video Zoom - 2x";
		entry.callback = "transformVideo";
		entry.parameters = {
			zoom: "2.0"
		};
		entries.push(entry);

		entry = {};
		entry.description = "Video Zoom - 3x";
		entry.callback = "transformVideo";
		entry.parameters = {
			zoom: "3.0"
		};
		entries.push(entry);

		entry = {};
		entry.description = "Video Reset";
		entry.callback = "transformVideo";
		entry.parameters = {};
		entries.push(entry);

		// separator
		entries.push({description: "separator"});

		// Audio inputs
		entry = {};
		entry.description = "Audio Input";
		entry.children = [];
		entry.children.push({
			description: "None",
			callback: "changeDevice",
			parameters: { audio_in: "none" }
		});
		for (let i = 0; i < this.audioInputDevices.length; i++) {
			let ain = {};
			ain.description = "Device " + i + " : " + this.audioInputDevices[i].name;
			ain.callback = "changeDevice";
			ain.parameters = {
				audio_in: this.audioInputDevices[i]
			};
			entry.children.push(ain);
		}
		entries.push(entry);

		// Audio outputs
		entry = {};
		entry.description = "Audio Ouput";
		entry.children = [];
		entry.children.push({
			description: "None",
			callback: "changeDevice",
			parameters: { audio_out: "none" }
		});
		for (let i = 0; i < this.audioOutputDevices.length; i++) {
			let aout = {};
			aout.description = "Device " + i + " : " + this.audioOutputDevices[i].name;
			aout.callback = "changeDevice";
			aout.parameters = {
				audio_out: this.audioOutputDevices[i]
			};
			entry.children.push(aout);
		}
		entries.push(entry);

		// separator
		entries.push({description: "separator"});

		entry = {};
		entry.description = "Stop Capturing";
		entry.accelerator = "s";
		entry.callback    = "stop";
		entry.parameters  = {};
		entries.push(entry);

		return entries;
	},

	event: function(eventType, position, user_id, data, date) {
		if (eventType === "pointerPress" && (data.button === "left")) {
			// click
		} else if (eventType === "pointerMove" && this.dragging) {
			// move
		} else if (eventType === "pointerRelease" && (data.button === "left")) {
			// click release
		} else if (eventType === "pointerScroll") {
			// Scroll events for zoom
		} else if (eventType === "widgetEvent") {
			// widget events
		} else if (eventType === "keyboard") {
			if (data.character === "s") {
				this.stop();
				this.refresh(date);
			} else if (data.character === "0") {
				if (this.videoDevices[0]) {
					// select video device 0
					this.changeDevice({
						video: this.videoDevices[0]
					});
					this.refresh(date);
				}
			} else if (data.character === "1") {
				if (this.videoDevices[1]) {
					// select video device 1
					this.changeDevice({
						video: this.videoDevices[1]
					});
					this.refresh(date);
				}
			} else if (data.character === "2") {
				if (this.videoDevices[2]) {
					// select video device 2
					this.changeDevice({
						video: this.videoDevices[2]
					});
					this.refresh(date);
				}
			}
		} else if (eventType === "specialKey") {
			if (data.code === 37 && data.state === "down") {
				// left
				this.refresh(date);
			} else if (data.code === 38 && data.state === "down") {
				// up
				this.refresh(date);
			} else if (data.code === 39 && data.state === "down") {
				// right
				this.refresh(date);
			} else if (data.code === 40 && data.state === "down") {
				// down
				this.refresh(date);
			}
		}
	}
});
