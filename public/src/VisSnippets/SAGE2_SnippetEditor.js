// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014-17

"use strict";

/* global ace d3 displayUI interactor wsio SAGE2_SnippetExporter CodeSnippetCompiler snippetOverlayManager SAGE2_SnippetsUtil jsonSummary */

let SAGE2_SnippetEditor = (function () {
	// api examples to be inserted in the editor
	let apiExamples = {
		SnippetVisElement: `let { elem, width, height } = SAGE2.SnippetVisElement({ type: "svg" });`,
		SnippetInput: {
			Checkbox: `let checkbox = SAGE2.SnippetInput({
		name: "my_checkbox", // name your input element
		type: "checkbox",
		defaultVal: false // an *optional* default value for the input
	});`,
			Text: `let textfield = SAGE2.SnippetInput({
		name: "my_textInput", // name your input element
		type: "text",
		defaultVal: "foo" // an *optional* default value for the input
	});`,
			Radio: `let radiogroup = SAGE2.SnippetInput({
		name: "my_radio", // name your input element
		type: "radio",
		options: ['one', 'two', 'three'],
		defaultVal: 'one' // an *optional* default value for the input
	});`,
			Range: `let slider = SAGE2.SnippetInput({
		name: "my_slider", // name your input element
		type: "range",
		range: [1, 20],
		step: 1,
		defaultVal: 1 // an *optional* default value for the input
	});`
		},
		SnippetTimeout: `SAGE2.SnippetTimeout({time: 500}); // 500ms timeout`
	};

	return function (targetID, config) {
		let self = {
			config: config.experimental && config.experimental.vissnippets ? config.experimental.vissnippets : {},
			div: null,

			editorDiv: null,
			editor: null,

			overlayCheckbox: null,
			interactCheckbox: null,

			changed: false,
			closeButton: null,

			saveButton: null,
			descInput: null,

			copyButton: null,
			loadButton: null,

			scriptDropdown: null,

			snippetList: null,

			log: null,
			errorLogContainer: null,
			consoleLogContainer: null,

			errorLogFilter: null,
			consoleLogFilter: null,

			loadedSnippet: "new",
			loadedSnippetType: null,

			scriptStates: {},

			apiHelper: null
		};



		// don't initialize
		if (self.config.enabled) {
			init();
		} else {
			document.getElementById("codeContainer").style.display = "none";

		}


		/**
		 * Sets up editor, loadscript, newscript controls
		 *
		 * @method init
		 */
		function init() {
			// get overall wrapper div
			self.div = document.getElementById(targetID);

			// set up editor
			self.editorDiv = self.div.querySelector("#snippetEditor");
			self.editor = ace.edit(self.editorDiv);

			self.editor.setOptions({
				printMargin: false,
				fontSize: "16px"
			});

			// set style and javascript syntax
			self.editor.setTheme("ace/theme/monokai");
			self.editor.getSession().setMode("ace/mode/javascript");

			self.editor.commands.addCommand({
				name: "saveFile",
				bindKey: {
					win: "Ctrl-S",
					mac: "Command-S",
					sender: "editor|cli"
				},
				exec: function(env, args, request) {
					saveScript();
				}
			});

			self.editor.on("change", function(e) {
				if (!self.changed) {
					updateIsChanged(true);
				}
			});

			self.overlayCheckbox = self.div.querySelector("#snippetsOverlayCheckbox");
			self.overlayCheckbox.onclick = function(e) {
				snippetOverlayManager.setOverlayVisibility(e.target.checked);
			};

			// self.interactCheckbox = self.div.querySelector("#snippetsInteractingCheckbox");
			// self.interactCheckbox.onclick = function(e) {
			// 	snippetOverlayManager.setInteractMode(e.target.checked);
			// };

			// bind hide and close button
			// self.div.querySelector("#snippetEditorHide").onclick = hideEditor; // remove hide function
			self.closeButton = self.div.querySelector("#snippetEditorClose");
			self.closeButton.onclick = closeScript;

			// bind hide action to click on overlay
			self.div.querySelector(".overlay").onclick = hideEditor;

			// bind save action
			self.saveButton = self.div.querySelector("#snippetEditorSave");
			self.saveButton.onclick = saveScript;

			// script name entry, save on Enter
			self.descInput = self.div.querySelector("#snippetDescription");
			self.descInput.onkeyup = function(e) {
				if (e.keyCode === 13) {
					saveScript();
				}
			};

			// bind new script type buttons
			self.div.querySelector("#newSnippetGen").onclick = function () {
				unloadScript();
				startNewScript("gen");
			};
			self.div.querySelector("#newSnippetData").onclick = function () {
				unloadScript();
				startNewScript("data");
			};
			self.div.querySelector("#newSnippetDraw").onclick = function () {
				unloadScript();
				startNewScript("draw");
			};

			// ready script selector dropdown
			self.scriptDropdown = self.div.querySelector("#loadSnippetOptions");

			self.snippetList = self.div.querySelector("#snippetListWrapper .list-content");

			self.errorLogContainer = self.div.querySelector("#errorMessages");
			self.consoleLogContainer = self.div.querySelector("#consoleMessages");

			// api helper element
			self.apiHelper = self.div.querySelector("#snippetApiOptions");
			addApiHelperOptions(apiExamples, self.apiHelper);

			self.div.querySelector("#exportProject").onclick = requestProjectExport;

			startNewScript("gen");
		}

		// handles editor visibility
		function openEditor() {
			self.config.enabled && self.div.classList.add("open");
		}

		function hideEditor() {
			self.config.enabled && self.div.classList.remove("open");
		}

		function editorIsOpen() {
			return self.config.enabled && self.div.classList.contains("open");
		}


		/**
		 * Handles setting the state value regarding whether there are unsaved changes to the snippet,
		 * then updates the interface visually reflecting the state.
		 *
		 * @method updateIsChanged
		 */
		function updateIsChanged(isChanged) {
			self.changed = isChanged;

			// update UI

			if (isChanged) {
				self.closeButton.classList.add("unsaved");
				// self.closeButton.style.color = "red";
			} else {
				self.closeButton.classList.remove("unsaved");
				// self.closeButton.style.color = "white";
			}
		}

		/**
		 * Handles unloading a script when the close button is clicked
		 *
		 * @method closeScript
		 */
		function closeScript() {
			let close = !self.changed || confirm("Your Snippet has unsaved changes. Close anyway?");
			if (close) {
				unloadScript();
				startNewScript(self.loadedSnippetType);
				hideEditor();
			}
		}

		/**
		 * Sends snippet information to the display client to be reloaded and updated
		 *
		 * @method saveScript
		 */
		function saveScript() {
			// save script into current file, or create new file if one does not exist (new)

			// first test if it has syntax errors
			try {
				CodeSnippetCompiler.createFunction(self.loadedSnippetType, self.editor.getValue());

				wsio.emit('editorSaveSnippet', {
					author: interactor.user.label,
					text: self.editor.getValue(),
					type: self.loadedSnippetType,
					desc: self.descInput.value ? self.descInput.value : self.loadedSnippetType + " snippet",
					scriptID: self.loadedSnippet
				});

				updateIsChanged(false);

			} catch (err) {
				self.errorLogContainer.innerHTML = "";

				let errorDiv = document.createElement("div");
				errorDiv.className = "message";
				errorDiv.innerText = `${err}`;

				self.errorLogContainer.append(errorDiv);
			}
		}

		/**
		 * Requests a copy be made of the selected snippet
		 *
		 * @method saveCopy
		 */
		function saveCopy(id) {
			// if -> script !== new, clone that script with any current changes in new file
			// then open new file in editor (will be sent through wsio)

			if (self.loadedSnippet !== "new") {
				unloadScript();
			}

			wsio.emit('editorCloneSnippet', {
				author: interactor.user.label,
				scriptID: id
			});
		}

		/**
		 * Releases control of a loaded snippet so other users may edit it
		 *
		 * @method unloadScript
		 */
		function unloadScript() {
			// unlock script for others
			if (self.loadedSnippet !== "new") {
				wsio.emit('editorSnippetCloseNotify', {
					scriptID: self.loadedSnippet
				});
			}
		}

		/**
		 * Requests the snippet load based on the script selector and handles unload of current snippet
		 *
		 * @method loadScript
		 */
		function loadScript(id) {
			// make sure to unload a snippet if another is already loaded
			if (self.loadedSnippet !== "new") {
				unloadScript();
			}

			wsio.emit('editorSnippetLoadRequest', {
				scriptID: id
			});
		}

		/**
		 * Loads the starter code for each script type into the editor
		 *
		 * @method startNewScript
		 * @param {String} type - gen, data, or draw snippet type
		 */
		function startNewScript(type) {


			if (type === "draw") {
				self.editor.setValue(`// function drawSnippet (data, next) {
	// write your code here:\n\tlet { elem, width, height } = SAGE2.SnippetVisElement({ type: "svg" });
		
	// optional initial output value for linking operations
	next([]);
//}`);
			} else if (type === "gen") {
				self.editor.setValue(`// function generatorSnippet (previousData, next) {
	// write your code here:
	let newData = [];
	
	next(newData);
//}`);
			} else {
				self.editor.setValue(`// function dataSnippet (data, next) {
	// write your code here:
	let newData = data;
	
	next(newData);
//}`);
			}

			self.editor.setReadOnly(false);
			self.editor.clearSelection();

			// can save a new script
			self.saveButton.classList.remove("disabled");

			self.loadedSnippet = "new";
			self.loadedSnippetType = type;

			self.descInput.value = '';
			updateIsChanged(false);

			// clear log
			showLogMessages({});
		}

		/**
		 * Populate the API dropdown with the template names
		 *
		 * @method addApiHelperOptions
		 */
		function addApiHelperOptions(examples, parent) {
			for (let key of Object.keys(examples)) {
				let newOption = document.createElement("div");
				let name = document.createElement("span");

				newOption.className = "dropdownOption";

				if (typeof examples[key] === "string") {
					newOption.onclick = function() {
						insertApiCall(examples[key]);
					};

				} else { // recurse if it finds an object
					let optionList = document.createElement("div");
					optionList.className = "dropdownOptionList right";

					newOption.classList.add("controlDropdown");

					addApiHelperOptions(examples[key], optionList);

					newOption.appendChild(optionList);
				}

				name.innerHTML = key;

				newOption.appendChild(name);
				parent.appendChild(newOption);
			}
		}

		/**
		 * Loads the starter code for each script type into the editor
		 *
		 * @method insertApiCall
		 * @param {String} type - Helper control to add a SAGE2 Snippets API Call at the cursor
		 */
		function insertApiCall(text) {
			self.editor.insert(text);
		}

		/**
		 * Updates selector with the existing snippets and their states
		 *
		 * @method updateSnippetStates
		 * @param {Object} scriptStates - The loaded snippet information, based on name, type, editors, etc.
		 */
		function updateSnippetStates(scriptStates) {
			// update saved states and clear existing options
			self.scriptStates = scriptStates;
			// self.scriptDropdown.innerHTML = ""; // This works to remove options... real method removing one-by-one was failing

			// self.snippetList.innerHTML = "";

			let list = d3.select(self.snippetList);

			let listBind = list.selectAll(".list-item")
				.data(Object.values(scriptStates), d => d.id);

			listBind.exit().remove();

			listBind.enter().append("div").attr("class", d => "list-item " + d.type)
				.each(function(d) {
					let item = d3.select(this);

					item.append("div")
						.attr("class", "snippet-name")
						.text(d.desc);

					let controls = item.append("div")
						.attr('class', "action-icons");

					controls.append("i")
						.attr("class", "fas fa-play")
						.on("click", function() {
							let newAction = {
								action: "execute",
								snippetID: d.id,
								type: d.type
							};

							snippetOverlayManager.setInteractMode(true);
							snippetOverlayManager.setUserSelectedAction(newAction);

							hideEditor();
						});

					controls.append("i")
						.attr("class", "fas fa-copy")
						.on("click", function() {
							saveCopy(d.id);
						});

					controls.append("i")
						.attr("class", "fas fa-folder-open")
						.on("click", function() {
							if (d.id !== self.loadedSnippet && !d.locked) {
								loadScript(d.id);
							}
						});
				});

			list.selectAll(".list-item")
				.classed("open", d => self.loadedSnippet === d.id)
				.each(function(d) {
					let item = d3.select(this);

					item.select(".snippet-name")
						.text(d.desc);

					item
						.select(".fa-folder-open")
						.classed("disabled", d.locked)
						.on("click", function() {
							if (d.id !== self.loadedSnippet && !d.locked) {
								loadScript(d.id);
							}
						});
				});

			snippetOverlayManager.updateSnippetStates(scriptStates);
		}

		/**
		 * Updates selector with the existing snippets and their states
		 *
		 * @method getSnippetStates
		 */
		function getSnippetStates(scriptStates) {
			return self.scriptStates;
		}

		/**
		 * Handles receiving a requested snippet and populating the editor
		 *
		 * @method receiveLoadedSnippet
		 * @param {Object} data - The snippet text, id, and type information
		 */
		function receiveLoadedSnippet(data) {

			// next cursor position
			let cursorPosition = {row: 0, column: 0};

			// retain position if the loaded snippet is the same as the current
			if (data.scriptID === self.loadedSnippet) {
				cursorPosition = self.editor.getCursorPosition();
			}

			self.editor.setValue(data.text);
			self.editor.moveCursorToPosition(cursorPosition);
			self.editor.clearSelection();

			self.descInput.value = data.desc;

			self.loadedSnippet = data.scriptID;
			self.loadedSnippetType = data.type;

			// if the editor is closed, open it
			openEditor();
			updateIsChanged(false);
		}

		/**
		 * Releases control of a snippet for when the page is navigated away from
		 *
		 * @method browserClose
		 */
		function browserClose() {
			if (self.loadedSnippet !== "new") {
				unloadScript();
			}
		}

		function requestProjectExport() {
			wsio.emit("editorRequestSnippetsExport");
		}

		/**
		 * Passes project export information into the SnippetExporter for download
		 *
		 * @method receiveProjectExport
		 * @param {Object} data - The project export information (functions and links)
		 */
		function receiveProjectExport(data) {
			// hand off project information to exporter
			// SAGE2_SnippetExporter.generateScriptFromWall(
			// 	data.functions,
			// 	data.links,
			// 	self.config.external_dependencies || []
			// );

			let exportData = {
				meta: {
					time: (new Date()).toISOString(),
					from: window.location.origin,
					external_dependencies: self.config.external_dependencies
					// instructions: "To open this file, go to ..."
				},
				snippets: data.functions,
				links: data.links
			};

			let DL_link = document.createElement("a");
			document.body.appendChild(DL_link);
			let fileName = `VisSnippets-Export_${exportData.meta.time}.json`;

			DL_link.download = fileName;
			DL_link.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, undefined, 2));


			DL_link.click();
			document.body.removeChild(DL_link);
		}


		/**
		 * Recieves and updates the error and console logs from a snippet
		 *
		 * @method receiveSnippetLog
		 * @param {Object} data - The log from a snippet's execution
		 */
		function receiveSnippetLog(data) {
			self.log = data.log;

			let apps = Object.keys(data.log);

			// sort out filters for apps

			// if the currently selected app is not in the list of app logs, reset the filters
			if (apps.indexOf(self.consoleLogFilter) === -1) {
				self.consoleLogFilter = null;
			}

			if (apps.indexOf(self.errorLogFilter) === -1) {
				self.errorLogFilter = null;
			}

			let errorFiltersContainer = self.errorLogContainer.parentElement.querySelector(".log-filter");
			let consoleFiltersContainer = self.consoleLogContainer.parentElement.querySelector(".log-filter");

			let errorFiltersTitle = errorFiltersContainer.querySelector(".log-filter-value");
			let consoleFiltersTitle = consoleFiltersContainer.querySelector(".log-filter-value");

			errorFiltersTitle.innerText = self.errorLogFilter || "All";
			consoleFiltersTitle.innerText = self.consoleLogFilter || "All";

			let errorFilters = errorFiltersContainer.querySelector(".log-filter-options");
			let consoleFilters = consoleFiltersContainer.querySelector(".log-filter-options");

			errorFilters.innerHTML = "";
			consoleFilters.innerHTML = "";

			// add option to show "All" apps
			let errorOptionAll = document.createElement("div");
			let consoleOptionAll = document.createElement("div");

			errorOptionAll.className = "filter-option";
			consoleOptionAll.className = "filter-option";

			errorOptionAll.innerText = "All";
			consoleOptionAll.innerText = "All";

			errorOptionAll.onclick = function() {
				self.errorLogFilter = null;
				errorFiltersTitle.innerText = "All";

				showLogMessages(data.log);
			};


			consoleOptionAll.onclick = function() {
				self.consoleLogFilter = null;
				consoleFiltersTitle.innerText = "All";

				showLogMessages(data.log);
			};

			errorFilters.appendChild(errorOptionAll);
			consoleFilters.appendChild(consoleOptionAll);

			// add an option for each app
			for (let app of apps) {
				let errorOption = document.createElement("div");
				let consoleOption = document.createElement("div");

				errorOption.className = "filter-option";
				consoleOption.className = "filter-option";

				errorOption.innerText = app;
				consoleOption.innerText = app;


				errorOption.onclick = function() {
					self.errorLogFilter = app;
					errorFiltersTitle.innerText = app;

					showLogMessages(data.log);
				};

				consoleOption.onclick = function() {
					self.consoleLogFilter = app;
					consoleFiltersTitle.innerText = app;

					showLogMessages(data.log);
				};

				errorFilters.appendChild(errorOption);
				consoleFilters.appendChild(consoleOption);
			}

			showLogMessages(data.log);
		}

		function showLogMessages(log) {
			let apps = Object.keys(log);

			let errors = [];
			let consoleLog = [];

			for (let appID of apps) {
				for (let entry of log[appID]) {
					try {
						entry.content = JSON.parse(entry.content);
					} catch (err) {
						// isn't a json format
					}

					if (entry.type === "console") {
						consoleLog.push(Object.assign({ appID }, entry));
					} else {
						errors.push(Object.assign({ appID }, entry));
					}
				}
			}

			if (self.errorLogFilter) {
				errors = errors.filter(message => message.appID === self.errorLogFilter);
			}

			if (self.consoleLogFilter) {
				consoleLog = consoleLog.filter(
					message => message.appID === self.consoleLogFilter
				);
			}

			errors.sort((a, b) => a.time - b.time);
			consoleLog.sort((a, b) => a.time - b.time);

			self.errorLogContainer.innerHTML = "";
			self.consoleLogContainer.innerHTML = "";

			// create error entries
			for (let el in errors) {
				let logEntry = errors[el];

				let message = document.createElement("div");
				message.className = "message";

				let timestamp = document.createElement("div");
				timestamp.className = "timestamp";
				timestamp.innerText = new Date(logEntry.time).toLocaleTimeString();

				let content = document.createElement("div");
				content.className = "content";
				content.innerText = `${logEntry.content.name}: ${logEntry.content.message}`;

				let source = document.createElement("div");
				source.className = "source";
				source.innerText = `(${logEntry.appID})`;

				message.appendChild(timestamp);
				message.appendChild(content);
				message.appendChild(source);

				self.errorLogContainer.appendChild(message);

				self.errorLogContainer.scrollTop =
					self.errorLogContainer.scrollHeight;
			}

			// create console entries
			for (let el in consoleLog) {
				let logEntry = consoleLog[el];

				let message = document.createElement("div");
				message.className = "message";

				// message.innerText = log.content;

				let timestamp = document.createElement("div");
				timestamp.className = "timestamp";
				timestamp.innerText = new Date(logEntry.time).toLocaleTimeString();

				let content = document.createElement("div");
				content.className = "content";

				let source = document.createElement("div");
				source.className = "source";
				source.innerText = `(${logEntry.appID})`;

				if (logEntry.content instanceof Object) {
					content.innerHTML = jsonSummary.printSummary(logEntry.content, {theme: "light"});
					// content.innerHTML = SAGE2_SnippetsUtil.printSummarizedJSON(logEntry.content);

					content.style.flexBasis = "100%";

					message.style.flexWrap = "wrap";
					message.style.justifyContent = "space-between";

					message.appendChild(timestamp);
					message.appendChild(source);
					message.appendChild(content);
				} else {
					content.innerHTML = logEntry.content;

					message.appendChild(timestamp);
					message.appendChild(content);
					message.appendChild(source);
				}


				self.consoleLogContainer.appendChild(message);

				self.consoleLogContainer.scrollTop = self.consoleLogContainer.scrollHeight;
			}
		}

		return {
			open: openEditor,
			hide: hideEditor,
			isOpen: editorIsOpen,

			updateSnippetStates,
			getSnippetStates,

			receiveLoadedSnippet,
			receiveProjectExport,
			receiveSnippetLog,

			browserClose
		};
	};
}());
