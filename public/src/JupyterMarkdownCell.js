//
// SAGE2 application: JupyterLab
// by: Andrew Burks <andrewtburks@gmail.com>
//
// Copyright (c) 2015
//
/* global md */

"use strict";

var JupyterMarkdownCell = SAGE2_App.extend({
	init: function (data) {
		// Create div into the DOM
		this.SAGE2Init("div", data);
		// Set the DOM id
		this.element.id = "div_" + data.id;
		// Set the background to black
		this.element.style.backgroundColor = 'white';
		this.element.style.fontFamily = "'Arimo'";
		this.element.style.padding = `${2 * this.config.ui.titleTextSize}px`;
		this.element.style.fontSize = `${this.config.ui.titleTextSize}px`;
		this.element.style.boxSizing = "border-box";
		this.element.style.overflowY = "auto";

		let {
			index,
			cell
		} = data.state;

		this.content = document.createElement("div");

		this.content.innerHTML = md.render(
			Array.isArray(cell.source) ? cell.source.join("") : cell.source
		);

		this.element.appendChild(this.content);

		this.updateTitle("Jupyter Markdown Cell");

		this.cellLabel = document.createElement("div");
		this.cellLabel.style.position = "absolute";
		this.cellLabel.style.left = 0;
		this.cellLabel.style.bottom = 0;

		this.cellLabel.style.background = "#a6cee3";
		this.cellLabel.style.padding = "2px 4px 4px 8px";
		this.cellLabel.style.borderRadius = "0 8px 0 0";
		this.cellLabel.style.boxShadow = "2px -1px 6px 1px #6668";
		this.cellLabel.style.color = "#333";
		this.cellLabel.style.fontFamily = "'Arimo'";

		this.cellLabel.innerHTML = cell.cell_type +
			` <span style="font-family: 'Courier New';font-weight:bold;">[${+index + 1}]</span>`;

		this.element.appendChild(this.cellLabel);

		// move and resize callbacks
		this.resizeEvents = "continuous"; // onfinish
		// this.moveEvents   = "continuous";
		// this.resize = "fixed";

		// SAGE2 Application Settings
		// Not adding controls but making the default buttons available
		this.controls.finishedAddingControls();
		this.enableControls = true;
	},

	load: function (date) {
		// console.log('JupyterLab> Load with state value', this.state.value);
		this.refresh(date);
	},

	draw: function (date) {
		// console.log('JupyterLab> Draw with state value', this.state.value);
	},

	toggleShowCode: function () {
		this.codeVisible = !this.codeVisible;

		if (this.codeVisible && this.state.code) {
			this.codeView.style.opacity = 1;
		} else {
			this.codeView.style.opacity = 0;
		}
	},

	getContextEntries: function () {
		var entries = [];

		entries.push({
			description: "Copy Source",
			callback: "SAGE2_copyURL",
			parameters: {
				url: Array.isArray(this.state.cell.source) ? this.state.cell.source.join("") : this.state.cell.source
			}
		});

		// Show overlay with EXIF data
		// entries.push({
		//   description: "Show Code",
		//   callback: "toggleShowCode",
		//   parameters: {}
		// });

		return entries;
	},

	updateContent: function (data, date) {
		// update title with nb/cell name
		// this.updateTitle("JupyterLab Cell - " + data.title);

		let { cell } = this.state;

		this.element.innerHTML = md.render(
			Array.isArray(cell.source) ? cell.source.join("") : cell.source
		);
	},

	resize: function (date) {
		// Called when window is resized
		// this.img.style.width = this.sage2_width + "px";
		// this.img.style.height = this.sage2_height + "px";

		// this.refresh(date);
	},

	move: function (date) {
		// Called when window is moved (set moveEvents to continuous)
		this.refresh(date);
	},

	quit: function () {
		// Make sure to delete stuff (timers, ...)
	},

	event: function (eventType, position, user_id, data, date) {
		if (eventType === "pointerPress" && (data.button === "left")) {
			// click
		} else if (eventType === "pointerMove" && this.dragging) {
			// move
		} else if (eventType === "pointerRelease" && (data.button === "left")) {
			// click release
		} else if (eventType === "pointerScroll") {
			// Scroll events for zoom
			this.element.scrollTop += data.wheelDelta;
		} else if (eventType === "widgetEvent") {
			// widget events
		} else if (eventType === "keyboard") {
			if (data.character === "m") {
				this.refresh(date);
			}
		} else if (eventType === "specialKey") {
			if (data.code === 37 && data.state === "down") {
				// left
				this.refresh(date);
			} else if (data.code === 38 && data.state === "down") {
				// up
				this.refresh(date);
			} else if (data.code === 39 && data.state === "down") {
				// right
				this.refresh(date);
			} else if (data.code === 40 && data.state === "down") {
				// down
				this.refresh(date);
			}
		} else if (eventType === "dataUpdate") {
			this.state.index = data.ind;
			this.state.cell = data.cell;

			this.updateContent(data, date);
		}
	}
});
