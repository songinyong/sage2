// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014-16


// This background script is used to invoke desktopCapture API
// to capture screen-MediaStream.

var ports = {};


////////////////////////////////////////////////////////////////////////////////
// Context menu support
////////////////////////////////////////////////////////////////////////////////

function setUpContextMenus(id, site) {
	chrome.contextMenus.create({
		title: 'Send Webpage to ' + site,
		type: 'normal',
		id: 'send_webpage' + id,
		contexts: ['all']
	});

	chrome.contextMenus.create({
		title: 'Send Screenshot to ' + site,
		type: 'normal',
		id: 'send_screenshot' + id,
		contexts: ['all']
	});

	chrome.contextMenus.create( {
		title: 'Create a Quick Note to ' + site + ' "%s"',
		type: 'normal',
		id: 'create_quicknote'  + id,
		contexts: ['selection']
	});

	chrome.contextMenus.create( {
		title: 'Send image to ' + site,
		type: 'normal',
		id: 'send_image'  + id,
		contexts: ['image']
	});

	chrome.contextMenus.create( {
		title: 'Send link to ' + site,
		type: 'normal',
		id: 'send_link'  + id,
		contexts: ['link']
	});
}

function updateContextMenus(id, site) {
	chrome.contextMenus.update({
		title: 'Send Webpage to ' + site,
		type: 'normal',
		id: 'send_webpage' + id,
		contexts: ['all']
	});

	chrome.contextMenus.update({
		title: 'Send Screenshot to ' + site,
		type: 'normal',
		id: 'send_screenshot' + id,
		contexts: ['all']
	});

	chrome.contextMenus.update( {
		title: 'Create a Quick Note to ' + site + ' "%s"',
		type: 'normal',
		id: 'create_quicknote'  + id,
		contexts: ['selection']
	});

	chrome.contextMenus.update( {
		title: 'Send image to ' + site,
		type: 'normal',
		id: 'send_image'  + id,
		contexts: ['image']
	});

	chrome.contextMenus.update( {
		title: 'Send link to ' + site,
		type: 'normal',
		id: 'send_link'  + id,
		contexts: ['link']
	});
}

function removeContextMenus(id) {
	chrome.contextMenus.remove('send_webpage'     + id);
	chrome.contextMenus.remove('send_screenshot'  + id);
	chrome.contextMenus.remove('create_quicknote' + id);
	chrome.contextMenus.remove('send_image' + id);
	chrome.contextMenus.remove('send_link'  + id);
}

chrome.runtime.onInstalled.addListener(function() {
	// The extension is installed
	ports = {};
});

chrome.contextMenus.onClicked.addListener(function(itemData, sender) {
	if (itemData.menuItemId.startsWith("create_quicknote")) {
		for (let p in ports) {
			if (itemData.menuItemId === 'create_quicknote' + ports[p].sender.tab.id) {
				ports[p].postMessage({
					id:   ports[p].sender.id,
					cmd:  "createnote",
					text: itemData.selectionText
				});
			}
		}
	} else if (itemData.menuItemId.startsWith("send_webpage")) {
		chrome.tabs.query({active: true, currentWindow:true}, function(tabs) {
			let tab = tabs[0];
			for (let p in ports) {
				if (itemData.menuItemId === 'send_webpage' + ports[p].sender.tab.id) {
					ports[p].postMessage({
						id:     ports[p].sender.id,
						cmd:    "openlink",
						url:    itemData.pageUrl,
						title:  tab.title,
						width:  tab.width,
						height: tab.height
					});
				}
			}
		});
	} else if (itemData.menuItemId.startsWith("send_link")) {
		for (let p in ports) {
			if (itemData.menuItemId === 'send_link' + ports[p].sender.tab.id) {
				ports[p].postMessage({
					id:  ports[p].sender.id,
					cmd: "openlink",
					url: itemData.linkUrl
				});
			}
		}
	} else if (itemData.menuItemId.startsWith("send_image")) {
		for (let p in ports) {
			if (itemData.menuItemId === 'send_image' + ports[p].sender.tab.id) {
				ports[p].postMessage({
					id:  ports[p].sender.id,
					cmd: "openimage",
					url: itemData.srcUrl || itemData.linkUrl
				});
			}
		}
	} else if (itemData.menuItemId.startsWith("send_screenshot")) {
		chrome.tabs.query({active: true, currentWindow:true}, function(tabs) {
			let tab = tabs[0];
			chrome.tabs.captureVisibleTab(null, {format: "jpeg", quality: 85}, function(screenshotUrl) {
				for (let p in ports) {
					if (itemData.menuItemId === 'send_screenshot' + ports[p].sender.tab.id) {
						ports[p].postMessage({
							id:     ports[p].sender.id,
							cmd:    "screenshot",
							src:    screenshotUrl,
							title:  tab.title,
							url:    tab.url,
							width:  tab.width,
							height: tab.height
						});
					}
				}
			});
		});
	}
});

////////////////////////////////////////////////////////////////////////////////


chrome.runtime.onSuspend.addListener(function() {
});

chrome.runtime.onConnectExternal.addListener(function(port) {
});

chrome.runtime.onMessage.addListener(function(message, sender) {
	// getList message from popup
	if (message.cmd && message.cmd === 'getList') {
		var urls = uniqueArray(allURL(ports));
		chrome.runtime.sendMessage(sender.id, {cmd: 'list', urls: urls});
	} else {
		if (message.sender) {
			// Find a port with a matching URL
			for (var p in ports) {
				if (ports[p].sender.url === message.sender) {
					// only send to the first found
					ports[p].postMessage(message);
					return;
				}
			}
		} else {
			// Nothing yet
		}
	}
});

// Find if existing URL inside list of ports
function findURL(arr, aurl) {
	var res = false;
	Object.keys(arr).forEach(function(k) {
		if (arr[k].sender.url === aurl) {
			res = true;
		}
	});
	return res;
}

// Build arrays of URL
function allURL(arr) {
	var res = [];
	Object.keys(arr).forEach(function(k) {
		res.push({
			url:   arr[k].sender.url,
			title: arr[k].sender.tab.title
		});
	});
	return res;
}

// Return an array of unique values
function uniqueArray(arr) {
    var a = [];
    for (var i=0, l=arr.length; i<l; i++)
        if (a.indexOf(arr[i]) === -1)
            a.push(arr[i]);
    return a;
}

chrome.runtime.onConnect.addListener(function(port) {
	port.onMessage.addListener(portOnMessageHanlder);

	port.onDisconnect.addListener(function() {
		delete ports[port.sender.tab.id];
		var urls = uniqueArray(allURL(ports));
		var numberOfConnection = urls.length;
		if (numberOfConnection === 0) {
			chrome.browserAction.setBadgeText({text: ""});
		} else {
			chrome.browserAction.setBadgeText({text: numberOfConnection.toString()});
		}
		port.onMessage.removeListener(portOnMessageHanlder);
		// Remove the context menu entries
		removeContextMenus(port.sender.tab.id);
	});

	// this one is called for each message from "content-script.js"
	function portOnMessageHanlder(message) {
		if (message === "SAGE2_capture_desktop" || message === "capture_desktop") {
			chrome.desktopCapture.chooseDesktopMedia(['screen', 'window', 'tab'],
				port.sender.tab, onAccessApproved);
		} else if (message === "SAGE2_registerUI") {
			var found = findURL(ports, port.sender.url);
			// if it is a new site, store the info
			if (!found) {
				// Save the port in the list, indexed by URL
				ports[port.sender.tab.id] = port;
				var numberOfConnection = Object.keys(ports).length;
				chrome.browserAction.setBadgeText({
					text: numberOfConnection.toString()
				});

				// setup the context menus
				let sage2parts = port.sender.tab.title.split('-');
				if (sage2parts.length > 1) {
					// Use the title we got
					let sage2name = sage2parts[1];
					setUpContextMenus(port.sender.tab.id, sage2name);
				} else {
					// setup a callback waiting for the title to change
					chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, thistab) {
						if (tabId === port.sender.tab.id) {
							if (changeInfo.title) {
								// Use the title we got
								let sage2name = changeInfo.title.split('-')[1];
								port.sender.tab.title = changeInfo.title;
								setUpContextMenus(port.sender.tab.id, sage2name);
							}
						}
					});
				}
			} else {
				ports[port.sender.tab.id] = port;
				let sage2name = changeInfo.title.split('-')[1];
				updateContextMenus(port.sender.tab.id, sage2name);
			}
		}
	}

	// on getting sourceId
	// "sourceId" will be empty if permission is denied.
	function onAccessApproved(sourceId) {
		// if "cancel" button is clicked
		if (!sourceId || !sourceId.length) {
			return port.postMessage({cmd: "permission_denied"});
		}

		// "ok" button is clicked; share "sourceId" with the
		// content-script which will forward it to the webpage
		port.postMessage({cmd: "window_selected", mediaSourceId: sourceId});
	}

	// Listen for a click on the camera icon. On that click, take a screenshot.
	// chrome.browserAction.onClicked.addListener(function(tab) {
	// });

});
