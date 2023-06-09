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

/* global d3 */

let SAGE2_SnippetsUtil = (function() {
	let self = {
		// config for Summarized JSON printer
		indentation: " ", // or "\t"
		indentCount: 2,
		showExampleValue: true,
		maxLevel: 4
	};

	// utility function to extract overall json structure without printing entire data object
	function summarizeJSON(data) {
		let summary = summarizeItem(data);

		// clean up the marking
		unmarkObject(data);

		return summary;
	}

	function summarizeItem(item) {
		let summarize = {
			Array: (arr) => {
				let summarized = {};

				summarized.type = "Array";
				summarized.length = arr.length;

				// recurse to items in the array
				if (arr.length) {
					summarized.items = {
						0: summarizeItem(arr[0])
					};
				}

				return summarized;
			},
			Object: (obj) => {
				let summarized = {};

				summarized.type = "Object";
				summarized.keys = Object.keys(obj);

				summarized.items = {};

				for (let key of summarized.keys) {
					summarized.items[key] = summarizeItem(obj[key]);
				}

				return summarized;
			},
			Other: (data) => {
				return {
					type: typeof data,
					example: data
				};
			}
		};

		let type = "Other";

		if (item instanceof Array) {
			type = "Array";
		} else if (item instanceof Object) {
			type = "Object";
		}

		if (item && item["*snippets_mark*"]) {
			return {
				type: type,
				circular: true
			};
		} else {
			// marked as visited to make sure it doesn't hit a circular structure
			if (type !== "Other") {
				Object.defineProperty(item, "*snippets_mark*", {
					enumerable: false,
					writable: true,
					configurable: true
				});
				item["*snippets_mark*"] = true;
			}

			return summarize[type](item);
		}
	}

	function unmarkObject(obj) {
		if (obj && obj["*snippets_mark*"]) {
			delete obj["*snippets_mark*"];

			// recurse to the next level
			if (obj instanceof Array && obj.length) {
				unmarkObject(obj[0]);
			} else if (obj instanceof Object) {
				for (let key of Object.keys(obj)) {
					unmarkObject(obj[key]);
				}
			}
		} else {
			// stop becuase it's unmarked (either a primitive or it's a circular ref already cleared)
		}
	}

	// utility function to stringify the summary output from summarizeJSON
	function printSummarizedJSON(summary) {
		// start at 0 indentation
		return printSummaryLevel(summary, 0);
	}

	function printSummaryLevel(data, l) {
		let string = "";

		if (data.circular) {
			string += wrapInHTML("(circular reference)", "circular");
		} else if (data.type === "Object") {
			string += "{";

			let keys = data.keys.map(k => `'${k}'`).join(", ");

			string += wrapInHTML(keys, "keys");

			let childStrings = data.keys.map(key => {
				return printSummaryLevel(data.items[key], l + 1);
			});

			if (childStrings.length) {
				let childStringCombined = "\n";

				for (let i = 0; i < data.keys.length; i++) {
					childStringCombined += self.indentation.repeat((l + 1) * self.indentCount);

					childStringCombined += wrapInHTML(data.keys[i], "name") + ": ";

					childStringCombined += childStrings[i];

					if (i < data.keys.length - 1) {
						childStringCombined += ",";
					}

					childStringCombined += "\n";
				}

				childStringCombined += self.indentation.repeat(l * self.indentCount);

				string += wrapInHTML(childStringCombined, "child");
			}

			string += "}";

			string = wrapInHTML(string, "layer");

		} else if (data.type === "Array") {
			// string += "[]";
			// string += `[ ${data.length ? `(${data.length}×)` : "∅"} `;
			string += wrapInHTML(`(${data.length})`, "length") + ` [`;

			if (data.length) {
				let needsNewlines = data.items["0"].type === "Object" || data.items["0"].type === "Array";

				if (needsNewlines) {
					string += "\n" + self.indentation.repeat((l + 1) * self.indentCount);
				}

				string += printSummaryLevel(data.items["0"], l + 1);

				if (needsNewlines) {
					string += "\n" + self.indentation.repeat(l * self.indentCount);

				}
			}

			string += "]";

			// string = wrapInHTML(string, "layer");
		} else {
			console.log(data);
			if (data.example == null || data.example == undefined) {
				string += wrapInHTML("?", "type");
			} else {
				string += wrapInHTML(data.type, "type");
			}

			if (self.showExampleValue) {
				string += wrapInHTML(data.example, "value", data.type);
			}
		}

		return string;
	}

	function wrapInHTML(value, role, type) {
		let tags = {
			type: `<span class="json-summary json-summary-type json-summary-type-${value}">&lt;${value}&gt;</span>`,
			value: `<span class="json-summary json-summary-value json-summary-value-${type}">${value}</span>`,
			name: `<span class="json-summary json-summary-name">${value}</span>`,
			length: `<span class="json-summary json-summary-length">${value}</span>`,
			circular: `<span class="json-summary json-summary-circular">${value}</span>`,
			layer: `<span class="json-summary json-summary-checkbox">
					<input type="checkbox">
					<span class="json-summary-checkboxmarker" onclick="(function(me){
						me.parentNode.classList.toggle('checked');console.log('click');
					})(this)"></span>
				</span><div class="json-summary json-summary-layer">${value}</div>`,
			child: `<div class="json-summary json-summary-child">${value}</div>`,
			keys: `<span class="json-summary json-summary-keys">${value}</span>`
		};

		return tags[role];
	}

	return {
		summarizeJSON,
		printSummarizedJSON
	};
}());
