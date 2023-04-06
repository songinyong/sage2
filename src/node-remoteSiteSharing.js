// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014

// require variables to be declared
"use strict";


var sitesToShareWith = [];
// var allowedApps = [
// 	"movie_player",
// 	"image_viewer",
// 	"Webview"
// ];

// Rework, using the following now

/*
Remote Site objects look like:
	remoteSites[index] = {
		name: element.name,
		wsio: null,
		connected: "off",
		geometry: rGeom,
		index: index,
		unavailable: false, // used for automated sharing
		beingSharedWith: false // used for automated sharing
	};
*/
function toggleSiteSharingWithRemoteSite(site, clients) {
	// The major case of no site is due to versioning block
	// Someone that right clicks on the versioning block should not initiate anything.
	if (site) {
		// If sharing, stop
		if (site.beingSharedWith) {
			site.beingSharedWith = false;
			// Notify displays
			for (let i = 0; i < clients.length; i++) {
				if (clients[i].clientType === "display") {
					clients[i].emit('updateRemoteSiteShareVisual', {
						siteName: site.name,
						isSharing: false
					});
				}
			}
			// Remove from share list
			sitesToShareWith.splice(sitesToShareWith.indexOf(site), 1);
		} else { // Otherwise enable
			site.beingSharedWith = true;
			// Notify displays
			for (let i = 0; i < clients.length; i++) {
				if (clients[i].clientType === "display") {
					clients[i].emit('updateRemoteSiteShareVisual', {
						siteName: site.name,
						isSharing: true
					});
				}
			}
			// Add to share list
			sitesToShareWith.push(site);
		}
	}
}


/*
*/
function checkAppAndShareIfShould(app, wsCallFunctionOnApp) {
	// Restrict apps that are shared?
	// if ( allowedApps.indexOf(app.application.application) !== -1) {

	if (sitesToShareWith.length > 0) {
		// Prevent already shared applications. Those should have : and + in them
		// Note: screenshares have : in them
		if (app.id.indexOf("+") === -1) {
			// Need a better way to do this...
			// PDFs cannot be send immediately due to some kind of lock.
			if (app.application === "pdf_viewer") {
				setTimeout(() => {
					sitesToShareWith.forEach(site => {
						// Wsio replaced with the below id object
						wsCallFunctionOnApp({id: "SAGE2_serverAutomatedShare"}, {
							app: app.id,
							func: "SAGE2_shareWithSite",
							parameters: {
								remoteSiteName: site.name
							}
						});
					});
				}, 3000);
			} else {
				sitesToShareWith.forEach(site => {
					// Wsio replaced with the below id object
					wsCallFunctionOnApp({id: "SAGE2_serverAutomatedShare"}, {
						app: app.id,
						func: "SAGE2_shareWithSite",
						parameters: {
							remoteSiteName: site.name
						}
					});
				});
			}
		}
	}
}




module.exports.toggleSiteSharingWithRemoteSite = toggleSiteSharingWithRemoteSite;
module.exports.checkAppAndShareIfShould        = checkAppAndShareIfShould;


















// Not used for now
/*
function knockSend(data, remoteSites) {

	console.log("TODO, try knock on the remote site using data:", data);

	for (let i = 0; i < remoteSites.length; i++) {
		if (remoteSites[i].name === data.name) {
			console.log("Matching remote site found", remoteSites[i].name);
			remoteSites[i].wsio.emit("remoteSiteKnockOnSiteHandler", { });
			return;
		}
	}
	console.log("No match found");
}
function knockAtThisSite(wsio, data, remoteSiteKnocking, wsLoadApplication) {
	let uniqueID = wsio.id; // Used to identify source
	// Create the webview to the remote UI
	wsLoadApplication({id: uniqueID}, {
		application: "/uploads/apps/remoteSiteControls",
		user: uniqueID,
		// pass the url in the data object
		data: {
			id:  uniqueID,
			pageToShow: "knocking.html/?knocker=" + remoteSiteKnocking.name
		},
		position: [global.config.totalWidth / 3, global.config.ui.titleBarHeight + 10],
		dimensions: [400, 400]
	});
}

function makeUnavailable(data, remoteSites) {
	console.log("TODO, become unavailable. Is there an exception?", data);
	for (let i = 0; i < remoteSites.length; i++) {
		if ((remoteSites[i].connected === "on")
			|| (remoteSites[i].connected === "locked")) {
			if (data && (remoteSites[i].name === data.name)) {
				console.log("Matching remote site found, wont ignore ", remoteSites[i].name);
			} else {
				console.log("Becoming unavailable to:" + remoteSites[i].name);
				remoteSites[i].wsio.emit("remoteConnection", {
					status: "unavailable",
					reason: "Site became unavailable by choice"
				});
			}
		}
	}
}


// module.exports.knockSend       = knockSend;
// module.exports.knockAtThisSite = knockAtThisSite;
// module.exports.makeUnavailable = makeUnavailable;
*/
