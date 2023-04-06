
//
// SAGE2 application: skeletonWebviewApp
// by: Dylan Kobayashi <dylank@hawaii.edu>
//
// Copyright (c) 2019
//

console.log("main.js loaded");

var remoteSiteInformation = null;


document.addEventListener("mousedown", function() {
	knockAudio.currentTime = 0;
	knockAudio.play();
});

knockAudio.onended = function() {
	setTimeout(() => {
		knockAudio.play(); // infinite...
	}, 5000);
};


let knocker = getParameterByName("knocker");
siteThatIsKnocking.textContent = knocker + " is knocking";






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

	SAGE2_AppState.callFunctionInContainer("containerStartKnockAudioWithClick", "noparamstosend");
}

function handleSiteNotification(info) {
	remoteSiteInformation = info;
	// To manually change the application title
	SAGE2_AppState.titleUpdate(knocker + " is knocking");
}


	
// ----------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------

function getUiFontSize() {
	SAGE2_AppState.callFunctionInContainer("webpageRequestingUiSize", "noparamstosend");
}





/**
 * Extract the parameter value from the current URL (?clientID=0&param=4)
 *
 * @method getParameterByName
 * @param name {String} parameter to search for
 * @return {String} null or the value found
 */
function getParameterByName(name) {
	name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]"); // eslint-disable-line
	var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
	var results = regex.exec(location.search);
	return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

