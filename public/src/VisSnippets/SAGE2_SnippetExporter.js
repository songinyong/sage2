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

/**
 * A tool which exposes export functionality required to make SAGE2 Code Snippets
 * running on the wall into a portable html file.
 */
let SAGE2_SnippetExporter = (function() {
	// fetch the same CodeSnippetInput script used in display (for consisentency)
	let snippetInputsCode;
	let getSnippetsInputCode = new XMLHttpRequest();
	getSnippetsInputCode.onload = function() {
		snippetInputsCode = getSnippetsInputCode.responseText;
	};
	getSnippetsInputCode.open("GET", "./src/VisSnippets/CodeSnippetInput.js");
	getSnippetsInputCode.send();

	// fetch the same snippetinput.css stylesheet used in display (for consisentency)
	let snippetInputsStyle;
	let getSnippetsInputStyle = new XMLHttpRequest();
	getSnippetsInputStyle.onload = function() {
		snippetInputsStyle = getSnippetsInputStyle.responseText;
	};
	getSnippetsInputStyle.open("GET", "./css/snippetinput.css");
	getSnippetsInputStyle.send();

	// CSS for styling the export pieces
	let snippetBlockStyle = `
		html, body {
			box-sizing: border-box;
			padding: 0;
			margin: 0;
			background-color: #ddd;
		}

		#content {
			display: flex;
			height: 100vh;
			flex-direction: row;
			align-items: center;
		}

		#inspector {
			display: none;
			flex-basis: 500px;
			max-width: 550px;
			flex: 0 0 auto;
			flex-direction: column;

			padding: 10px;
			margin: 10px;
			height: 85%;
			font-family: 'Lucida Console', Monaco, monospace;
			font-size: 12px;

			text-align: left;
			background-color: white;
			border: 1px solid lightgray;

			position: relative;
		}

		#inspector .title {
			top: 0;
			padding: 10px;
			font-weight: 700;
			font-size: 14px;
			border-radius: 3px;
		}

		#inspector .title .closeButton {
			margin-left: 20px;
			cursor: pointer;
			float: right;

			margin: -3px 0;
			padding: 3px 7px;
			background-color: white;
			border-radius: 2px;
			border: 1px solid black;
		}

		#inspector .title .closeButton:hover {
			color: white;
			border-color: white;
			background-color: #cb181d;
		}

		#inspector .title.gen {
			background-color: #b3e2cd;
			border: 2px solid #87d1b0;
		}

		#inspector .title.data {
			background-color: #cbd5e8;
			border: 2px solid #9db0d3;
		}

		#inspector .title.draw {
			background-color: #fdcdac;
			border: 2px solid #fba76d;
		}

		#inspector .code {
			flex: 1;
			margin-top: 20px;
			// padding: 10px 15px;
			white-space: pre;
			overflow-y: scroll;

			border: 1px solid #cfcfcf;
			border-radius: 2px;
			background: #f7f7f7;
		}

		#inspector .code .prettyprint {
			border: none;
			padding: 10px 15px;
			margin: 0;
			border-radius: 3px;
		}

		#notebook {
			display: flex;
			flex-direction: column;
			flex: 1 1 auto;
			overflow: auto;
			height: 100vh;
			max-height: 100vh;
			background-color: #eee;
		}

		#top {
			display: flex;
			align-items: stretch;
			margin: 15px 5%;
			flex-shrink: 0;
		}

		#top .snippetElement {
			flex-basis: 275px;
			margin: 0 3px;
		}

		#bottom {
			text-align: center;
		}

		.snippetElement {
			display: inline-block;
			padding: 8px;
			/* margin: 8px; */
			/* border-radius: 5px; */
			/* box-shadow: 0 0 10px 2px grey; */
			background-color: white;
			border: 1px solid lightgray;
		}

		.snippetElement.fullWidth {
			min-width: 90%;
			float: none;
			text-align: center;
			margin: 3px 0;
		}

		.snippetElement:target {
			background-color: #ffffe5;
			animation: highlight-anchored 1s;
		}

		.snippetElementContent {
			display: flex;
			align-items: stretch;
			justify-content: space-around;
		}

		.snippetVisElement {
			display: inline-block;
			background: white;
			overflow: hidden;
			margin: 10px;
			order: -1;
		}

		.snippetInputWrapper {
			display: inline-block;
			width: 275px;
			margin: 10px;
		}

		.fullWidth .snippetInputWrapper {
			border: 1px solid gray;
			background: white;
			text-align: left;
		}

		.snippetElementTitle {
			text-align: left;
			font-family: 'Lucida Console', Monaco, monospace;
			font-weight: 700;
			padding: 8px;
			// border-radius: 3px;
			// background-color: white;
			// box-shadow: inset 0 0 5px 1px gray;

			border: 1px solid #cfcfcf;
			border-radius: 2px;
			background: #f7f7f7;
			// line-height: 1.21429em;
			color: green;
		}

		.snippetElementTitle .arrow {
			color: black;
		}

		.snippetElementTitle .cellID {
			font-weight: bolder;
			cursor: default;
		}

		.snippetElementTitle .funcName {
			cursor: zoom-in;
		}

		.snippetElementTitle .funcName:not(:last-child):after {
			content: ' > ';
		}

		.snippetElementTitle .IDref {
			cursor: pointer;
		}

		.snippetElementTitle .gen {
			color: #6ec79f;
		}

		.snippetElementTitle .data {
			color: #839bc7;
		}

		.snippetElementTitle .draw {
			color: #fa9149;
		}

		@keyframes highlight-anchored {
			0% {
				background-color: #f7fcb9;
			}
			
			100% {
				background-color: #ffffe5;
			}
		}

	`.replace(/\t\t/gi, "");

	// API script to handle SAGE2 snippets API calls
	let snippetScriptAPI = `
		// get a reference to a globally defined SAGE2 Object
		var SAGE2 = SAGE2 || {};
		let ui = {
			titleBarHeight: 20
		};

		let outputNum = 0;

		// IIFE to instantiate SAGE2 snippets API calls
		(function() {
			// console.log(CodeSnippetInput.create({type: "text", name: "textField"}));
			// console.log(CodeSnippetInput.create({type: "checkbox", name: "checkboxBool"}));
			/*
			* SAGE2.SnippetInput API
			*
			* Break parameters for the function into input specification and link
			*
			*/
			SAGE2.SnippetInput = function(specification, link) {
				let { type } = functions[link.snippetID];

				if (!link.snippetElement) {
					createSnippetElement(link);
				}

				if (!link.snippetsInputWrapper) {
					link.snippetsInputWrapper = link.snippetContent.append("div")
						.attr("class", "snippetInputWrapper")
						.node();
				}

				if (!link.inputs[specification.name].drawn) {
					// create new input element if this doesn't exist
					let newInput = CodeSnippetInput.create(specification);
					newInput.onUpdate = function() {
						runFunction[type](link.data, link, link.ancestry);
					}

					link.inputs[specification.name] = newInput;

					// create input element on app
					let inputDiv = d3.select(link.snippetsInputWrapper).append("div")
						.attr("id", specification.name)
						.style("font-size", ui.titleBarHeight * 0.5 + "px")
						.attr("class", "snippetsInputDiv");

					inputDiv.append("div")
						.attr("class", "snippetsInputLabel")
						.style("margin-top", ui.titleBarHeight * 0.25 + "px")
						.text(specification.name);

					inputDiv
						.each(function() {
							// create the input element based on the Element's specification
							link.inputs[specification.name].createInputElement(d3.select(this));
						});
					
					link.inputs[specification.name].drawn = true;
				}

				// return state value
				return link.inputs[specification.name].state;
			};

			/*
			* SAGE2.SnippetVisElement API
			*
			* Break parameters for the function into outputElement specification and parent element
			*
			*/
			SAGE2.SnippetVisElement = function(specification, link) {
				let { type } = specification;

				if (link.snippetVisElement && link.snippetsVisElement.tagName !== type) {
					link.snippetsVisElement.remove();
					delete link.snippetsVisElement;
				}

				if (!link.snippetElement) {
					createSnippetElement(link);
				}

				// set size to leave space for the inputs
				// let elementWidth = app.inputsOpen ? app.sage2_width - 300 : app.sage2_width;

				// if the app doesn't have a vis element, create one
				if (!link.snippetsVisElement) {
					// add svg and supplementary info

					link.snippetElement.classed("fullWidth", true);

					let el = link.snippetElement.remove().node();

					d3.selectAll("#bottom").select(function() { return this.appendChild(el); });

					link.snippetsVisElement = link.snippetContent.append(type)
						.attr("class", "snippetVisElement")
						.node();
				}

				// in all cases, set the size of the vis element
				d3.select(link.snippetsVisElement).each(function() {
					if (type === "svg") {
						d3.select(this)
							.attr("width", 600).attr("height", 450);
					} else {
						d3.select(this)
							.style("width", "600px")
							.style("height", "450px");
					}
				});

				// return the element and size
				return {
					elem: link.snippetsVisElement,
					width: 600,
					height: 450
				};
			};

			/*
			* SAGE2.SnippetTimeout API
			*
			* Specification includes time in ms
			*
			*/
			SAGE2.SnippetTimeout = function(specification, link) {
				let { time } = specification;

				// clear existing update timer if it exists
				if (link.timeout) {
					clearTimeout(link.timeout);
				}

				// create and save new timeout
				link.timeout = setTimeout(function() {
					let { type } = functions[link.snippetID];

					runFunction[type](link.data, link, link.ancestry);
				}, time);
			};

			function createSnippetElement(link) {
				let funcOrder = link.ancestry.concat(link.snippetID).map(function(f) {
					if (functions[f]) {
						return '<span class=funcName ' + functions[f].type + '>' + functions[f].desc + '</span>'
					} else {
						let link = "#output" + f;
						return "<a class='IDref' href='" + link + "'>[" + f + "]</a>" 
					}
				});

				link.outputInd = outputNum++;

				console.log("createSnippetElement", link);
				let div = d3.select("#top").append("div")
					.attr("class", "snippetElement")
					.attr("id", "output" + link.outputInd)
					.style("order", link.outputInd);

				let title = div.append("div")
					.attr("class", "snippetElementTitle")

				title.append("span")
					.attr("class", "cellID")
					.text("[" + link.outputInd + "]: ");
				
					// .html("<span class='cellID'>[" + link.outputInd + "]: </span>" +
					// 	funcOrder.join(" <span class='arrow'>&#9656;</span> "))

				title.selectAll(".funcName")
					.data(link.ancestry.concat(link.snippetID))
				.enter().append("span")
					.attr("class", "funcName")
				.html(function(f) {
						if (functions[f]) {
							d3.select(this).classed(functions[f].type, true)
								.on("click", () => {
									let inspector = d3.select("#inspector").style("display", "flex");

									inspector.select(".codeTitle")
										.text(functions[f].desc);

									inspector.select(".title")
										.attr("class", "title " + functions[f].type);

									inspector.select(".code .prettyprint")
										.text(functions[f].text)
										.classed("prettyprinted", false);

										PR.prettyPrint();
								});

							return functions[f].desc;
						} else {
							let link = "#output" + f;
							return "<a class='IDref' href='" + link + "'>[" + f + "]</a>" 
						}
					});

				link.snippetContent = div.append("div")
					.attr("class", "snippetElementContent")

				link.snippetElement = div;
			}
		}());
	`.replace(/\t\t/gi, "");

	/**
	 * Function to create the new window and populate it with the snippets from the wall,
	 * as well as inject all necessary css for the layout and js for the runtime.
	 *
	 * @method createTypedScriptText
	 * @param {Object} functions - the information about the functions (id, type, desc, code)
	 * @param {Object} links - the runtime associations of the functions being exported
	 */
	function generateScriptFromWall(functions, links, dependencies) {
		console.log(functions, links, dependencies);

		let newWindow = window.open();
		let newDocument = newWindow.document;

		// add necessary css for input elements
		var inputCSS = document.createElement("style");
		inputCSS.id = "style-inputs";
		inputCSS.innerHTML = snippetInputsStyle;
		newDocument.head.appendChild(inputCSS);

		// add necessary css for input elements
		var snippetElemCSS = document.createElement("style");
		snippetElemCSS.id = "style-blocks";
		snippetElemCSS.innerHTML = snippetBlockStyle;
		newDocument.head.appendChild(snippetElemCSS);

		let scripts = {
			gen: newDocument.createElement("script"),
			data: newDocument.createElement("script"),
			draw: newDocument.createElement("script")
		};

		let mainScript = newDocument.createElement("script");
		let utilScript = newDocument.createElement("script");
		let inputScript = newDocument.createElement("script");
		let downloadScript = newDocument.createElement("script");

		for (let type of Object.keys(scripts)) {
			scripts[type].text = createTypedScriptText(
				functions.filter(f => f.type === type)
			);

			scripts[type].id = "codeSnippets-" + type;
			scripts[type].async = false;
		}

		mainScript.text = createMainScriptText(links);
		mainScript.id = "codeSnippets-main";
		mainScript.async = false;
		mainScript.onload = newWindow.run;

		inputScript.text = snippetInputsCode;
		inputScript.id = "codeSnippets-input";
		inputScript.async = false;

		utilScript.text = snippetScriptAPI;
		utilScript.id = "codeSnippets-util";
		utilScript.async = false;

		downloadScript.text = createDownloadScriptText();
		downloadScript.id = "codeSnippets-download";
		downloadScript.async = false;

		let prettyPrint = newDocument.createElement("script");
		prettyPrint.type = "text/javascript";
		prettyPrint.async = false;
		prettyPrint.src = "https://cdn.rawgit.com/google/code-prettify/master/loader/run_prettify.js?&amp;lang=js";
		// prettyPrint.src = "https://cdn.rawgit.com/google/code-prettify/master/loader/run_prettify.js?skin=sunburst&amp;lang=js";

		newDocument.head.appendChild(prettyPrint);

		// add d3 to new page
		let d3Script = newDocument.createElement("script");
		d3Script.type = "text/javascript";
		d3Script.async = false;
		d3Script.src = "https://d3js.org/d3.v4.min.js";

		if (dependencies.length === 0) {
			d3Script.onload = loadRest();
		}

		newDocument.head.appendChild(d3Script);

		for (let ind in dependencies) {
			let script = newDocument.createElement("script");
			script.type = "text/javascript";
			script.async = false;
			script.src = dependencies[ind];

			if (ind == dependencies.length - 1) {
				console.log("onload", ind);
				script.onload = loadRest;
			}

			newDocument.head.appendChild(script);
		}

		// load all other text scripts
		function loadRest() {
			newDocument.body.appendChild(downloadScript);

			newDocument.head.appendChild(scripts.gen);
			newDocument.head.appendChild(scripts.data);
			newDocument.head.appendChild(scripts.draw);

			newDocument.head.appendChild(inputScript);
			newDocument.head.appendChild(utilScript);
			newDocument.head.appendChild(mainScript);

			// run the program once the new scripts are all added
			newWindow.run();
		}

		// ======================================================
		// helper functions for creating scripts

		/**
		 * Function to create script contents for subsets of functions.
		 * This is used to separate by snippet type.
		 *
		 * @method createTypedScriptText
		 * @param {Object} functions - the information about the functions (id, type, desc, code)
		 */
		function createTypedScriptText(functions) {
			let scriptText = `
				var functions = functions || {};
				console.log(document.currentScript.id, "Loaded");
				`.replace(/\t\t\t/gi, "");

			for (let func of functions) {
				scriptText += `\n
					functions["${func.id}"] = {
						type: "${func.type}",
						desc: "${func.desc}",
						text: \`${func.text.replace(/`/gi, "\\`").replace(/\$/gi, "\\$")}\`,
						code: ${func.code}
					}`.replace(/\t\t\t\t/gi, "");
			}

			return scriptText;
		}

		/**
		 * Function to create the "main" script, which takes the snippet associations and initializes
		 * the tool, as well as handles running the code in the right order.
		 *
		 * @method createMainScriptText
		 * @param {Object} links - assocations between snippets (call hierarchy).
		 */
		function createMainScriptText(links) {
			return `
				var functions = functions || {};

				let linkForest;
				console.log(document.currentScript.id, "Loaded");

				let runFunction = {
					gen: function (input, link) {
						let func = functions[link.snippetID];

						// save data for re-execution
						// link.data = input;

						// call function
						func.code.call(link, link.data || [], link)
							.then(function(result) {
								link.data = result;
								let prevParam = link.outputInd !== undefined ? [link.outputInd] : [link.snippetID];
								invokeChildFunctions(result, link.children, prevParam);
							})
					},
					data: function(input, link, prevFunctions) {
						let func = functions[link.snippetID];

						link.data = input;
						link.ancestry = prevFunctions;

						let result = func.code.call(link, input, link);

						let prevParam = link.outputInd !== undefined ? [link.outputInd] : prevFunctions.concat(link.snippetID);

						invokeChildFunctions(result, link.children, prevParam);
					},
					draw: function(input, link, prevFunctions) {
						let func = functions[link.snippetID];

						link.data = input;
						link.ancestry = prevFunctions;

						func.code.call(link, input, link);
					}
				}

				init();

				function init() {
					linkForest = ${JSON.stringify(links)};

					console.log("Init Done", functions);
					console.log("Links", linkForest);

				}

				function invokeChildFunctions(data, children, prevFunctions) {

					for (let child of children) {
						let { type } = functions[child.snippetID];

						runFunction[type](data, child, prevFunctions);
					}
				}

				function run() {
					let content = d3.select("body").append("div").attr("id", "content");
					let notebook = content.append("div").attr("id", "notebook");
					notebook.append("div").attr("id", "top");
					notebook.append("div").attr("id", "bottom");

					let inspector = content.append("div").attr("id", "inspector");
					let title = inspector.append("div").attr("class", "title");
					title.append("span").attr("class", "codeTitle");
					title.append("span").attr("class", "closeButton")
						.text("X")
						.on("click", () => inspector.style("display", "none"));


					inspector.append("div").attr("class", "code").append("pre").attr("class", "prettyprint linenums");

					// for each root, invoke the function
					for (let root of linkForest) {
						let { type } = functions[root.snippetID];
						root.ancestry = [];

						runFunction[type](null, root);
					}
				}`.replace(/\t\t\t\t/gi, "");

			// replace is to unindent the code and make it readable in the output
			// since string template preserves extra 4 tab indentation from this file's src
		}

		/**
		 * Function to create the download button script (creates the download button to handle download)
		 * which will remove itself before file download.
		 *
		 * @method createDownloadScriptText
		 */
		function createDownloadScriptText() {
			return `
				let downloadWrapper = document.createElement("div");
				let downloadButton = document.createElement("input");

				downloadButton.type = "button";
				downloadButton.value = "Download Project";
				downloadButton.onclick = download;

				downloadWrapper.style.position = "fixed";
				downloadWrapper.style.zIndex = "50";

				downloadButton.style.backgroundColor = "#b9e1f1";
				downloadButton.style.border = "3px solid rgba(42, 165, 213, 0.25)";
				downloadButton.style.padding = "8px";
				downloadButton.style.margin = "8px";
				downloadButton.style.borderRadius = "5px";
				downloadButton.style.fontSize = "16px";
				downloadButton.style.cursor = "pointer";
				downloadButton.style.boxShadow = "0 0 25px 5px gray";

				document.body.innerHTML += "<style>#notebook {padding-top: 50px; height: calc(100vh - 50px)}</style>"
				
				downloadWrapper.appendChild(downloadButton);
				document.body.appendChild(downloadWrapper);

				function download() {
					// create dom clone in order to clear body for download
					let domCopy = document.documentElement.cloneNode(true);
					let body = domCopy.getElementsByTagName("body")[0];
					body.innerHTML = "";
					body.setAttribute("onload", "run()");

					// restore prettyprint script which removes itself and remove stylesheet..
					let prettyPrint = document.createElement("script");
					prettyPrint.type = "text/javascript";
					prettyPrint.async = false;
					prettyPrint.src = "https://cdn.rawgit.com/google/code-prettify/master/loader/run_prettify.js?&amp;lang=js";
					
					let head = domCopy.getElementsByTagName("head")[0];
					head.getElementsByTagName("link")[0].remove();
					head.appendChild(prettyPrint);

					var element = document.createElement('a');
					element.setAttribute('href', 'data:text/html;charset=utf-8,' 
					+ encodeURIComponent(domCopy.outerHTML));
					element.setAttribute('download', "snippetsOutput.html");

					element.style.display = 'none';
					document.body.appendChild(element);

					element.click();

					document.body.removeChild(element);
					domCopy.remove();
				}`.replace(/\t\t\t\t/gi, "");
		}
	}

	return {
		generateScriptFromWall
	};
}());

