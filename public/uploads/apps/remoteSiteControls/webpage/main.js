
//
// SAGE2 application: skeletonWebviewApp
// by: Dylan Kobayashi <dylank@hawaii.edu>
//
// Copyright (c) 2018
//

console.log("main.js loaded");

var remoteSiteInformation = null;

/*
How to use SAGE2_AppState.js

	Including SAGE2_AppState.js will add a global variable to the window called:
		SAGE2_AppState

	That provides the means to communicate with the app container.

	See the following examples below:

*/

// Adding a full state handler
SAGE2_AppState.addFullStateHandler(customFullStateHandler); // customFullStateHandler is a function defined below



// To call a function in the container
// State the name of the function in a string, the second param will be given to the function
SAGE2_AppState.callFunctionInContainer("consolePrint", "The webpage has loaded and is calling the consolePrint function defined in the container");


// request data
getUiFontSize();

	
// ----------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------
function customFullStateHandler(state) {
	console.log("Received a full state update from container", state);
}

function handlerForZoomStateValue(value) {
	console.log("State was updated, current zoom value:", value);
}

function handlerForUiSize(size) {
	let butts = document.getElementsByTagName("button");
	for (let i = 0; i < butts.length; i++) {
		butts[i].style.fontSize = size + "px";
	}
	let divs = document.getElementsByTagName("div");
	for (let i = 0; i < divs.length; i++) {
		divs[i].style.fontSize = size * 2 + "px";
	}
}

function handleSiteNotification(info) {
	remoteSiteInformation = info;
	// To manually change the application title
	SAGE2_AppState.titleUpdate("Controls for " + remoteSiteInformation.name);
	document.getElementById("nameOfSite").textContent = "Site: " + remoteSiteInformation.name;

	// Setup click effects
	document.getElementById("bAction_knockAtThisSite").addEventListener("click", () => {
		console.log("click on bAction_knockAtThisSite");
		SAGE2_AppState.callFunctionInContainer("sendKnock", remoteSiteInformation);
	});
	document.getElementById("bAction_shareEverythingNewToThisSite").addEventListener("click", () => {
		console.log("click on bAction_shareEverything");
		SAGE2_AppState.callFunctionInContainer("shareEverythingNew", remoteSiteInformation);
	});
	document.getElementById("bAction_stopShareEverythingNewToThisSite").addEventListener("click", () => {
		console.log("click on bAction_stopShareEverythingNewToThisSite");
		SAGE2_AppState.callFunctionInContainer("stopShareEverythingNew", remoteSiteInformation);
	});
	document.getElementById("bAction_makeStateAwayForEveryone").addEventListener("click", () => {
		console.log("click on bAction_makeStateAwayForEveryone");
		SAGE2_AppState.callFunctionInContainer("awayStatus");
	});
	document.getElementById("bAction_makeStateAvailableForOnlyThisSite").addEventListener("click", () => {
		console.log("click on bAction_makeStateAvailableForOnlyThisSite");
		SAGE2_AppState.callFunctionInContainer("awayStatus", remoteSiteInformation);
	});
}

function handleSharingState(state) {
	console.log("erase me, setting share state", state);
	if (state) {
		document.getElementById("sharingState").style.visibility = "visible";
		document.getElementById("bAction_shareEverythingNewToThisSite").style.display = "none";
		document.getElementById("bAction_stopShareEverythingNewToThisSite").style.display = "block";
	} else {
		document.getElementById("sharingState").style.visibility = "hidden";
		document.getElementById("bAction_shareEverythingNewToThisSite").style.display = "block";
		document.getElementById("bAction_stopShareEverythingNewToThisSite").style.display = "none";
	}
}


	
// ----------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------

function getUiFontSize() {
	SAGE2_AppState.callFunctionInContainer("webpageRequestingUiSize", "noparamstosend");
}

