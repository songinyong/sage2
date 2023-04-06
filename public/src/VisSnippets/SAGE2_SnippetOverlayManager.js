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

/* global ace d3 displayUI interactor wsio SAGE2_SnippetExporter CodeSnippetCompiler */

let SAGE2_SnippetOverlayManager = (function() {
	// snippet type color palette
	let lightColor = { gen: "#b3e2cd", data: "#cbd5e8", draw: "#fdcdac" };
	let darkColor = { gen: "#87d1b0", data: "#9db0d3", draw: "#fba76d" };

	return function(config) {
		let self = {
			showOverlay: false,
			overlay: d3.select("#snippetsOverlay"),

			appGroup: null,
			linkGroup: null,

			// appElements: null,

			snippetStates: null,

			associations: null,
			appMapping: null,

			snippetLinks: {},
			snippetApps: {},

			isInteracting: false,
			interactionCursor: null,

			dragAction: null,

			dragStartApp: null,
			dragStart: null,
			dragEnd: null,

			dragMarker: null,
			dragTargetMarker: null
		};

		init();

		function init() {
			self.overlay.attr(
				"viewBox",
				[
					0,
					0,
					config.totalWidth,
					config.totalHeight
				].join(", ")
			)
				.on("mousemove", function() {
					if (self.isInteracting) {
						self.interactionCursor
							.attr("transform", `translate(
								${d3.event.layerX * self.widthRatio},
								${d3.event.layerY * self.heightRatio})
							`);
					}

					if (self.dragAction && self.dragTargetMarker) {
						let current = {
							x: d3.event.layerX * self.widthRatio,
							y: d3.event.layerY * self.heightRatio
						};

						if (Math.abs(current.x - self.dragStart.x) > 100 || Math.abs(current.y - self.dragStart.y) > 100) {
							self.dragMarker && self.dragMarker.style("opacity", null);
							self.dragTargetMarker.style("opacity", null);
						}

						self.dragMarker && self.dragMarker
							.attr("d", calculateTaperedPath(self.dragStartApp, current));

						self.dragTargetMarker
							.attr("x", current.x - self.newAppDim / 2)
							.attr("y", current.y - self.newAppDim / 2)
							.attr("width", self.newAppDim)
							.attr("height", self.newAppDim);
					}
				})
				.on("mouseup", function() {
					d3.selectAll(".snippetDragStartTarget").classed("snippetDragStartTarget", false);

					if (self.dragAction) {
						// if the mouseup was not bubbled up from an app target
						if (!self.dragEnd) {
							self.dragEnd = {
								x: d3.event.layerX,
								y: d3.event.layerY,
								appID: null
							};
						}

						self.dragAction.source = self.dragStart.appID;
						self.dragAction.target = self.dragEnd.appID;
						self.dragAction.targetCenter = {
							x: self.dragEnd.x * self.widthRatio,
							y: self.dragEnd.y * self.heightRatio
						};

						// "dispatch" action
						console.log(self.dragAction);

						wsio.emit("editorSnippetActionPerformed", self.dragAction);

						self.dragAction = null;

						self.dragMarker && self.dragMarker.remove();
						self.dragMarker = null;

						self.dragTargetMarker.remove();
						self.dragTargetMarker = null;

						self.dragStart = null;
						self.dragStartApp = null;
						self.dragEnd = null;

						setInteractMode(false);
					}
				});

			self.width = +self.overlay.attr("width");
			self.height = +self.overlay.attr("height");

			self.widthRatio = config.totalWidth / self.width;
			self.heightRatio = config.totalHeight / self.height;

			self.titleBarOffset = config.ui.titleBarHeight;

			self.newAppDim = Math.min(config.totalWidth, config.totalHeight * 2) / 4;

			// self.appGroup = self.overlay.append("g");

			self.linkGroup = self.overlay.append("g")
				.attr("transform", `translate(0, ${config.ui.titleBarHeight})`);

			self.appGroup = self.overlay.append("g");

			self.interactionCursor = self.overlay.append("g")
				.attr("class", "snippetsInteractionCursor")
				.attr("transform", `translate(0, 0)`)
				.style("opacity", 0);

			self.interactionCursor.append("path")
				.attr("d", `M 0,0 L 25, ${-self.titleBarOffset} L 25, ${self.titleBarOffset} Z`)
				.style("fill", "#888")
				.style("stroke", "#000")
				.style("stroke-width", 2);

			let cursorRect = self.interactionCursor.append("rect")
				.attr("width", 175)
				.attr("height", self.titleBarOffset * 2)
				.attr("x", 25)
				.attr("y", -self.titleBarOffset)
				.style("fill", lightColor.data)
				.style("stroke", darkColor.data)
				.style("stroke-width", 2);

			let cursorText = self.interactionCursor.append("text")
				.attr("x", 29)
				.attr("y", self.titleBarOffset / 4)
				.style("font-size", self.titleBarOffset)
				.style("font-weight", "bold")
				.style("fill", "#333")
				.text("SnippetNamelahsd;flhasd");

			let cursorTextWidth = cursorText.node().getBBox().width;

			cursorRect.attr("width", cursorTextWidth + 6);

			setOverlayVisibility(true);
		}

		function setOverlayVisibility(isVisible) {
			self.showOverlay = isVisible;

			self.overlay.style("display", isVisible ? "initial" : "none");
		}

		function setInteractMode(isInteracting) {
			self.isInteracting = isInteracting;

			d3.select("#sage2UICanvas")
				.style("pointer-events", isInteracting ? "none" : "all");

			self.interactionCursor
				.style("opacity", isInteracting ? 1 : 0);
		}

		// start an interaction action by the user
		function setUserSelectedAction(action) {
			let {
				snippetID,
				type: actionType
			} = action;

			self.dragAction = action;

			let cursorText = self.interactionCursor
				.select("text")
				.text(self.snippetStates[snippetID].desc);
			let textWidth = cursorText.node().getBBox().width;
			self.interactionCursor.select("rect")
				.attr("width", textWidth + 6)
				.style("fill", lightColor[actionType])
				.style("stroke", darkColor[actionType]);


			if (actionType === "gen") {
				self.dragTargetMarker = self.overlay
					.append("rect")
					.attr("class", "snippetsDragInteractionTarget")
					.attr("width", self.newAppDim)
					.attr("height", self.newAppDim)
					.attr("x", 0 - self.newAppDim / 2)
					.attr("y", 0 - self.newAppDim / 2)
					.style("stroke", darkColor[actionType])
					.style("fill", lightColor[actionType])
					.style("opacity", 0);

				self.dragStart = {
					x: 0,
					y: 0,
					appID: null
				};
			}
		}

		// save new set of snippet associations, redraw all
		function updateAssociations(data) {
			self.associations = data;
			self.appMapping = {};

			// clean link object to handle deleted links before reprocessing
			self.snippetLinks = {};

			for (let app of data.apps) {
				self.appMapping[app.snippetsID] = app.appID;
			}

			for (let link of data.links) {
				processSubtree(link, null);
			}

			draw();
		}

		function processSubtree(link, parent) {
			let linkData = self.snippetLinks[link.linkID];

			if (!linkData) {
				self.snippetLinks[link.linkID] = {
					parent: null,
					child: {},
					snippetID: link.snippetID
				};

				linkData = self.snippetLinks[link.linkID];
			}

			if (parent) {
				linkData.parent = {
					snippetsID: parent.appID,
					appID: self.appMapping[parent.appID],
					position: parent.position
				};
			}

			linkData.child = {
				snippetsID: link.appID,
				appID: self.appMapping[link.appID]
			};

			self.snippetApps[self.appMapping[link.appID]] = {
				snippetsID: link.appID,
				appID: self.appMapping[link.appID]
			};

			for (let child of link.children) {
				processSubtree(child, link);
			}
		}

		function updateSnippetStates(states) {
			self.snippetStates = states;

			self.linkGroup
				.selectAll(".snippetLinkOverlay")
				.style("stroke", linkID => {
					return lightColor[
						self.snippetStates[self.snippetLinks[linkID].snippetID].type
					];
				})
				.style("fill", linkID => {
					return darkColor[
						self.snippetStates[self.snippetLinks[linkID].snippetID].type
					];
				});

			self.appGroup.selectAll(".snippetAppGroup")
				.each(function(appID) {
					let parentType = d3.select(this).select(".snippetAppCreationType");
					let parentLinkID = Object.keys(self.snippetLinks).filter(
						lID => self.snippetLinks[lID].child.appID === appID
					)[0];
					let parentLink = self.snippetLinks[parentLinkID];

					parentType
						.style("stroke", linkID => {
							return darkColor[
								self.snippetStates[parentLink.snippetID].type
							];
						})
						.style("fill", linkID => {
							return lightColor[
								self.snippetStates[parentLink.snippetID].type
							];
						});

					d3.select(this).select(".snippetAppTitle").text(self.snippetStates[parentLink.snippetID].desc);
				});
		}

		function draw() {
			self.appGroup.selectAll("*").remove();
			self.linkGroup.selectAll("*").remove();

			// draw info per app
			self.appGroup.selectAll(".snippetAppGroup")
				.data(Object.keys(self.snippetApps).filter(id => displayUI.applications[id]))
				.enter().append("g")
				.each(function(appID) {
					let appData = self.snippetApps[appID];

					let {
						left,
						top,
						width,
						height
					} = displayUI.applications[appID];

					let g = d3.select(this);

					g.attr("id", "overlay_" + appData.appID)
						.attr("class", "snippetAppGroup")
						.attr("transform", `translate(${left}, ${top})`)
						.on("mousedown", function(d) {
							let { left, top, width, height } = displayUI.applications[appID];

							let current = {
								x: d3.event.layerX * self.widthRatio,
								y: d3.event.layerY * self.heightRatio
							};

							self.dragStart = {
								x: current.x,
								y: current.y,
								appID: d
							};

							self.dragStartApp = {
								x: left + width / 2,
								y: top + height / 2 + self.titleBarOffset
							};

							d3.select(this).classed("snippetDragStartTarget", true);

							let actionType = self.dragAction.type;

							self.dragTargetMarker = self.overlay
								.append("rect")
								.attr("class", "snippetsDragInteractionTarget")
								.attr("width", self.newAppDim)
								.attr("height", self.newAppDim)
								.attr("x", current.x - self.newAppDim / 2)
								.attr("y", current.y - self.newAppDim / 2)
								.style("stroke", darkColor[actionType])
								.style("fill", lightColor[actionType])
								.style("opacity", 0);

							self.dragMarker = self.overlay.append("path")
								.attr("class", "snippetsDragInteractionLine")
								.attr("d", calculateTaperedPath(self.dragStartApp, current))
								.style("stroke", lightColor[actionType])
								.style("fill", darkColor[actionType])
								.style("opacity", 0);
						})
						.on("mousemove", function(d) {
							if (self.isInteracting) {
								self.interactionCursor
									.attr("transform", `translate(${d3.event.layerX * self.widthRatio},
										${d3.event.layerY * self.heightRatio})`);
							}

							let {
								left: x,
								top: y,
								width: w,
								height: h
							} = displayUI.applications[appID];

							// if it is dragging
							if (self.dragMarker && self.dragStart.appID !== d) {
								self.dragTargetMarker
									.attr("x", x)
									.attr("y", y)
									.attr("width", w)
									.attr("height", h + self.titleBarOffset);

								self.dragMarker.attr("d", calculateTaperedPath(self.dragStartApp, {
									x: x + w / 2, y: y + h / 2 + self.titleBarOffset
								}));

								d3.event.stopPropagation();
							}
						})
						.on("mouseup", function(d) {
							console.log("mouseUp on app");

							self.dragEnd = {
								appID: d !== self.dragStart.appID && d || null,
								x: d3.event.layerX,
								y: d3.event.layerY
							};

							d3.selectAll(".snippetDragStartTarget").classed("snippetDragStartTarget", false);

							// d3.event.stopPropagation();
						});

					g.append("rect")
						.attr("class", "snippetAppOverlay")
						.attr("width", width)
						.attr("height", height + self.titleBarOffset);

					let parentType = g.append("rect")
						.attr("class", "snippetAppCreationType")
						.attr("y", self.titleBarOffset)
						.attr("width", self.titleBarOffset)
						.attr("height", height);

					g.append("rect")
						.attr("class", "snippetAppTitlebar")
						.attr("width", width)
						.attr("height", self.titleBarOffset);

					let title = g.append("text")
						.attr("class", "snippetAppTitle")
						.attr("x", 3)
						.attr("y", self.titleBarOffset - 6)
						.style("font-size", self.titleBarOffset - 4)
						.text("Testing a Sentence");

					if (self.snippetStates) {
						let parentLinkID = Object.keys(self.snippetLinks).filter(
							lID => self.snippetLinks[lID].child.appID === appID
						)[0];
						let parentLink = self.snippetLinks[parentLinkID];

						parentType
							.style("stroke", linkID => {
								return darkColor[
									self.snippetStates[parentLink.snippetID].type
								];
							})
							.style("fill", linkID => {
								return lightColor[
									self.snippetStates[parentLink.snippetID].type
								];
							});

						title.text(self.snippetStates[parentLink.snippetID].desc);
					}
				});

			// draw links between apps

			self.linkGroup.selectAll(".snippetLinkOverlay")
				.data(Object.keys(self.snippetLinks).filter(lID => self.snippetLinks[lID].parent))
				.enter().append("path")
				.each(function(linkID) {
					let link = self.snippetLinks[linkID];

					if (
						!displayUI.applications[link.parent.appID] ||
						!displayUI.applications[link.child.appID]
					) {
						return;
					}

					let {
						left: left1,
						top: top1,
						width: width1,
						height: height1
					} = displayUI.applications[link.parent.appID];

					let {
						left: left2,
						top: top2,
						width: width2,
						height: height2
					} = displayUI.applications[link.child.appID];

					let start = {
						x: left1 + width1 / 2,
						y: top1 + height1 / 2
					};

					let end = {
						x: left2 + width2 / 2,
						y: top2 + height2 / 2
					};

					d3.select(this)
						.attr("id", "overlay_" + linkID)
						.attr("class", "snippetLinkOverlay")
						.attr("d", calculateTaperedPath(start, end));

					if (self.snippetStates) {
						d3.select(this)
							.style("stroke", linkID => {
								return lightColor[self.snippetStates[self.snippetLinks[linkID].snippetID].type];
							})
							.style("fill", linkID => {
								return darkColor[self.snippetStates[self.snippetLinks[linkID].snippetID].type];
							});
					}
				});
		}

		function updateItemOrder(order) {
			let ordering = Object.keys(order).sort((a, b) => {
				return order[a] - order[b];
			});

			for (let appID of ordering) {
				self.appGroup.select(`#overlay_${appID}`).raise();
			}

			let linkOrdering = Object.keys(self.snippetLinks).sort((a, b) => {
				let linkA = self.snippetLinks[a];
				let linkB = self.snippetLinks[b];

				let aIndex = linkA.parent ?
					Math.max(order[linkA.parent.appID], order[linkA.child.appID]) :
					order[linkA.child.appID];

				let bIndex = linkB.parent ?
					Math.max(order[linkB.parent.appID], order[linkB.child.appID]) :
					order[linkB.child.appID];

				return aIndex - bIndex;
			});

			for (let linkID of linkOrdering) {
				self.linkGroup.select(`#overlay_${linkID}`).raise();
			}
		}

		function updateHighlightedApp(app) {
			self.appGroup.selectAll(".snippetAppHighlighted").classed("snippetAppHighlighted", false);

			if (app) {
				self.appGroup
					.select(`#overlay_${app.id}`)
					.classed("snippetAppHighlighted", true);
			}
		}

		// update a single item when moved/resized
		function itemUpdated(data) {
			if (!displayUI.applications[data.elemId]) {
				return;
			}

			let {
				left,
				top,
				width,
				height
			} = displayUI.applications[data.elemId];

			let appG = self.appGroup.select(`#overlay_${data.elemId}`)
				.attr("transform", `translate(${left}, ${top})`);

			appG.select(".snippetAppOverlay")
				.attr("width", width)
				.attr("height", height + self.titleBarOffset);


			appG.select(".snippetAppTitlebar")
				.attr("width", width)
				.attr("height", self.titleBarOffset);


			appG.select(".snippetAppCreationType")
				.attr("width", self.titleBarOffset)
				.attr("height", height);

			// update links connecting to this app
			let linksToUpdate = Object.keys(self.snippetLinks).filter(l => {
				let link = self.snippetLinks[l];

				return link.parent && (link.parent.appID === data.elemId ||
					link.child.appID === data.elemId);
			});

			for (let linkID of linksToUpdate) {
				let link = self.snippetLinks[linkID];

				let {
					left: left1,
					top: top1,
					width: width1,
					height: height1
				} = displayUI.applications[link.parent.appID];

				let {
					left: left2,
					top: top2,
					width: width2,
					height: height2
				} = displayUI.applications[link.child.appID];

				let start = {
					x: left1 + width1 / 2,
					y: top1 + height1 / 2
				};

				let end = {
					x: left2 + width2 / 2,
					y: top2 + height2 / 2
				};

				self.linkGroup.select("#overlay_" + linkID)
					.attr("class", "snippetLinkOverlay")
					.attr("d", calculateTaperedPath(start, end));
			}
		}

		function calculateTaperedPath(start, end) {
			let dx = end.x - start.x;
			let dy = end.y - start.y;

			let slope = dy / dx;
			// let angle = Math.atan2(dy, dx);

			if (slope === Infinity) {
				slope = Math.pow(10, 10);
			}

			let inverse = 1 / -slope;

			let width = self.titleBarOffset;

			let idx = Math.sqrt(
				Math.pow(width / 2, 2) / (1 + Math.pow(inverse, 2))
			);
			let idy = inverse * idx;

			let pathCoords = [
				[start.x - idx * 2, start.y - idy * 2],
				[start.x + idx * 2, start.y + idy * 2],
				[end.x + idx / 4, end.y + idy / 4],
				[end.x - idx / 4, end.y - idy / 4]
			];

			// let pathCoordsStr = pathCoords.map(c => c.join(", "));

			return `M ${pathCoords.map(c => c.join(", ")).join("L ")} Z`;
		}

		function onResize() {
			// update the width/height and relative width/height of the svg

		}

		return {
			setOverlayVisibility,
			setInteractMode,
			setUserSelectedAction,

			updateAssociations,
			updateSnippetStates,

			updateHighlightedApp,

			updateItemOrder,
			itemUpdated,

			onResize
		};
	};
}());
