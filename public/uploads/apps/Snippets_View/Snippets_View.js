//
// SAGE2 application: Snippets_View
// by: Andrew Burks <andrewtburks@gmail.com>
//
// Copyright (c) 2018-2019
//

"use strict";

/* global d3 jsonSummary */

var Snippets_View = SAGE2_App.extend({
  init: function(data) {
    // Create div into the DOM
    this.SAGE2Init("div", data);
    // Set the DOM id
    this.element.id = "div_" + data.id;
    // Set the background to black
    this.element.style.backgroundColor = "white";

    this.dataset = [];

    this.parentLink = null;
    this.childLinks = [];

    // this.inputsOpen = false;

    // move and resize callbacks
    this.resizeEvents = "onfinish"; // continuous

    this.content = d3.select(this.element).append("div")
      .style("width", "100%")
      .style("height", this.sage2_height - ui.titleBarHeight * 1.5 + "px")
      .style("position", "absolute")
      .style("box-sizing", "border-box")
      .style("left", 0)
      .style("top", ui.titleBarHeight * 1.5 + "px")
      .style("overflow", "hidden");

    this.dataView = this.content
      .append("div")
      .style("width", "100%")
      .style("height", "100%")
      .style("font-family", "monospace")
      .style("white-space", "pre")
      // .style("padding", "8px 10px")
      .style("color", "#abb2bf")
      .style("font-size", ui.titleBarHeight / 2 + "px")
      .style("background-color", "#282c34");

    this.inputs = d3.select(this.element).append("div")
      .attr("class", "snippetsInputWrapper")
      .style("position", "absolute")
      .style("left", this.sage2_width + "px")
      .style("width", "300px")
      .style("top", 0)
      .style("min-height", "100%")
      .style("padding", ui.titleBarHeight * 1.5 + 8 + "px 10px")
      .style("box-sizing", "border-box")
      .style("background", "lightgray");

    // add error popup to app
    this.errorBox = d3.select(this.element).append("div")
      .style("width","90%")
      .style("height","50%")
      .style("position","absolute")
      .style("boxSizing","border-box")
      .style("left","5%")
      .style("top","20%")
      .style("borderRadius","10px")
      .style("background","#ffe2e2")
      .style("boxShadow","3px 3px 25px 3px black")
      .style("border","2px solid #ffb4b4")
      .style("color","red")
      .style("fontWeight","bold")
      .style("fontSize",(3 * ui.titleBarHeight) / 4 + "px")
      .style("padding","10px")
      .style("fontFamily", "monospace")
      .style("whiteSpace", "normal");

    this.errorBox.style("display", "none");

    // use mouse events normally
    this.passSAGE2PointerAsMouseEvents = true;

    // SAGE2 Application Settings

    // add wrapper for function execution information
    let ancestry = d3
      .select(this.element)
      .append("svg")
      .attr("class", "snippetAncestry")
      .attr("height", ui.titleBarHeight * 1.5)
      .attr("width", data.width);

    this.ancestry = ancestry;

    SAGE2_CodeSnippets.displayApplicationLoaded(this.id, this);

    this.createAncestorList();

    // give descriptive title to app
    if (this.parentLink) {
      if (this.parentLink.getParent()) {
        this.updateTitle(
          "VisSnippets: " +
            `snip[${this.parentLink.getSnippetID().split("-")[1]}](${
              this.parentLink.getParent().id
            }) ➔ ` +
            this.id
        );
      } else {
        this.updateTitle(
          "VisSnippets: " +
            `snip[${this.parentLink.getSnippetID().split("-")[1]}] ➔ ` +
            this.id
        );
      }
    } else {
      this.updateTitle("VisSnippets: " + this.state.snippetsID);
    }
  },

  load: function(date) {
    console.log("Snippets_Vis> Load with state", this.state);
    this.refresh(date);
  },

  draw: function(date) {},

  getElement: function(data, date) {
    // update with new data and draw

    // remove error dialogue when the element is requested for draw function
    this.errorBox.style.display = "none";

    // refresh ancestor list (in case of name change)
    this.createAncestorList();

    return this.snippetsVisElement || this.element;
  },

  getDataset: function(date) {
    // update with new data and draw
    return this.dataset;
  },

  updateDataset: function(data, date) {
    // update dataset
    this.dataset = data;

    
    if (!this.snippetsVisElement && data) {
      // let summary = SAGE2_SnippetsUtil.summarizeJSON(data);
      // let printedSummary = SAGE2_SnippetsUtil.printSummarizedJSON(summary);

      let summary = jsonSummary.summarize(data, {arraySampleCount: 100});
      let printedSummary = jsonSummary.printSummary(summary, {theme: "monokai", startExpanded: true});

      this.errorBox.style.display = "none";

      // draw
      this.dataView.html(printedSummary);

      this.dataView.selectAll(".theme, .json-summary-wrapper").style("height", "100%");
    }

    this.updateChildren();

    // refresh ancestor list (in case of name change)
    this.createAncestorList();
  },

  updateChildren: function(date) {
    // update all children
    for (let childLink of this.childLinks) {
      childLink.update();
    }
  },

  displayError: function(err) {
    this.errorBox.style.display = "initial";
    this.errorBox.innerHTML = err;
  },

  addChildLink: function(data, date) {
    this.childLinks.push(data);
  },

  removeChildLink: function(link) {
    let linkInd = this.childLinks.indexOf(link);

    this.childLinks.splice(linkInd, 1);
  },

  setParentLink: function(link, date) {
    // save the parent of the function
    this.parentLink = link;

    // give descriptive title to app
    if (this.parentLink) {
      if (this.parentLink.getParent()) {
        this.updateTitle(
          "VisSnippets: " +
            `snip[${this.parentLink.getSnippetID().split("-")[1]}](${
              this.parentLink.getParent().id
            }) ➔ ` +
            this.id
        );
      } else {
        this.updateTitle(
          "VisSnippets: " +
            `snip[${this.parentLink.getSnippetID().split("-")[1]}] ➔ ` +
            this.id
        );
      }
    } else {
      this.updateTitle("VisSnippets: " + this.state.snippetsID);
    }
  },

  removeParentLink: function() {
    delete this.parentLink;

    this.createAncestorList();
  },

  createAncestorList: function() {
    // build sequential function call list and display
    let ancestry = SAGE2_CodeSnippets.getAppAncestry(this);
    // outsource ancestry drawing ot SAGE2_CodeSnippets
    SAGE2_CodeSnippets.drawAppAncestry({
      svg: this.ancestry,
      width: this.sage2_width,
      height: ui.titleBarHeight * 1.5,
      ancestry,
      app: this
    });
  },

  updateAncestorTree: function() {
    this.createAncestorList();

    for (let link of this.childLinks) {
      link.getChild().updateAncestorTree();
    }
  },

  resize: function(date) {
    // Called when window is resized
    let contentWidth = this.state.inputsOpen
      ? this.sage2_width - 300
      : this.sage2_width;
    this.content.style("width", contentWidth + "px");
    this.content.style("height", this.sage2_height - ui.titleBarHeight * 1.5 + "px");

    this.inputs.style("left", contentWidth + "px");

    // update ancestor list size
    this.ancestry.attr("width", this.sage2_width);
    this.createAncestorList();

    // if it has a visualization in the view
    if (this.parentLink && this.snippetsVisElement) {
      this.parentLink.update(); // redraw
    }

    this.refresh(date);
  },

  quit: function() {
    // Make sure to delete stuff (timers, ...)
    SAGE2_CodeSnippets.outputAppClosed(this);
  },

  requestEdit: function(data) {
    // handled the same as a load request in the editor
    SAGE2_CodeSnippets.requestSnippetLoad(
      data.clientId,
      this.parentLink.getSnippetID()
    );
  },

  getContextEntries() {
    return [
      {
        description: "Edit Snippet",
        // callback
        callback: "requestEdit",
        // parameters of the callback function
        parameters: {}
      }
    ];
  },

  event: function(eventType, position, user_id, data, date) {
    if (eventType === "pointerPress" && data.button === "left") {
      // click
    } else if (eventType === "pointerMove" && this.dragging) {
      // move
    } else if (eventType === "pointerRelease" && data.button === "left") {
      // click release
    } else if (eventType === "pointerScroll") {
      // Scroll events for zoom
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
      console.log("Data Update", data);

      this.updateContent(data, date);
      // this.refresh(date);
    }
  }
});
