// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2016

"use strict";

/* global showdown hljs*/

var quickNote = SAGE2_App.extend({
	init: function(data) {
		this.SAGE2Init("div", data);

		this.resizeEvents = "continuous"; // "onfinish";

		this.element.id = "div" + data.id;
		this.backgroundChoice = "lightyellow";

		// Separate div since the html will be contantly edited with showdown
		this.markdownDiv = document.createElement("div");
		// Add a CSS class so we can style the text in the css file
		this.markdownDiv.classList.add("showdown");
		// Control position and size
		this.markdownDiv.style.position = "absolute";
		this.markdownDiv.style.top      = "0";
		this.markdownDiv.style.left     = "0";
		this.markdownDiv.style.width    = "100%";
		this.markdownDiv.style.height   = "100%";
		// padding: top, right, bottom, and left
		// or global value, here 1/2 line
		this.markdownDiv.style.padding = ui.titleTextSize + "px";
		this.markdownDiv.style.margin = 0;
		// Default font size based on SAGE2 settings
		this.markdownDiv.style.fontSize = ui.titleTextSize + "px";
		this.markdownDiv.style.boxSizing = "border-box";
		this.markdownDiv.style.listStylePosition = "inside";
		// Support for overflow
		this.markdownDiv.style.overflow = "auto";
		this.element.appendChild(this.markdownDiv);
		// Keep a copy of the title
		this.noteTitle = "";

		// Add highlight extension before making converter
		this.makeHighlightExtension();
		// Make a converter
		this.showdown_converter = new showdown.Converter({
			emoji: true,
			simpleLineBreaks: true,
			simplifiedAutoLink: true,
			headerLevelStart: 2,
			extensions: ['codehighlight']
		});

		// If loaded from session, this.state will have meaningful values.
		this.setMessage(this.state);
		var _this = this;
		// If it got file contents from the sever, then extract.
		if (data.state.contentsOfNoteFile) {
			this.parseDataFromServer(data.state.contentsOfNoteFile);
		} else if (this.state.contentsOfNoteFile) {
			this.parseDataFromServer(this.state.contentsOfNoteFile);
		} else if (data.customLaunchParams) {
			// if it was passed additional init values
			data.customLaunchParams.serverDate = new Date(Date.now());
			_this.setMessage(data.customLaunchParams);
		}
		this.adjustFontSize();
		this.showOrHideArrow();
		window.requestAnimationFrame(() => {
			this.adjustForInitialSize();
		});
	},

	adjustForInitialSize: function() {
		// The point of this is that the original size of a note doesn't always show
		// the entirely of it, making it difficult to read
		let components = this.markdownDiv.children;
		let totalHeight = 0;
		let largestWidth = 0;
		for (let i = 0; i < components.length; i++) {
			totalHeight += parseInt(window.getComputedStyle(components[i]).height) + 1;
			if (parseInt(window.getComputedStyle(components[i]).width) > largestWidth) {
				largestWidth = parseInt(window.getComputedStyle(components[i]).width) + 1;
			}
		}
		// If the needed height is larger than the sage2 height, adjust to include.
		// Maybe ratio is bad, some lines can't be joined together.
		if (totalHeight > this.sage2_height) {
			// Keep note resize within wall height.
			let totalWallHeight = ui.json_cfg.totalHeight;
			if (totalHeight > totalWallHeight) {
				totalHeight = totalWallHeight - ui.titleBarHeight * 2;
				if (largestWidth <= this.sage2_width + ui.titleBarHeight) {
					largestWidth = this.sage2_width * 2;
				}
			}
			wsio.emit("updateApplicationPositionAndSize", { appPositionAndSize: {
				elemId: this.id,
				elemLeft: this.sage2_x,
				elemTop: this.sage2_y,
				elemWidth: largestWidth,
				elemHeight: totalHeight
			}});

		}
	},

	makeHighlightExtension: function () {
		// Prevent multiple creations of the same extension.
		if (showdown.hasLoadedCustomHighlightExtension) {
			return;
		}
		showdown.hasLoadedCustomHighlightExtension = true;
		// add extension
		showdown.extension('codehighlight', function() {
			function htmlunencode(text) {
				return (
					text
						.replace(/&amp;/g, '&')
						.replace(/&lt;/g, '<')
						.replace(/&gt;/g, '>')
				);
			}
			return [
				{
					type: 'output',
					filter: function (text, converter, options) {
						var left  = '<pre><code\\b[^>]*>',
							right = '</code></pre>',
							flags = 'g',
							replacement = function (wholeMatch, match, left, right) {
								match = htmlunencode(match);
								return left + hljs.highlightAuto(match).value + right;
							};
						return showdown.helper.replaceRecursiveRegExp(text, replacement, left, right, flags);
					}
				}
			];
		});
	},

	/**
	Currently assumes that file from server will contain three lines.
	1st: creator and timestamp
	2nd: color for note
	3rd: content for note
	*/
	parseDataFromServer: function(fileContentsFromServer) {
		var fileData  = {};
		fileData.fileDefined = true;
		fileData.clientName  = fileContentsFromServer.substring(0, fileContentsFromServer.indexOf("\n"));
		// Remove first line
		fileContentsFromServer  = fileContentsFromServer.substring(fileContentsFromServer.indexOf("\n") + 1);
		fileData.colorChoice    = fileContentsFromServer.substring(0, fileContentsFromServer.indexOf("\n"));
		// Remove second line
		fileContentsFromServer  = fileContentsFromServer.substring(fileContentsFromServer.indexOf("\n") + 1);
		// The rest is to be displayed
		fileData.clientInput    = fileContentsFromServer;
		this.setMessage(fileData);
	},

	/**
	msgParams.clientName	Client input pointer name
	msgParams.clientInput	What they typed for the note.
	*/
	setMessage: function(msgParams) {
		// If defined by a file, use those values
		if (msgParams.fileDefined === true) {
			this.element.style.background = msgParams.colorChoice;
			this.state.colorChoice  = msgParams.colorChoice;
			this.backgroundChoice   = msgParams.colorChoice;
			this.state.creationTime = msgParams.clientName;
			this.formatAndSetTitle(this.state.creationTime);
			// Seems to create a loop
			// this.saveNote(msgParams.creationTime);
		} else {
			// else defined by load or user input
			// Otherwise set the values using probably user input.
			if (msgParams.clientName === undefined ||
				msgParams.clientName === null ||
				msgParams.clientName == "") {
				// Could be anon
				msgParams.clientName = "";
			}
			// If the color choice was defined, use the given color.
			if (msgParams.colorChoice !== undefined &&
				msgParams.colorChoice !== null &&
				msgParams.colorChoice !== "") {
				this.element.style.background = msgParams.colorChoice;
				this.backgroundChoice  = msgParams.colorChoice;
				this.state.colorChoice = msgParams.colorChoice;
			}
			// client input state set as part of the clean
			this.state.clientName  = msgParams.clientName;
			this.state.colorChoice = this.backgroundChoice;
			// if the creationTime has not been set, then fill it out.
			if (this.state.creationTime === null
				&& msgParams.serverDate !== undefined
				&& msgParams.serverDate !== null) {
				this.state.creationTime = new Date(msgParams.serverDate);
				// Remove the unicode charaters from client name because used in the file name
				var cleanName = msgParams.clientName.replace(/[^\x20-\x7F]/g, "").trim();
				// build the title string
				var titleString = cleanName + "-QN-" + this.state.creationTime.getFullYear();
				if (this.state.creationTime.getMonth() < 9) {
					titleString += "0";
				}
				// month +1 because starts at 0
				titleString += (this.state.creationTime.getMonth() + 1) + "";
				if (this.state.creationTime.getDate() < 10) {
					titleString += "0";
				}
				titleString += this.state.creationTime.getDate() + "-";
				if (this.state.creationTime.getHours() < 10) {
					titleString += "0";
				}
				titleString += this.state.creationTime.getHours();
				if (this.state.creationTime.getMinutes() < 10) {
					titleString += "0";
				}
				titleString += this.state.creationTime.getMinutes();
				if (this.state.creationTime.getSeconds() < 10) {
					titleString += "0";
				}
				titleString += this.state.creationTime.getSeconds();
				if (this.state.creationTime.getMilliseconds() < 10) {
					titleString += "0";
				}
				if (this.state.creationTime.getMilliseconds() < 100) {
					titleString += "0";
				}
				titleString += this.state.creationTime.getMilliseconds();
				// store it for later and update the tile.
				this.state.creationTime = titleString;
				this.formatAndSetTitle(this.state.creationTime);
			}
			// if loaded will include the creationTime
			if (msgParams.creationTime !== undefined && msgParams.creationTime !== null) {
				this.formatAndSetTitle(msgParams.creationTime);
			}
		}

		// set the text, currently innerHTML matters to render <br> and allow for html tags
		this.state.clientInput = msgParams.clientInput;
		this.lastClientInput = this.state.clientInput;
		if (msgParams.useMarkdown === false) {
			// replace is only first match without regex
			let newLinesAsBr = msgParams.clientInput.replace(/\n/gi, "<BR>");
			this.markdownDiv.innerHTML = newLinesAsBr;
		} else {
			this.markdownDiv.innerHTML = this.showdown_converter.makeHtml(msgParams.clientInput);
		}

		// save if didn't come from file
		if (msgParams.fileDefined !== true) {
			this.saveNote(msgParams.creationTime);
		}
	},

	setColor: function(responseObject) {
		this.backgroundChoice         = responseObject.color;
		this.state.colorChoice        = this.backgroundChoice;
		this.markdownDiv.style.background = responseObject.color;
		this.saveNote(responseObject.creationTime);
	},

	formatAndSetTitle: function(wholeName) {
		// Breaking apart whole name and using moment.js to make easier to read.
		// 0 name - 1 qn - 2 YYYYMMDD - 3 HHMMSSmmm
		var parts  = wholeName.split("-");
		var author = parts[0];
		var month  = parseInt(parts[2].substring(4, 6)); // YYYY[MM]
		var day    = parseInt(parts[2].substring(6, 8)); // YYYYMM[DD]
		var hour   = parseInt(parts[3].substring(0, 2)); // [HH]
		var min    = parseInt(parts[3].substring(2, 4)); // HH[MM]
		// Moment conversion
		var momentTime = {
			month: month - 1,
			day: day,
			hour: hour,
			minute: min
		};
		momentTime = moment(momentTime);
		// If the author is supposed to be Anonymouse, then omit author inclusion and marker.
		if (author === "Anonymous") {
			this.noteTitle = momentTime.format("MMM Do, hh:mm A");
		} else {
			// Otherwise have the name followed by @
			this.noteTitle = author + " @ " + momentTime.format("MMM Do, hh:mm A");
		}
		this.updateTitle(this.noteTitle);
	},

	load: function(date) {
		if ((this.state.clientInput !== undefined)
			&& (this.state.clientInput !== null)
			&& (this.state.clientInput != this.lastClientInput)) {
			this.setMessage({
				clientName:   this.state.clientName,
				clientInput:  this.state.clientInput,
				colorChoice:  this.state.colorChoice,
				creationTime: this.state.creationTime
			});
			this.adjustFontSize();
			this.showOrHideArrow();
		}
	},

	saveNote: function(date) {
		if (this.state.creationTime === null || this.state.creationTime === undefined) {
			return;
		}
		// This is what saves the state between sessions as far as can be determined.
		this.SAGE2UpdateAppOptionsFromState();
		this.SAGE2Sync(true);
		this.resize();
		// Tell server to save the file.
		var fileData = {};
		// Extension
		fileData.fileType = "note";
		// Fullname with extension
		fileData.fileName = this.state.creationTime + ".note";
		// What to save in the file
		fileData.fileContent = this.state.creationTime
			+ "\n"
			+ this.state.colorChoice
			+ "\n"
			+ this.state.clientInput;
		wsio.emit("saveDataOnServer", fileData);
		// save the state value
		this.state.contentsOfNoteFile = fileData.fileContent;
		// update the context menu with the current content
		if (!this.state.file) {
			this.state.file = fileData.fileName;
		}
		this.getFullContextMenuAndUpdate();
	},

	draw: function(date) {
	},

	resize: function(date) {
	},

	event: function(eventType, position, user_id, data, date) {
		// Font increase if alt is used with arrows
		if (data.status && data.status.ALT) {
			if (data.code === 40 && data.state === "down") {
				// arrow down
				this.adjustFontSize({ modifier: "decrease" });
			} else if (data.code === 38 && data.state === "down") {
				// arrow up
				this.adjustFontSize({ modifier: "increase" });
			}
		} else {
			// else scrolling
			if (data.code === 40 && data.state === "down") {
				// arrow down
				this.markdownDiv.scrollBy(0, ui.titleBarHeight * this.state.scale);
			} else if (data.code === 38 && data.state === "down") {
				// arrow up
				this.markdownDiv.scrollBy(0, -1 * ui.titleBarHeight * this.state.scale);
			} else if (data.code === 37 && data.state === "down") {
				// arrow left
				this.markdownDiv.scrollBy(-1 * ui.titleBarHeight * this.state.scale, 0);
			} else if (data.code === 39 && data.state === "down") {
				// arrow right
				this.markdownDiv.scrollBy(ui.titleBarHeight * this.state.scale, 0);
			}
		}
		if (eventType === "pointerScroll") {
			this.markdownDiv.scrollBy(0, data.wheelDelta);
		} else if (eventType === "pointerPress") {
			this.determineIfLinkIsClicked(Math.round(position.y), user_id);
		}
	},

	determineIfLinkIsClicked: function(y, user_id) {
		// Based on click location, need to determine if there was a link.
		let components = this.markdownDiv.getElementsByTagName("a");
		let totalOffsetTop, parentNode;
		for (let i = 0; i < components.length; i++) {
			totalOffsetTop = components[i].offsetTop;
			parentNode = components[i].parentNode;
			// Find the showdown container
			while (!parentNode.classList.contains("showdown")) {
				parentNode = parentNode.parentNode;
			}
			// Subtract scroll from container
			totalOffsetTop -= parentNode.scrollTop;

			if ((y > totalOffsetTop) && (y < totalOffsetTop + components[i].offsetHeight)) {
				wsio.emit("openNewWebpage", {
					id: this.id,
					url: components[i].href,
					position: [this.sage2_x + this.sage2_width + 5,
						this.sage2_y - this.config.ui.titleBarHeight],
					// Using webview instructions.json ratio and basing on this note's width
					dimensions: [this.sage2_width, this.sage2_width * 1440 / 1280]
				});
				break;
			}
		}
	},

	duplicate: function(responseObject) {
		if (isMaster) {
			this.launchAppWithValues("quickNote", {
				clientName: responseObject.clientName,
				clientInput: this.state.clientInput,
				colorChoice: this.state.colorChoice,
				scale: this.state.scale,
				showArrow: true
			},
			this.sage2_x + 100, this.sage2_y);
		}
	},

	/**
	* To enable right click context menu support this function needs to be present.
	*
	* Must return an array of entries. An entry is an object with three properties:
	*	description: what is to be displayed to the viewer.
	*	callback: String containing the name of the function to activate in the app. It must exist.
	*	parameters: an object with specified datafields to be given to the function.
	*		The following attributes will be automatically added by server.
	*			serverDate, on the return back, server will fill this with time object.
	*			clientId, unique identifier (ip and port) for the client that selected entry.
	*			clientName, the name input for their pointer. Note: users are not required to do so.
	*			clientInput, if entry is marked as input, the value will be in this property. See pdf_viewer.js for example.
	*		Further parameters can be added. See pdf_view.js for example.
	*/
	getContextEntries: function() {
		var entries = [];
		var entry;

		entry = {};
		entry.description = "Edit Note";
		entry.callback    = "SAGE2_editQuickNote";
		entry.parameters  = {
			currentContent:     this.state.clientInput,
			currentColorChoice: this.state.colorChoice
		};
		entries.push(entry);

		entries.push({description: "separator"});

		if (!this.isShowingArrow) {
			entry = {};
			entry.description = "Show arrow";
			entry.callback    = "showOrHideArrow";
			entry.parameters  = {status: "show"};
			entries.push(entry);
		} else {
			entry = {};
			entry.description = "Hide arrow";
			entry.callback    = "showOrHideArrow";
			entry.parameters  = {status: "hide"};
			entries.push(entry);
		}

		entries.push({description: "separator"});

		entry = {};
		entry.description = "Duplicate";
		entry.callback    = "duplicate";
		entry.parameters  = {};
		entries.push(entry);

		entries.push({description: "separator"});

		entry = {};
		entry.description = "Set Color";
		entry.children = [
			{
				description: "Blue",
				callback: "setColor",
				parameters: { color: "lightblue"},
				entryColor: "lightblue"
			},
			{
				description: "Yellow",
				callback: "setColor",
				parameters: { color: "lightyellow"},
				entryColor: "lightyellow"
			},
			{
				description: "Pink",
				callback: "setColor",
				parameters: { color: "lightpink"},
				entryColor: "lightpink"
			},
			{
				description: "Green",
				callback: "setColor",
				parameters: { color: "lightgreen"},
				entryColor: "lightgreen"
			},
			{
				description: "White",
				callback: "setColor",
				parameters: { color: "#f4f4f4"},
				entryColor: "#f4f4f4"
			},
			{
				description: "Orange",
				callback: "setColor",
				parameters: { color: "lightsalmon"},
				entryColor: "lightsalmon"
			}
		];
		entries.push(entry);

		entries.push({description: "separator"});

		entries.push({
			description: "Increase font size",
			accelerator: "Alt \u2191",     // up-arrow
			callback: "adjustFontSize",
			parameters: {
				modifier: "increase"
			}
		});
		entries.push({
			description: "Decrease font size",
			accelerator: "Alt \u2193",     // down-arrow
			callback: "adjustFontSize",
			parameters: {
				modifier: "decrease"
			}
		});

		entries.push({description: "separator"});

		entries.push({
			description: "Copy content to clipboard",
			callback: "SAGE2_copyURL",
			parameters: {
				url: this.state.clientInput
			}
		});

		entries.push({
			description: "Download Note",
			callback: "SAGE2_download",
			// parameters to prepare for downloading
			parameters: {
				url: '# ' + this.noteTitle + "\n\n" + this.state.clientInput + "\n",
				title: this.noteTitle,
				note: true
			}
		});

		return entries;
	},

	adjustFontSize: function(responseObject) {
		// if this is activated as part of a state update, skip the adjustment
		if (responseObject) {
			if (responseObject.modifier === "increase") {
				this.state.scale *= 1.2; // 20 percent increase good?
			} else if (responseObject.modifier === "decrease") {
				this.state.scale *= 0.8; // same reduction?
			}
		}
		this.markdownDiv.style.fontSize = parseInt(ui.titleTextSize * this.state.scale) + "px";

		this.getFullContextMenuAndUpdate();
		this.SAGE2Sync(true);
	},

	showOrHideArrow: function(responseObject) {
		if (!responseObject) { // state update
			if (this.state.showArrow) {
				this.addTopLeftArrowToWall();
			} else {
				this.hideTopLeftArrow();
			}
		} else {
			if (responseObject.status === "show") {
				this.addTopLeftArrowToWall();
				this.state.showArrow = true;
			} else if (responseObject.status === "hide") {
				this.hideTopLeftArrow();
				this.state.showArrow = false;
			}
			this.SAGE2Sync(true);
		}
	},

	addTopLeftArrowToWall: function() {
		if (this.hasLoadedTopLeftArrow) {
			if (!this.isShowingArrow) {
				this.arrow.style.display = "block";
				this.isShowingArrow = true;
				this.getFullContextMenuAndUpdate();
			}
			return;
		}
		this.hasLoadedTopLeftArrow = true;
		this.isShowingArrow = true;

		let arrow = document.createElement("img");
		arrow.style.position = "absolute";
		// keep aligned to top of window
		arrow.style.top = 0;
		// need to calculate size
		arrow.style.height = (ui.titleBarHeight * 1) + "px";
		// move it outside of the title bar
		arrow.style.left   = (ui.titleBarHeight * -1) + "px";
		arrow.src = "images/quickNote_leftArrow.svg";

		let titlebar = document.getElementById(this.id + "_title");
		titlebar.appendChild(arrow);
		titlebar.style.overflow = "visible";

		this.arrow = arrow;
		this.getFullContextMenuAndUpdate();
	},

	hideTopLeftArrow: function () {
		if (this.arrow) {
			this.arrow.style.display = "none";
			this.isShowingArrow = false;
		}
		this.getFullContextMenuAndUpdate();
	}

});
