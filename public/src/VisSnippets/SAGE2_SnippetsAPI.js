"use strict";
// get a reference to a globally defined SAGE2 Object
var SAGE2 = SAGE2 || {};

/* global d3 CodeSnippetInput SAGE2_CodeSnippets */

// IIFE to instantiate SAGE2 snippets API calls
(function() {

	/*
	 * SAGE2.SnippetInput API
	 *
	 * Break parameters for the function into input specification and link
	 *
	 */
	SAGE2.SnippetInput = function(specification, link) {

		// throw error if name or type is missing
		if (!specification.name) {
			throw new ReferenceError("'name' not found in SAGE2.SnippetInput specification");
		}
		if (!specification.type) {
			throw new ReferenceError("'type' not found in SAGE2.SnippetInput specification");
		}

		if (!link.inputs[specification.name]) {
			// create new input element if this doesn't exist

			// take initialization values if applicable
			let initVals = link.getInputInitialValues();
			if (initVals && initVals[specification.name]) {
				specification.defaultVal = initVals[specification.name].state;
			}

			let newInput = CodeSnippetInput.create(specification);
			newInput.onUpdate = function() {
				SAGE2_CodeSnippets.updateSavedSnippetAssociations();
				link.update();
			};

			link.inputs[specification.name] = newInput;

			// create input element on app
			let inputDiv = link.getChild().inputs.append("div")
				.attr("id", specification.name)
				.style("font-size", ui.titleBarHeight * 0.5 + "px")
				.attr("class", "snippetsInputDiv");

			inputDiv.append("div")
				.attr("class", "snippetsInputLabel")
				// .style("font-size", ui.titleBarHeight * 0.5 + "px")
				.style("margin-top", ui.titleBarHeight * 0.25 + "px")
				.text(specification.name);

			inputDiv
				.each(function() {
					// create the input element based on the Element's specification
					link.inputs[specification.name].createInputElement(d3.select(this));
				});
		} else {
			// otherwise, update existing element if it does exist

			// throw error if input of a certain name changes type
			if (link.inputs[specification.name].spec.type !== specification.type) {
				throw new TypeError("'type' of SAGE2.SnippetInput is immutable");
			}

			link.inputs[specification.name].spec = specification;

			// remove existing input element on app
			// d3.select(link.getChild().inputs).select("#" + specification.name).remove();
		}

		return link.inputs[specification.name].state;
	};

	/*
	 * SAGE2.SnippetVisElement API
	 *
	 * Break parameters for the function into outputElement specification and parent element
	 *
	 */
	SAGE2.SnippetVisElement = function(specification, app) {
		let {type} = specification;

		if (app.snippetsVisElement && app.snippetsVisElement.tagName !== type) {
			app.snippetsVisElement.remove();
			delete app.snippetsVisElement;
		}

		// set size to leave space for the inputs
		let elementWidth = app.state.inputsOpen ? app.sage2_width - 300 : app.sage2_width;

		// if the app doesn't have a vis element, create one
		if (!app.snippetsVisElement) {
			app.snippetsVisElement = app.content
				.append(type)
				.style("position", "absolute")
				.style("left", 0)
				.style("top", 0)
				.style("background", "white")
				.style("box-sizing", "border-box").node();
		}
		// in all cases, reset the size of the vis element
		d3.select(app.snippetsVisElement).each(function() {
			if (type === "svg") {
				d3.select(this)
					.attr("width", elementWidth)
					.attr("height", app.sage2_height - (ui.titleBarHeight * 1.5));
			} else {
				d3.select(this)
					.style("width", (elementWidth) + "px")
					.style("height", (app.sage2_height - (ui.titleBarHeight * 1.5)) + "px");
			}
		});

		return {
			elem: app.snippetsVisElement,
			width: elementWidth,
			height: app.sage2_height - ui.titleBarHeight * 1.5
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
		link.timeout = setTimeout(link.update, time);
	};

	SAGE2.RequireData = function(attributes, app) {

	};
}());
