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

/* global wsio d3 CodeSnippetCompiler SAGE2_SnippetsUtil jsonSummary */

let SAGE2_CodeSnippets = (function() {
	let self = {
		functions: {},
		functionCount: 0,

		isOpeningList: false,
		listApps: {},
		userInteractions: {},

		links: {},
		linkCount: 0,

		pendingDataLinks: [],
		pendingVisLinks: [],

		inputs: {},

		dataCount: 0,
		visCount: 0,
		outputApps: {},
		appIDmap: {},

		config: {},
		loadingApps: {},
		reloadAppIDmap: {},
		reloadSnippetIDmap: {},
		reloadSnippetFilemap: {}
	};

	/**
	 * Initializer function for the SAGE2_CodeSnippets runtime
	 *
	 * @method init
	 * @param {Object} config - config for codesnippets from the experimental part of the SAGE2 config
	 */
	function init(config) {
		console.log("CodeSnippets> Initialized", config);
		self.config = config;

		// don't initialize
		if (!self.config.enabled) {
			return;
		}

		// // preload settings icon SVG to prevent flicker
		let xhr = new XMLHttpRequest();
		xhr.open("GET", "../images/radialMenu/three115.svg", false);
		// Following line is just to be on the safe side;
		// not needed if your server delivers SVG with correct MIME type
		xhr.overrideMimeType("image/svg+xml");
		xhr.send("");

		self.inputsIcon = document.createElement("div")
			.appendChild(xhr.responseXML.documentElement);

		// save base64 encoding for easy embedding
		let imgSerial = new XMLSerializer().serializeToString(self.inputsIcon);
		self.inputsIconB64 = btoa(imgSerial);

		// load external dependencies
		if (self.config.external_dependencies) {
			for (let dependency of self.config.external_dependencies) {
				let script = document.createElement("script");
				script.type = "text/javascript";
				script.className = "snippets-dependency";
				script.async = false;
				script.src = dependency;

				document.head.appendChild(script);
			}
		}
	}

	/**
	 * Gets a new, unique snippet ID.
	 *
	 * @method getNewFunctionID
	 */
	function getNewFunctionID() {
		if (Object.keys(self.functions).length === 0) {
			self.functionCount++;
			return "codeSnippet-" + 0;
		}

		self.functionCount = Math.max(
			Math.max(...Object.keys(self.functions).map(id => id.split("-")[1])) + 1,
			self.functionCount
		);

		return "codeSnippet-" + self.functionCount++;
	}

	/**
	 * Aggregates the information necessary for the WebUI to correctly populate its
	 * SnippetEditor interface with information.
	 *
	 * @method getFunctionInfo
	 */
	function getFunctionInfo() {
		let functionInfo = {};

		Object.keys(self.functions).forEach(id => {
			functionInfo[id] = {
				id,
				type: self.functions[id].type,
				src: self.functions[id].src,
				desc: self.functions[id].desc,
				locked: self.functions[id].editor !== null,
				editor: self.functions[id].editor,
				selectors: []
			};
		});

		Object.keys(self.userInteractions).forEach(userID => {
			let operation = self.userInteractions[userID];
			functionInfo[operation.func.id].selectors.push(operation.user);
		});

		return functionInfo;
	}

	/**
	 * Updates the definition of a function when a user saves a snippet.
	 *
	 * Note: This is called from WITHIN the dynamically loaded snippet file.
	 *
	 * @method updateFunctionDefinition
	 * @param {String} id - the id of the snippet
	 * @param {Object} definition - the new definition of the function
	 */
	function updateFunctionDefinition(id, definition) {
		// update the saved function definition
		let func = self.functions[id] = definition;

		// handle assocation from reload
		if (func.src && self.reloadSnippetFilemap[func.src]) {
			self.reloadSnippetIDmap[self.reloadSnippetFilemap[func.src]] = id;
		}

		// update links which use this function
		if (func.links) {
			for (let linkID of func.links) {
				self.links[linkID].update();
			}
		}

		// set string to null value
		if (func.editor === "null") {
			func.editor = null;
		}

		if (isMaster) {
			// loadable script defitition in server

			wsio.emit("snippetSaveIntoServer", {
				text: func.text,
				type: func.type,
				desc: func.desc,
				creator: func.creator ? func.creator : null,
				snippetID: id,
				filename: func.src ? func.src : null,
				editor: func.editor
			});

			// send info for user who saved code to load
			wsio.emit("snippetSendCodeOnLoad", {
				scriptID: id,
				to: definition.editor,
				text: definition.text,
				type: definition.type,
				desc: definition.desc
			});

			let functionState = getFunctionInfo();
			wsio.emit("snippetsStateUpdated", functionState);

			sendSnippetLogToUser(id);
		}

	}

	/**
	 * This function is used to save a new/edited code snippet, recreating the snippet body
	 * and reloading it into the display client.
	 *
	 * @method saveSnippet
	 * @param {String} uniqueID - SAGE uniqueID of user who is saving the snippet
	 * @param {String} code - the code (as a string)
	 * @param {String} desc - the snippet description (i.e. name)
	 * @param {String} type - the snippet type (gen, data, draw)
	 * @param {String} scriptID - the unique snippet id (codeSnippet-2)
	 * @param {String} author - the display name of the user saving changes
	 */
	function saveSnippet(uniqueID, code, desc, type, scriptID, author) {

		let src = "null";

		if (scriptID === "new") {
			scriptID = getNewFunctionID();

			self.functions[scriptID] = {
				src,
				type,
				editor: uniqueID,
				creator: author,
				links: []
			};
		}

		let snippetInfo = self.functions[scriptID];
		snippetInfo.desc = desc;

		try {
			snippetInfo.code = CodeSnippetCompiler.createFunction(type, code);
			snippetInfo.text = code.replace(/`/gi, "\\`").replace(/\$/gi, "\\$");
		} catch (err) {
			// console.log("Error parsing code", err);
			// throwErrorToUser(scriptID, err, uniqueID);
		}

		updateFunctionDefinition(scriptID, snippetInfo);

		// open a snippet list if it isn't open already
		if (Object.values(self.listApps).length === 0) {
			createListApplication();
		}

		updateListApps();
	}

	/**
	 * Creates a copy of an existing snippet for a user
	 *
	 * @method cloneSnippet
	 * @param {String} uniqueID - the SAGE2 uniqueID of the user cloning the snippet
	 * @param {String} scriptID - the snippet to be cloned
	 */
	function cloneSnippet(uniqueID, scriptID, author) {
		let originalSnippet = self.functions[scriptID];

		let code = originalSnippet.text;
		let desc = originalSnippet.desc + " (copy)";
		let type = originalSnippet.type;

		saveSnippet(uniqueID, code, desc, type, "new", author);

		updateListApps();
	}

	/**
	 * Notification from the server specifying that a saved snippet's filename in the
	 * media browser has changed.
	 *
	 * @method sourceFileUpdated
	 * @param {String} scriptID - the id of the snippet
	 * @param {String} filename - the new filename
	 */
	function sourceFileUpdated(scriptID, filename) {
		// update scripts filename
		self.functions[scriptID].src = filename;
	}

	/**
	 * Loads a script from a static file
	 *
	 * @method loadFromFile
	 * @param {Object} func - the information about the funtion (code, desc, type)
	 * @param {String} filename - the name of the script file
	 */
	function loadFromFile(func, filename, id = "new") {
		if (id !== "new") {
			self.reloadSnippetFilemap[filename] = id;
		}

		// only create a list application if there are none referenced
		// and the file is not reloading from state
		if (Object.values(self.listApps).length === 0 && id === "new") {
			createListApplication();
		}

		if (id === "new") {
			id = getNewFunctionID();
		}

		self.functions[id] = {
			filename,
			type: func.type,
			desc: func.desc,
			creator: func.creator || "unknown",
			editor: null,
			links: []
		};

		let snippetInfo = self.functions[id];

		try {
			snippetInfo.code = CodeSnippetCompiler.createFunction(func.type, func.text);
			snippetInfo.text = func.text.replace(/`/gi, "\\`").replace(/\${/gi, "\\${");
		} catch (err) {
			// console.log("Error parsing code", err);
		}

		let functionState = getFunctionInfo();
		wsio.emit("snippetsStateUpdated", functionState);

		updateListApps();
	}

	/**
	 * Handles sending a snippet to a WebUI which is requesting to load/edit a snippet.
	 *
	 * @method requestSnippetLoad
	 * @param {String} uniqueID - the SAGE2 uniqueID of the user who is requesting to edit the snippet
	 * @param {String} scriptID - the id of the snippet to be loaded
	 */
	function requestSnippetLoad(uniqueID, scriptID) {
		// send script to user
		if (self.functions[scriptID] && !self.functions[scriptID].editor) {
			for (let id of Object.keys(self.functions)) {
				if (self.functions[id].editor === uniqueID) {
					self.functions[id].editor = null;
				}
			}

			self.functions[scriptID].editor = uniqueID;

			if (isMaster) {
				wsio.emit("snippetSendCodeOnLoad", {
					scriptID: scriptID,
					to: self.functions[scriptID].editor,
					text: self.functions[scriptID].text,
					type: self.functions[scriptID].type,
					desc: self.functions[scriptID].desc
				});

				sendSnippetLogToUser(scriptID);
			}
		}

		// broadcast update of function states
		if (isMaster) {
			let functionState = getFunctionInfo();
			wsio.emit("snippetsStateUpdated", functionState);
		}

		updateListApps();
	}

	/**
	 * Handles updating the editor of a snippet when the user has closed it
	 *
	 * @method notifySnippetClosed
	 * @param {String} scriptID - the id of the snippet which was closed
	 */
	function notifySnippetClosed(scriptID) {
		self.functions[scriptID].editor = null;

		// broadcast update of function states
		if (isMaster) {
			let functionState = getFunctionInfo();
			wsio.emit("snippetsStateUpdated", functionState);
		}

		updateListApps();
	}

	/**
	 * Send a request to open a Snippets_Data application, including the reference ID for
	 * the data application
	 *
	 * @method createDataApplication
	 * @param {String} snippetsID - the id of the data object for reference
	 */
	function createDataApplication(snippetsID, center) {
		if (isMaster) {
			let minDim = Math.min(ui.json_cfg.totalWidth, ui.json_cfg.totalHeight * 2);
			// let minDim = Math.min(ui.width, ui.height * 2);

			wsio.emit("loadApplication", {
				application:
					"/uploads/apps/Snippets_Data",
				color: '#ff0000',
				dimensions: [minDim / 4, minDim / 4],
				position: center && [center.x - minDim / 8, center.y - minDim / 8],
				data: {
					snippetsID
				}
			});
		}
	}

	/**
	 * Send a request to open a Snippets_Vis application, including the reference ID for
	 * the vis application
	 *
	 * @method createVisApplication
	 * @param {String} snippetsID - the id of the vis object for reference
	 */
	function createVisApplication(snippetsID, center) {
		if (isMaster) {
			let minDim = Math.min(ui.json_cfg.totalWidth, ui.json_cfg.totalHeight * 2);

			wsio.emit("loadApplication", {
				application:
					"/uploads/apps/Snippets_Vis",
				color: "#ff0000",
				dimensions: [minDim / 4, minDim / 4],
				position: center && [center.x - minDim / 8, center.y - minDim / 8],
				data: {
					snippetsID
				}
			});
		}
	}

	/**
	 * Send a request to open a Snippets_View application, including the reference ID for
	 * the vis application
	 *
	 * @method createViewApplication
	 * @param {String} snippetsID - the id of the object object for reference
	 */
	function createViewApplication(snippetsID, center) {
		if (isMaster) {
			let minDim = Math.min(ui.json_cfg.totalWidth, ui.json_cfg.totalHeight * 2);

			wsio.emit("loadApplication", {
				application:
					"/uploads/apps/Snippets_View",
				color: "#ff0000",
				dimensions: [minDim / 4, minDim / 4],
				position: center && [center.x - minDim / 8, center.y - minDim / 8],
				data: {
					snippetsID
				}
			});
		}
	}

	/**
	 * Send a request to open a Snippets_List application to dislay loaded code
	 *
	 * @method createListApplication
	 */
	function createListApplication() {
		if (isMaster && !self.isOpeningList) {
			self.isOpeningList = true;

			let minDim = Math.min(ui.json_cfg.totalWidth, ui.json_cfg.totalHeight * 2);
			// let minDim = Math.min(ui.width, ui.height * 2);

			wsio.emit("loadApplication", {
				application:
					"/uploads/apps/Snippets_List",
				dimensions: [minDim / 8, minDim / 4],
				color: "#ff0000"
			});
		}
	}

	/**
	 * A utility function to calculate the path for the generic gen, data, and draw flowchart
	 * block paths.
	 *
	 * @method createBlockPath
	 * @param {String} type - the type of snippet block
	 * @param {Number} width - the width of the block
	 * @param {Number} height - the height of the block
	 * @param {Array} offset - the [x,y] offset to add to the path calculation
	 */
	function createBlockPath (type, width, height, offset) {
		let mult = [width, height];

		let points = {
			gen: [
				[0, 0],
				[0.925, 0],
				[1, 0.5],
				[0.925, 1],
				[0, 1]
			],
			data: [
				[0, 0],
				[0.925, 0],
				[1, 0.5],
				[0.925, 1],
				[0, 1],
				[0.075, 0.5]
			],
			draw: [
				[0, 0],
				[0.925, 0],
				[1, 0.5],
				[0.925, 1],
				[0, 1],
				[0.075, 0.5]
			]
		};

		return "M " + points[type].map(point =>
			point.map((coord, i) =>
				(coord * mult[i]) + offset[i]
			).join(" ")).join(" L ") + " Z";
	}

	/**
	 * Function which is called from the Snippets_Data and Snippets_Vis applications
	 * to notify the SAGE2_CodeSnippets runtime that the display is ready to draw content.
	 *
	 * @method displayApplicationLoaded
	 * @param {String} id - the data/vis app id
	 * @param {Object} app - the reference to the application object
	 */
	function displayApplicationLoaded(id, app) {
		let originalID = app.state.snippetsID;

		// if the saved ID of the application is already in use, update
		if (self.outputApps[app.state.snippetsID]) {
			let newID = originalID.includes("vis") ?
				"vis-" + self.visCount++ :
				"data-" + self.dataCount++;

			// save this updated ID
			self.reloadAppIDmap[app.state.snippetsID] = newID;

			// update change in state of snippet id
			app.state.snippetsID = newID;
			app.callback("refresh"); // refresh the saved state in the server
		} else {
			// save the original ID
			self.reloadAppIDmap[app.state.snippetsID] = app.state.snippetsID;
		}

		self.appIDmap[app.state.snippetsID] = app.id;

		if (self.loadingApps[originalID]) {
			// resolve app load (from reloading state)

			self.loadingApps[originalID]();
		} else {
			// handle a normal load (on normal interaction)
			handleLoadedApplication(app);
		}
	}

	function handleLoadedApplication(app) {
		// call required function, update reference
		if (app.state.snippetsID.includes("vis")) {
			let primedLink = self.pendingVisLinks.pop();

			if (primedLink) {
				if (primedLink.getParent()) {
					primedLink.getParent().addChildLink(primedLink);
				}

				app.setParentLink(primedLink);

				primedLink.setChild(app);
				primedLink.update();

				// fix reference
				self.outputApps[app.state.snippetsID] = app;
			}

		} else if (app.state.snippetsID.includes("data")) {
			let primedLink = self.pendingDataLinks.pop();

			if (primedLink) {
				if (primedLink.getParent()) {
					primedLink.getParent().addChildLink(primedLink);
				}

				app.setParentLink(primedLink);

				primedLink.setChild(app);
				primedLink.update();

				// fix reference
				self.outputApps[app.state.snippetsID] = app;
			}

		}

		updateSavedSnippetAssociations();
	}

	function updateSavedSnippetAssociations() {
		// send snippet association information to be saved in the server

		if (isMaster) {
			wsio.emit("updateSnippetAssociationState", {
				dataCount: self.dataCount,
				visCount: self.visCount,
				apps: Object.keys(self.outputApps).map(snippetsID => ({
					appID: self.outputApps[snippetsID].id,
					snippetsID
				})),
				links: convertLinksToIDForest()
			});
		}
	}

	// this is to handle reloads (client reconnect)
	function handleReloadedSnippetAssociations(associations) {

		// start at root nodes, recursively handle children
		for (let root of associations.links) {
			handleLink(root, null);
		}

		function handleLink(link, parent) {
			let { linkID, appID, snippetID, children, inputs } = link;

			// get mapping information from appID change or snippetID change
			appID = self.reloadAppIDmap[appID];
			// snippetID = self.reloadSnippetIDmap[snippetID];
			linkID = "link" + self.linkCount++;

			let id = self.appIDmap[appID];

			let newLink = new Link(
				parent ? applications[parent] : null,
				applications[id],
				snippetID
			);

			self.links[linkID] = newLink;
			self.functions[snippetID].links.push(linkID);

			if (parent) {
				applications[parent].addChildLink(newLink);
			}

			applications[id].setParentLink(newLink);
			self.outputApps[appID] = applications[id];

			newLink.setInputInitialValues(inputs);
			newLink.update();

			for (let child of children) {
				handleLink(child, id);
			}
		}

		// restore link index
		if (Object.keys(self.links).length) {
			self.linkCount = Math.max(...Object.keys(self.links).map(id => +id.split("-")[1])) + 1;
		} else {
			self.linkCount = 0;
		}

		updateSavedSnippetAssociations();
	}

	/**
	 * Utility function which takes an app and traverses the parent links in order to construct
	 * a list of functions (e.g. a pipeline).
	 *
	 * @method createVisApplication
	 * @param {Object} app - the reference to the app
	 */
	function getAppAncestry(app) {
		let idAncestry = [];

		let currentApp = app;

		while (currentApp && currentApp.parentLink) {
			let link = currentApp.parentLink;

			idAncestry.unshift(link.getSnippetID());
			currentApp = link.getParent();
		}

		let ancestry = idAncestry.map(id => {
			return {
				desc: self.functions[id].desc,
				type: self.functions[id].type,
				id
			};
		});

		return ancestry;
	}

	/**
	 * Takes an app's ancestry and draws it on an SVG based on height and width specification
	 *
	 * @method drawAppAncestry
	 * @param {Object} data - information about how to draw the ancestry {svg, width, height, ancestry, app}
	 */
	function drawAppAncestry(data) {
		// snippet color palette
		let lightColor = { gen: "#b3e2cd", data: "#cbd5e8", draw: "#fdcdac" };
		let darkColor = { gen: "#87d1b0", data: "#9db0d3", draw: "#fba76d" };

		let {svg, width, height, ancestry, app} = data;
		// calculate display width per snippet block
		let blockWidth = (width - height) / Math.max(ancestry.length, 3);

		// create input settings button/image if it doesn't exist
		if (app.parentLink &&
			Object.keys(app.parentLink.inputs).length &&
			!svg.selectAll(".inputSettingsButton").size()) {

			svg.append("rect")
				.attr("class", "inputSettingsButton")
				.attr("x", width - height)
				.attr("y", 0)
				.attr("width", height - 8)
				.attr("height", height - 8)
				.style("stroke", "black")
				.style("fill", app.state.inputsOpen ? "gold" : "white");

			// fix the use of image by href later (flashes on redraw)
			svg.append("image")
				.attr("class", "inputSettingsImage")
				.attr("href", "data:image/svg+xml;base64," + self.inputsIconB64)
				// .attr("href", "../images/radialMenu/three115.svg")
				.attr("width", height - 16)
				.attr("height", height - 16)
				.on("click", function() {
					if (!app.state.inputsOpen) {
						app.inputsClosedHeight = app.sage2_height;

						let newHeight = Math.max(app.sage2_height, app.inputs.node().clientHeight);

						app.state.inputsOpen = true;
						app.sendResize(app.sage2_width + 300, newHeight);
					} else {
						app.state.inputsOpen = false;
						app.sendResize(app.sage2_width - 300, app.inputsClosedHeight ? app.inputsClosedHeight : app.sage2_height);
					}
				});
		}

		svg.select(".inputSettingsButton")
			.attr("x", width - height)
			.attr("y", 0)
			.style("fill", app.state.inputsOpen ? "gold" : "white");

		svg.select(".inputSettingsImage")
			.attr("x", width - height + 4)
			.attr("y", 4);

		//show snippet ancestry
		svg.selectAll(".snippetFuncBlock").remove();

		svg.selectAll(".snippetFuncBlock")
			.data(ancestry)
			.enter().append("g")
			.attr("class", "snippetFuncBlock")
			.each(function (d, i) {
				let group = d3.select(this);
				let thisOffsetX = i === 0 ? 6 : (i * (0.925 * blockWidth - 6)) + 6;

				group.append("path")
					.attr("class", "snippetPath")
					.attr("d", createBlockPath(d.type, blockWidth - 12, height - 16, [thisOffsetX, 4]))
					.style("stroke-linejoin", "round")
					.style("fill", lightColor[d.type])
					.style("stroke-width", 2)
					.style("stroke", darkColor[d.type]);

				let label = group.append("text")
					.attr("class", "snippetName")
					.attr("x", thisOffsetX + (blockWidth * .5) - 6)
					.attr("y", height / 2)
					.style("text-anchor", "middle")
					.style("font-weight", "bold")
					.style("font-size", ui.titleBarHeight / 2 + "px")
					.style("font-family", "monospace")
					.style("fill", "black")
					.style("pointer-events", "none")
					.text(`[${d.id.split("-")[1]}]: ${d.desc}`);

				if (label.node().getBBox().width > blockWidth * 0.925 - 6) {
					label.text(`${d.desc}`);
				}

				if (label.node().getBBox().width > blockWidth * 0.925 - 6) {
					label.text(`[${d.id.split("-")[1]}]`);
				}

			});
	}

	function handleActionFromUI(action) {
		// console.log("handleActionFromUI", action);

		executeCodeSnippet(action.snippetID, action.source, action.targetCenter);
	}

	/**
	 * Executes a code snippet by ID on a parent dataset, by ID
	 *
	 * @method executeCodeSnippet
	 * @param {String} snippetID - the ID of the code snippet
	 * @param {String} parentID - the SAGE2 ID of the app as the target
	 */
	function executeCodeSnippet(snippetID, parentID, targetLocation) {
		// console.log(snippetID, parentID);

		let snippet = self.functions[snippetID];

		let parent = parentID ? applications[parentID] : null;

		let linkIndex = Object.keys(self.links).findIndex((link) => {
			return self.links[link].getSnippetID() === snippetID && self.links[link].getParent() === parent;
		});

		if (linkIndex === -1 || Object.keys(Object.values(self.links)[linkIndex].inputs).length > 0) {

			// then this is a new link that must be created
			// OR if the snippet specifies input elements, since these can be inconsistent across calls
			let newLink = new Link(parent, null, snippetID);

			let linkID = "link-" + self.linkCount++;
			self.links[linkID] = newLink;

			self.functions[snippetID].links.push(linkID);

			if (snippet.type === "draw") {
				let snippetsID = "vis-" + self.visCount++;

				// get link ready for application finish
				self.pendingVisLinks.push(newLink);

				// createVisApplication(snippetsID, targetLocation);
				createViewApplication(snippetsID, targetLocation);
			} else {
				let snippetsID = "data-" + self.dataCount++;

				// get link ready for application finish
				self.pendingDataLinks.push(newLink);

				// createDataApplication(snippetsID, targetLocation);
				createViewApplication(snippetsID, targetLocation);
			}
		} else {
			self.links[Object.keys(self.links)[linkIndex]].update();
		}

	}

	/**
	 * Registers a Snippet_List app to receive updates for snippets
	 *
	 * @method registerSnippetListApp
	 * @param {String} id - the SAGE2 ID of the app
	 * @param {Object} app - the reference to the SAGE2 application
	 */
	function registerSnippetListApp(id, app) {

		self.listApps[id] = app;
		self.isOpeningList = false;
		app.updateFunctionBank(getFunctionInfo());
	}


	/**
	 * Unregisters a Snippet_List app on close
	 *
	 * @method unregisterSnippetListApp
	 * @param {String} id - the SAGE2 ID of the app
	 */
	function unregisterSnippetListApp(id) {

		delete self.listApps[id];
	}

	/**
	 * Updates all list apps based on current function information
	 *
	 * @method updateListApps
	 */
	function updateListApps() {
		let functionInfo = getFunctionInfo();

		for (let id of Object.keys(self.listApps)) {
			self.listApps[id].updateFunctionBank(functionInfo);
		}
	}

	/**
	 * Notifies the SAGE2_CodeSnippets runtime of a user selection on a function
	 * in the Snippet_List app. This is necessary to handle multi-click actions
	 *
	 * @method notifyUserListClick
	 * @param {Object} user - the SAGE2 user object
	 * @param {Object} funcID - the function id which was clicked on
	 */
	function notifyUserListClick(user, func) {
		if (func.type === "gen") {
			// run gen functions without parent selection
			executeCodeSnippet(func.id, null);
		} else {
			if (self.userInteractions[user.id] && self.userInteractions[user.id].func.id === func.id) {
				// allow users to toggle selection
				delete self.userInteractions[user.id];
			} else {
				// otherwise, save function selection and user for dataset selection
				self.userInteractions[user.id] = {
					user,
					func
				};
			}

			// update list apps because of new selectors
			updateListApps();
		}

	}

	/**
	 * Notifies the SAGE2_CodeSnippets runtime of a user selection on a Snippets_Data app.
	 * This is necessary to handle multi-click actions (invocation on data)
	 *
	 * @method notifyUserDataClick
	 * @param {Object} user - the SAGE2 user object
	 * @param {String} dataID - the unique data ID associated with the clicked app
	 */
	function notifyUserDataClick(user, dataID) {
		// if the user has queued up a function
		if (self.userInteractions[user.id]) {
			executeCodeSnippet(self.userInteractions[user.id].func.id, dataID);

			delete self.userInteractions[user.id];

			updateListApps();
		}
	}

	/**
	 * Notifies the SAGE2_CodeSnippets runtime when a data/vis app was closed so it can be
	 * deregistered from the system and links can be removed
	 *
	 * @method outputAppClosed
	 * @param {Object} app - the SAGE2 app reference
	 */
	function outputAppClosed(app) {
		for (let linkID of Object.keys(self.links)) {
			let parent = self.links[linkID].getParent();
			let child = self.links[linkID].getChild();
			let func = self.functions[self.links[linkID].getSnippetID()];

			if (child === app || parent === app) {
				if (parent === app) {
					self.links[linkID].setParent(null);

					child.updateAncestorTree();
				} else if (parent !== null) {
					parent.removeChildLink(self.links[linkID]);
				}

				// remove ID from function's links
				let funcLinkIndex = func.links.indexOf(linkID);
				func.links.splice(funcLinkIndex, 1);

				// clear timeout if the app has one
				if (self.links[linkID].timeout) {
					clearTimeout(self.links[linkID].timeout);
				}

				delete self.links[linkID];
				delete self.outputApps[app.state.snippetsID];
			}

		}

		updateSavedSnippetAssociations();
	}

	/**
	 * Packages and sends all relevant info to the WebUI of the user who requested to export the
	 * project to be downloaded.
	 *
	 * @method requestSnippetsProjectExport
	 * @param {String} uniqueID - the SAGE2 uniqueID for a user
	 */
	function requestSnippetsProjectExport(uniqueID) {

		// compile snippet function information
		let functionBodies = {};

		for (let id of Object.keys(self.functions)) {
			functionBodies[id] = CodeSnippetCompiler.createFunctionBlock(self.functions[id].type, self.functions[id].text);
		}

		let functionObject = Object.keys(functionBodies).map(
			key => ({
				id: key,
				type: self.functions[key].type,
				desc: self.functions[key].desc,
				text: self.functions[key].text,
				code: functionBodies[key]
			}));

		// create link hierarchy to send
		let links = convertLinksToIDForest();

		// send to WebUI
		wsio.emit("snippetsSendProjectExport", {
			to: uniqueID,
			functions: functionObject,
			links
		});
	}

	// function consoleLogToUser(...args) {
	// 	console.log("Send Log to:", this.uniqueID, this.snippetID, ...args);
	// }

	function snippetLogsUpdated(snippetID) {
		// send to user who has the snippet loaded
		if (self.functions[snippetID].editor && isMaster) {
			sendSnippetLogToUser(snippetID);
		}
	}

	function sendSnippetLogToUser(snippetID) {
		// user target
		let uniqueID = self.functions[snippetID].editor;

		// consolidate logs from all uses of the snippet
		let fullLog = {};

		for (let link of self.functions[snippetID].links) {
			let { log } = self.links[link];

			fullLog[self.links[link].getChild().id] = log;
		}

		wsio.emit("snippetsSendLog", {
			to: uniqueID,
			log: fullLog,
			snippetID
		});
	}

	/**
	 * Utility function which converts the links saved (which include app references) into
	 * a data structure which is stringify compatible. This is necessary to include the
	 * relevant information to reconstruct the relations in the export project.
	 *
	 * @method convertLinksToIDForest
	 */
	function convertLinksToIDForest() {
		let rootIDs = Object.keys(self.links).filter(id => self.functions[self.links[id].getSnippetID()].type === "gen");

		let forest = rootIDs.map(id => createSubtree(self.links[id], id));

		return forest;

		// helper method
		function createSubtree(link, linkID) {
			let inputs = {};

			for (let input of Object.keys(link.inputs)) {
				inputs[input] = {
					drawn: false,
					state: link.inputs[input].state
				};
			}

			let child = link.getChild();

			let position = {
				x: child.sage2_x,
				y: child.sage2_y,
				width: child.sage2_width,
				height: child.sage2_height
			};

			return {
				linkID,
				appID: child.state.snippetsID,
				position: position,
				snippetID: link.getSnippetID(),
				children: child.childLinks.map((child) => {
					return createSubtree(child, Object.keys(self.links).find(id => self.links[id] === child));
				}),
				inputs
			};
		}
	}


	function initializeSnippetAssociations(info) {
		let appPromises = [];
		self.dataCount = info.dataCount;
		self.visCount = info.visCount;

		for (let app of info.apps) {
			appPromises.push(new Promise(function(resolve, reject) {
				self.loadingApps[app.snippetsID] = resolve;
			}));
		}

		Promise.all(appPromises)
			.then(function() {
				handleReloadedSnippetAssociations(info);
			});
	}

	// Link class used by SAGE2_CodeSnippets
	const Link = (function() {
		let curator = self; // alias enclosing scope's 'self'

		return function(parent, child, transformID) {
			let self = {
				parent,
				child,
				transformID,
				log: [],

				inputs: {},
				inputInit: {}
			};

			let publicObject = {
				update,
				setParent,
				getParent,
				setChild,
				getChild,
				getSnippetID,
				setInputInitialValues,
				getInputInitialValues,

				// expose inputs object for now
				inputs: self.inputs,
				log: self.log
			};

			init();

			function init() {
				// update();
			}

			function getParent() {
				return self.parent;
			}

			function setParent(parent) {
				self.parent = parent;
			}

			function getChild() {
				return self.child;
			}

			function setChild(child) {
				self.child = child;
			}

			function updateChildren(data) {
				// propagates from within app
				self.child.updateDataset(data);
			}

			function getSnippetID() {
				return self.transformID;
			}

			function setInputInitialValues(vals) {
				self.inputInit = vals;
			}

			function getInputInitialValues() {
				return self.inputInit;
			}


			function appendConsoleToLog(...args) {
				self.log.push({
					type: "console",
					time: Date.now(),
					content: args.map(a => {

						if (a instanceof Object) {
							let string;
							try {
								// revisit how to handle sending objects
								// string = JSON.stringify(a).substring(0, 1500);

								// string = JSON.stringify(SAGE2_SnippetsUtil.summarizeJSON(a));
								string = JSON.stringify(jsonSummary.summarize(a, {arraySampleCount: 100}));
							} catch (e) {
								// console.log(e);

								string = "[object Object]";
							}

							return string;
						}

						return a;
					}).join(" ")
				});

				// console.log(transformID, self.log);
				snippetLogsUpdated(transformID);
			}

			function appendErrorToLog(err) {
				self.log.push({
					type: "error",
					time: Date.now(),
					content: {
						message: err.message,
						stack: err.stack,
						name: err.name
					}
				});

				// console.log(transformID, self.log);
				snippetLogsUpdated(transformID);
			}

			/**
			 * Handles passing information between applications and calling functions based on
			 * the function type. This function is used to update all children of an app when the app is updated.
			 *
			 * @method update
			 */
			function update() {
				let p = self.parent;
				let c = self.child;
				let id = self.transformID;

				let logger = {
					log: appendConsoleToLog,
					error: appendErrorToLog
				};

				let dataset;

				if (curator.functions[id].type === "gen") {
					dataset = c.getDataset();
				} else {
					dataset = p.getDataset();
				}

				let parameters = [
					c, // child app
					dataset, // dataset input to function
					updateChildren, // 'next' function to pass data to the following function
					publicObject, // link reference for API
					logger // logger which overrides console.log to capture output
				];

				try {
					// call the function
					curator.functions[id].code.call(...parameters);
				} catch (err) {
					// display and log any caught errors
					c.displayError(err);

					appendErrorToLog(err);
				}

			}

			return publicObject;
		};
	}());

	return {
		init,

		getNewFunctionID,
		updateFunctionDefinition,

		getFunctionInfo,
		saveSnippet,
		cloneSnippet,
		loadFromFile,
		sourceFileUpdated,

		requestSnippetLoad,
		notifySnippetClosed,

		createDataApplication,
		createVisApplication,
		createViewApplication,
		createBlockPath,

		handleActionFromUI,
		displayApplicationLoaded,
		outputAppClosed,
		getAppAncestry,
		drawAppAncestry,
		executeCodeSnippet,

		registerSnippetListApp,
		unregisterSnippetListApp,
		notifyUserListClick,
		notifyUserDataClick,

		requestSnippetsProjectExport,
		convertLinksToIDForest,
		initializeSnippetAssociations,
		updateSavedSnippetAssociations
	};
}());


