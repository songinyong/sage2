// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014-19

"use strict";

/* global interactor  */

var SAGE2_webrtc_ui_tracker = {
	debug: false,

	enabled: true,
	stream: null, // Set after plugin gets screenshare stream
	allPeers: [],
	streamSuccess: function(stream) {
		SAGE2_webrtc_ui_tracker.debugprint("Success Got stream");
		SAGE2_webrtc_ui_tracker.stream = stream;
	},
	streamFail: function() {
		SAGE2_webrtc_ui_tracker.debugprint("Failed to get stream");
	},

	makePeer: function(dataFromDisplay) {
		// If there is no interactor (display) or settings have WebRTC enabled
		if (!interactor || interactor.mediaUseRTC) {
			this.allPeers.push(
				new SAGE2WebrtcPeerConnection(
					dataFromDisplay.appId, // Which app this is for
					interactor.uniqueID, // UI id for identifying streamerid
					dataFromDisplay.sourceId, // Goto specific display
					SAGE2_webrtc_ui_tracker.stream, // UI will send stream
					null, // No stream element on UI, display version fills this in (media_stream.js)
					dataFromDisplay.remoteDisplayServer) // Will not be undefined if app was remotely shared
			);
		}
	},

	debugprint: function(message) {
		if (SAGE2_webrtc_ui_tracker.debug) {
			console.log("SAGE2_webrtc> DEBUG> ", message);
		}
	}
};


// While written in the public/src folder, this can be accessed by media_stream (screen share app)
// stream is the UI stream of the screen captures
// streamElement is the element displaying the stream on the Display
class SAGE2WebrtcPeerConnection {
	constructor(appId, streamerId, displayId, stream = null,
		streamElement = null, goingToSourceServer = null) {
		// Enable debug printing
		this.debug = false;

		// Setup properties of the connection
		this.setupProperties(appId, streamerId, displayId);

		// Create handlers. Stream means UI, no stream is display
		if (stream) {
			this.setupUIHandlers(stream, goingToSourceServer);
		} else {
			this.setupDisplayHandlers(streamElement, goingToSourceServer);
		}
	}

	debugprint(message) {
		if (this.debug) {
			console.log("SAGE2_webrtc> DEBUG> " + message);
		}
	}

	setupProperties(appId, streamerId, displayId) {
		// For identification of clients
		// Actually id of sage2 app
		this.appId = appId;
		// unique clientId
		this.streamerId = streamerId;
		// unique displayId, identified by offer because SAGE2 doesn't distinguish displays
		// beyond which viewport they access
		this.displayId = displayId;
		// Used if screen share is passed to remote site
		this.remoteDisplayServer = null;

		// Webrtc
		this.offerOptions = {
			offerToReceiveVideo: 1,
			offerToReceiveAudio: 1
		};
		this.configForPeer = {
			iceServers: [{
				urls: [
					"stun:stun.l.google.com:19302",
					"stun:stun1.l.google.com:19302",
					"stun:stun2.l.google.com:19302",
					"stun:stun3.l.google.com:19302",
					"stun:stun4.l.google.com:19302",
					"stun:stun.ippi.fr:3478",
					"stun:stun.ucsb.edu:3478",
					"stun:stun.whoi.edu:3478"
				]
			}]
		};

		// a webkitRTCPeerConnection
		this.peer = new RTCPeerConnection(this.configForPeer);
		this.peer.oniceconnectionstatechange = (e) => {
			this.debugprint("ics state changed to " + this.peer.iceConnectionState);
		};

		// Standby data
		this.iceCandidatesReadyToSend = [];
		this.completedOfferAnswerResponse = false;
	}

	setupUIHandlers(stream, remoteDisplayServer = false) {
		this.remoteDisplayServer = remoteDisplayServer;

		this.debugprint("Setting up handlers for UI");
		// This is a UI sending a stream
		this.myId = this.streamerId;
		// On ice candidates
		this.peer.onicecandidate = (event) => {
			if (event.candidate) {
				this.debugprint("Got ice candidate");
				// Only if completed, then send
				if (this.completedOfferAnswerResponse) {
					this.sendMessage(JSON.stringify({ ice: event.candidate }));
				} else {
					// Otherwise store until ready to send
					this.iceCandidatesReadyToSend.push({ ice: event.candidate });
				}
			}
		};

		// Collect stream (screenshare) track and add it to the connection
		stream.getTracks().forEach((track) => {
			// Add track from stream
			this.peer.addTrack(track, stream);
		});

		// Create offer, after creating, send to display
		this.peer.createOffer((offer) => {
			this.debugprint("Offer created");
			this.peer.setLocalDescription(offer)
				.then(() => {
					this.sendMessage(JSON.stringify({ sdp: this.peer.localDescription }));
				});
		}, (error) => {
			console.log("SAGE2_webrtc> Error while creating offer");
		}, this.offerOptions);
	}

	setupDisplayHandlers(streamElement, useRemoteServerSending) {
		if (useRemoteServerSending) {
			this.forRemoteClient = true;
		}
		this.debugprint("Setting up handlers for Display");
		// This is a display
		this.myId = this.displayId;
		this.streamElement = streamElement;

		// Handler for ice candidates
		this.peer.onicecandidate = (event) => {
			if (event.candidate) {
				this.debugprint("Got ice candidate");
				// Only send if completed connection
				if (this.completedOfferAnswerResponse) {
					this.sendMessage(JSON.stringify({ ice: event.candidate }));
				} else {
					// Otherwise store until ready to send
					this.iceCandidatesReadyToSend.push({ ice: event.candidate });
				}
			}
		};

		/*
		Below are two handles for ontrack and onaddstream.
		Both are necessary while clients can be both Chrome and Electron.

		The older handler onaddstream is planned to be phased out. But Electron only handles onaddstream.
		Their beta (v3) seems to work with onaddstream, but until then, the following two functions are necessary.
		*/

		// Handler for tracks
		this.peer.ontrack = (event) => {
			this.debugprint("ontrack event");
			if (event.streams) {
				let track = event.streams[0];
				if (track.active && !this.streamElement.srcObject) {
					this.debugprint("using stream from ontrack");
					this.streamElement.srcObject = track;
				} else {
					console.log("SAGE2_webrtc> discarding ontrack stream received");
					if (!track.active) {
						console.log("SAGE2_webrtc> - Reason: track inactive");
					} else if (this.streamElement.srcObject) {
						console.log("SAGE2_webrtc> - Reason: streamElement already receiving");
					}
				}
			}
		};
		this.peer.onaddstream = (event) => {
			this.debugprint("onaddstream event");
			if (event.stream && event.stream.active && !this.streamElement.srcObject) {
				this.debugprint("using stream from onaddstream");
				this.streamElement.srcObject = event.stream;
			} else {
				console.log("SAGE2_webrtc> discarding onaddstream stream received");
				if (!event.stream) {
					console.log("SAGE2_webrtc> - Reason: No stream given");
				} else if (!event.stream.active) {
					console.log("SAGE2_webrtc> - Reason: stream inactive");
				} else if (this.streamElement.srcObject) {
					console.log("SAGE2_webrtc> - Reason: streamElement already receiving");
				}
			}
		};
	}

	// Sends to specific display, this.displayId
	sendMessage(message) {
		// Can't send without myId
		if (!this.myId) {
			this.debugprint("ERROR, sendMessage activated without one of the following: myId, streamerId, displayId");
			this.debugprint(this.myId);
			this.debugprint(this.streamerId);
			this.debugprint(this.displayId);
		}
		// If this is UI sending to Display
		if (this.displayId && (this.displayId !== this.myId)) {
			this.debugprint("Sending to display:" + message);
			// create data to send, then emit
			let data = {};
			data.app = this.appId;
			data.func = "webrtc_SignalMessageFromUi";
			data.parameters = {};
			data.parameters.destinationId = this.displayId;
			data.parameters.sourceId = this.myId;
			data.parameters.message = message;

			// Different packet if needs to be remote
			if (!this.remoteDisplayServer) {
				wsio.emit("callFunctionOnApp", data);
			} else {
				data.remoteDisplayServer = this.remoteDisplayServer;
				wsio.emit("webRtcRemoteScreenShareSendingUiMessage", data);
			}
		} else if (this.streamerId && (this.streamerId !== this.myId)) {
			// Elese it is a Display -> UI
			this.debugprint("Sending to UI:" + message);
			// Else must be a display sending to UI
			let data = {};
			data.clientDest = this.streamerId;
			data.func = "webrtc_SignalMessageFromDisplay";
			data.appId = this.appId;
			data.destinationId = this.streamerId;
			data.sourceId  = this.myId;
			data.message = message;

			// Different packet if needs to be remote
			if (!this.forRemoteClient) {
				wsio.emit("sendDataToClient", data);
			} else {
				wsio.emit("webRtcRemoteScreenShareSendingDisplayMessage", data);
			}
		} else {
			this.debugprint("ERROR, sendMessage activated without one of the following: myId, streamerId, displayId");
			this.debugprint(this.myId);
			this.debugprint(this.streamerId);
			this.debugprint(this.displayId);
		}
	}

	// This assumes the app properly figures out where it should go
	readMessage(message, callback) {
		this.debugprint("Got message " + message);
		let mConverted = message;
		if (typeof message !== "object") {
			mConverted = JSON.parse(message);
		}
		// Check if it was an ice message, if it was add it
		if (mConverted.ice !== undefined) {
			this.peer.addIceCandidate(mConverted.ice)
				.catch(() => {
					console.log("SAGE2_webrtc> ice candidate error");
				});
		} else if (mConverted.sdp.type === "answer") {
			// Answers are seen by the UI (streamer)
			this.peer.setRemoteDescription(new RTCSessionDescription(mConverted.sdp))
				.then(() => {
					this.sendStoredIceCandidates();
				})
				.catch(() => {
					console.log("SAGE2_webrtc> answer handling error");
				});
		} else if (mConverted.sdp.type === "offer") {
			this.debugprint("got offer, going to make answer");
			// Offers seen by displays
			this.peer.setRemoteDescription(new RTCSessionDescription(mConverted.sdp))
				.then(() => {
					return this.peer.createAnswer();
				})
				.then((answer) => {
					this.peer.setLocalDescription(answer);
					this.debugprint("Set local description, btw answer was:");
				})
				.then(() => {
					this.debugprint("local description:", this.peer.localDescription);
					this.sendMessage(JSON.stringify({sdp: this.peer.localDescription}));
					this.debugprint("sent answer to UI");
					this.sendStoredIceCandidates();
					this.debugprint("sent stored ice candidates");
					if (callback) {
						// Callback for Display Client to hide the status div, then show WebRTC mode in title.
						callback();
					}
				})
				.catch((e) => {
					console.log("SAGE2_webrtc> offer handling error:", e);
				});
		} else {
			this.debugprint(" ERROR unknown message (not ice, answer or offer): " + message);
		}
	}

	// Sends the stored up ice candidates, sending too early will cause silent errors within webrtc
	sendStoredIceCandidates() {
		try {
			// Interactor only exists in the UI client
			if (interactor && interactor.mediaUseRTC) {
				interactor.broadcasting = true;
			}
		} catch (e) {
			// Skipping to here if this is the display
		}

		this.completedOfferAnswerResponse = true;
		for (let i = 0; i < this.iceCandidatesReadyToSend.length; i++) {
			this.sendMessage(this.iceCandidatesReadyToSend[i]);
		}
		// Clear it out
		this.iceCandidatesReadyToSend = [];
	}
}


