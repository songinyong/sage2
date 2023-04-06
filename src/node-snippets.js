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

const fs = require("fs");
const path = require("path");

let SnippetsManager = (function() {
	return function(communication, sysConfig) {
		let config = (sysConfig.experimental && (sysConfig.experimental.vissnippets || {})) || {};
		// private
		let self = {
			comm: communication, // { broadcast, clients }
			config,

			loaded: {},
			associations: {
				dataCount: 0,
				visCount: 0,
				apps: [],
				links: []
			},
			status: [],

			logging: config.logging ? config.logging : false // true
		};

		init();

		function init() {
			if (self.logging) {
				let logpath = sysConfig.folders.user.path;
				let filename = `snippetlog-${Date.now()}.txt`;

				self.logfile = path.join(logpath, filename);
			}
		}

		function initializeSnippetsClient(wsio) {
			wsio.emit("updateSnippetAssociations", self.associations);
		}

		function getDependencies() {
			return self.config.libraries || [];
		}

		function getLoadedSnippetInfo() {
			return self.loaded;
		}

		function addLoadedSnippet(info) {
			self.loaded[info.filename] = info;

			// console.trace(info);
		}

		function updateSnippetAssociations(associations) {
			self.associations = associations;

			self.comm.broadcast("updateSnippetAssociations", self.associations);

			self.logging && log();
		}

		function getSnippetAssociations() {
			return self.associations;
		}

		function updateFunctionStatus(status) {
			self.status = status;

			self.logging && log();
		}

		function displayClientConnect(wsio) {
			// load existing snippets
			for (let filename of Object.keys(self.loaded)) {
				wsio.emit("createSnippetFromFileWithID", self.loaded[filename]);
			}

			// send the snippet associations
			wsio.emit("initializeSnippetAssociations", self.associations);
		}

		function sageUIClientConnect(wsio) {
			wsio.emit("editorReceiveSnippetStates", self.status);
		}

		function log() {
			let logentry = {
				timestamp: Date.now(),
				assocations: self.associations,
				snippets: self.status
			};

			fs.appendFile(self.logfile, JSON.stringify(logentry) + "\n", err => {
				if (err) {
					throw err;
				}

				// file written successfully
			});
		}

		// public
		return {
			initializeSnippetsClient,
			getDependencies,

			getLoadedSnippetInfo,
			addLoadedSnippet,

			updateSnippetAssociations,
			getSnippetAssociations,
			updateFunctionStatus,

			displayClientConnect,
			sageUIClientConnect
		};
	};
}());

module.exports = SnippetsManager;
