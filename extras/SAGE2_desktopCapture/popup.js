
// The popup page is loaded
document.addEventListener('DOMContentLoaded', function () {
	// request a list of SAGE2 sites currently opened
	chrome.runtime.sendMessage({cmd: "getList"});
});

// Get a reply to 'getList'
chrome.runtime.onMessage.addListener(function(response) {
	if (response && response.cmd && response.cmd === 'list') {
		// Remove all existing servers
		var screenList = document.getElementById('screenshot_list');
		removeAllChildren(screenList);
		var linkList = document.getElementById('link_list');
		removeAllChildren(linkList);
		// Add new servers
		for (var v in response.urls) {
			if (response.urls[v]) {

				let sage2name  = response.urls[v].title;
				let sage2parts = response.urls[v].title.split('-');
				if (sage2parts.length > 1) {
					sage2name = sage2parts[1];
				}

				var div = document.createElement('div');
				div.className = 'server';
				var textnode = document.createTextNode(sage2name);
				// Storing the URL in the DOM
				div.targetURL = response.urls[v].url;
				div.appendChild(textnode);
				// Set a click callback
				div.addEventListener('click', sendScreenshot);
				// Add to the popup page
				screenList.appendChild(div);

				var div2 = document.createElement('div');
				div2.className = 'server';
				var textnode2 = document.createTextNode(sage2name);
				// Storing the URL in the DOM
				div2.targetURL = response.urls[v].url;
				div2.appendChild(textnode2);
				// Set a click callback
				div2.addEventListener('click', sendLink);
				// Add to the popup page
				linkList.appendChild(div2);
			}
		}
	}
});

/**
 * Remove of children of a DOM element
 *
 * @method removeAllChildren
 * @param node {Element|String} id or node to be processed
 */
function removeAllChildren(node) {
	// if the parameter a string, look it up
	var elt = (typeof node === "string") ? document.getElementById(node) : node;
	// remove one child at a time
	while (elt.lastChild) {
		elt.removeChild(elt.lastChild);
	}
}

function sendLink(e) {
	chrome.tabs.query({active: true, currentWindow:true}, function(tabs) {
		var tab = tabs[0];
		chrome.runtime.sendMessage({
			id:     tab.id,
			sender: e.target.targetURL,
			cmd:    "openlink",
			title:  tab.title,
			url:    tab.url,
			width:  tab.width,
			height: tab.height
		});
	});
}

function sendScreenshot(e) {
	chrome.tabs.query({active: true, currentWindow:true}, function(tabs) {
		var tab = tabs[0];
		chrome.tabs.captureVisibleTab(function(screenshotUrl) {
			chrome.runtime.sendMessage({
				id:     tab.id,
				sender: e.target.targetURL,
				cmd:    "screenshot",
				src:    screenshotUrl,
				title:  tab.title,
				url:    tab.url,
				width:  tab.width,
				height: tab.height
			});
		});
	});
}
