"use strict";

/* global d3 */

let CodeSnippetInput = (function () {

	/*
	 * SnippetInput base-class
	 */
	class SnippetInput {
		constructor(specification) {
			this._spec = specification;
			this._state = new SnippetInputState(this.defaultValue);

			this._inputElement = null;
			this._onUpdate = () => {};
		}

		get state() {
			return this._state.value;
		}

		get spec() {
			return this._spec;
		}

		set spec(newSpec) {
			this.updateStateFromSpec(newSpec);

			this._spec = newSpec;
		}

		set onUpdate(callback) {
			this._onUpdate = callback;
		}

		/*
		 * SnippetInput abstract methods -- must be implemented to avoid Error
		 */
		get defaultValue() {
			throw new Error(`get defaultValue() method must be implemented in ${this.spec.type} SnippetInput`);
		}

		updateStateFromSpec(newSpec) {
			throw new Error(`updateStateFromSpec() method must be implemented in ${this.spec.type} SnippetInput`);
		}

		createInputElement(parentNode) {
			throw new Error(`createInputElement() method must be implemented in ${this.spec.type} SnippetInput`);
		}

		updateInputElement(parentNode) {
			throw new Error(`updateInputElement() method must be implemented in ${this.spec.type} SnippetInput`);
		}
	}

	/*
	 * SnippetInput State class
	 */
	class SnippetInputState {
		constructor(defaultVal) {
			this._value = defaultVal;
			this._onUpdate = null;
		}

		set value(newState) {
			// check if the state has changed
			if (newState !== this._value) {
				// perform updates on state change
				if (this._onUpdate) {
					this._onUpdate();
				}
			}
			this._value = newState;
		}

		get value() {
			return this._value;
		}
	}

	/*
	 * Sub-classes extending SnippetInput per input type
	 */

	/*
	 * Range slider input for Code Snippets
	 * Specification: { name, type, range, step }
	 */
	class SnippetRange extends SnippetInput {
		constructor(specification) {
			super(specification);
		}

		get defaultValue() {
			// default input value is the first value in the range
			if (this._spec.defaultVal > this._spec.range[0] && this._spec.defaultVal < this._spec.range[1]) {
				return this._spec.defaultVal;
			}
			return this._spec.range[0];
		}

		updateStateFromSpec(newSpec) {
			// clamp value into new range
			if (this._state.value < newSpec.range[0]) {
				this._state.value = newSpec.range[0];
			} else if (this._state.value > newSpec.range[1]) {
				this._state.value = newSpec.range[1];
			}

			// update the input element for new spec
			if (!this._inputElement.selectAll(".rangeInputOverlay").datum().dragging) {
				let sliderOffset = 175 * (this._state.value - newSpec.range[0]) /
					(newSpec.range[1] - newSpec.range[0]);

				this._inputElement.selectAll(".rangeInputHandle")
					.style("left", (sliderOffset) + "px"); // center the slider element on the value

				this._inputElement.selectAll(".currValLabel")
					.text(this._state.value);
			}

			this._inputElement.selectAll(".minVal")
				.text(newSpec.range[0]);

			this._inputElement.selectAll(".maxVal")
				.text(newSpec.range[1]);

			// TODO: round state value to step size (?)
		}

		createInputElement(parentNode) {
			let _this = this;
			this._inputElement = parentNode;

			let label = parentNode.append("div")
				.style("text-align", "center")
				.append("span")
				.attr("class", "currValLabel")
				.style("font-weight", "bold")
				.style("margin-bottom", "4px")
				.text(this._state.value);

			parentNode.append("div")
				.each(function () {
					let div = d3.select(this);

					div.append("span")
						.attr("class", "minVal")
						.style("display", "inline-block")
						.style("transform", `translateY(-${ui.titleBarHeight / 3}px)`)
						.text(_this._spec.range[0]);

					// create custom "input" element
					div.append("div")
						.attr("class", "rangeInput")
						.style("height", ui.titleBarHeight + "px")
						.each(function() {
							// create input element from slider track div
							let track = d3.select(this);

							let sliderOffset = 175 * (_this._state.value - _this._spec.range[0]) /
								(_this._spec.range[1] - _this._spec.range[0]);

							let handle = track.append("div") // slider handle
								.attr("class", "rangeInputHandle")
								.style("height", ui.titleBarHeight + "px")
								.style("left", (sliderOffset) + "px"); // center the slider element on the value

							let overlay = track.append("div")
								.datum({dragging: false})
								.attr("class", "rangeInputOverlay")
								.style("width", "100%")
								.style("height", "100%");

							// start dragging
							overlay.on("mousedown", function(d) {
								d.dragging = true;
							});

							// stop dragging
							overlay.on("mouseup", function(d) {
								if (d.dragging) {
									d.dragging = false;
									handle.style("left", d3.event.offsetX - 5 + "px");

									let offset = (d3.event.offsetX / 175) *
										(_this._spec.range[1] - _this._spec.range[0]);

									let value = Math.round((offset + _this._spec.range[0]) / _this._spec.step) * _this._spec.step;

									_this._state.value = value;
									_this._onUpdate();

									label.text(value);
								}
							});

							// stop dragging
							overlay.on("mouseleave", function(d) {
								if (d.dragging) {
									d.dragging = false;
									handle.style("left", d3.event.offsetX - 5 + "px");

									let offset = (d3.event.offsetX / 175) *
										(_this._spec.range[1] - _this._spec.range[0]);

									let value = Math.round((offset + _this._spec.range[0]) / _this._spec.step) * _this._spec.step;

									_this._state.value = value;
									_this._onUpdate();

									label.text(value);
								}
							});

							// drag handle
							overlay.on("mousemove", function(d) {
								if (d.dragging) {
									// move handle and update value

									let offset = (d3.event.offsetX / 175) *
										(_this._spec.range[1] - _this._spec.range[0]);

									let value = Math.round((offset + _this._spec.range[0]) / _this._spec.step) * _this._spec.step;

									// clamp value in range
									if (value < _this._spec.range[0]) {
										value = _this._spec.range[0];
									} else if (value > _this._spec.range[1]) {
										value = _this._spec.range[1];
									}

									let left = 175 * (value - _this._spec.range[0]) /
									(_this._spec.range[1] - _this._spec.range[0]);

									handle.style("left", left - 5 + "px");

									label.text(value);
								}
							});
						});

					div.append("span")
						.attr("class", "maxVal")
						.style("display", "inline-block")
						.style("transform", `translateY(-${ui.titleBarHeight / 3}px)`)
						// .style("font-size", ui.titleBarHeight / 3 + "px")
						.text(_this._spec.range[1]);
				});
		}

		updateInputElement(parentNode) {

		}
	}

	/*
	 * Checkbox input for Code Snippets
	 * Specification: { name, type }
	 */
	class SnippetCheckbox extends SnippetInput {
		constructor(specification) {
			super(specification);

		}

		get defaultValue() {
			return this._spec.defaultVal !== undefined ? this._spec.defaultVal : false;
		}

		updateStateFromSpec(newSpec) {
			// no merge required for SnippetText
			// --> state and spec never deviate
		}

		createInputElement(parentNode) {
			let _this = this;
			this._inputElement = parentNode;

			parentNode
				.append("div")
				.attr("class", "checkboxInput")
				.style("font-size", 3 * ui.titleBarHeight / 4 + "px")
				.style("height", ui.titleBarHeight + "px")
				.style("width", ui.titleBarHeight + "px")
				.classed("checked", this._state.value ? "true" : null)
				.on("click", function () {
					let checked = !_this._state.value;

					d3.select(this).classed("checked", checked);
					_this._state.value = checked;
					_this._onUpdate();
				})
				.on("mouseover", function (d) {
					d3.select(this).classed("hovered", true);
				})
				.on("mouseleave", function (d) {
					d3.select(this).classed("hovered", false);
				});
		}
	}

	/*
	 * Radio buttons input for Code Snippets
	 * Specification: { name, type, options }
	 */
	class SnippetRadio extends SnippetInput {
		constructor(specification) {
			super(specification);

		}

		get defaultValue() {
			if (this._spec.defaultVal !== undefined && this._spec.options.includes(this.spec.defaultVal)) {
				return this._spec.defaultVal;
			}

			return this._spec.options[0];
		}

		updateStateFromSpec(newSpec) {
			// update selected option if the currently selected one does not exist in the new spec
			if (!newSpec.options.includes(this._state.value)) {
				this._state.value = newSpec.options[0];
			}

			let _this = this;
			// update the input element for new spec
			let bind = this._inputElement.selectAll(".radioOption").data(newSpec.options);

			bind.exit().remove();

			this._inputElement.selectAll(".radioOption")
				.each(function(d) {
					// update existing radio input and label
					d3.select(this).select(".radioInput")
						.datum(d)
						.classed("selected", _this._state.value === d ? "true" : null);

					d3.select(this).select("span")
						.text(d);
				});

			bind.enter().append("div")
				.attr("class", "radioOption")
				.each(function(d) {

					// create new radio input and label
					d3.select(this).append("div")
						.attr("class", "radioInput")
						.style("font-size", 3 * ui.titleBarHeight / 4 + "px")
						.style("height", ui.titleBarHeight + "px")
						.style("width", ui.titleBarHeight + "px")
						.classed("selected", _this._state.value === d ? "true" : null)
						.on("click", function (opt) {
							_this._inputElement.select(".selected").classed("selected", false);

							d3.select(this).classed("selected", true);

							_this._state.value = opt;
							_this._onUpdate();
						})
						.on("mouseover", function (d) {
							d3.select(this).classed("hovered", true);
						})
						.on("mouseleave", function (d) {
							d3.select(this).classed("hovered", false);
						});

					d3.select(this)
						.append("span")
						.style("display", "inline-block")
						.style("transform", `translateY(-${ui.titleBarHeight / 3}px)`)
						.text(d);
				});
		}

		createInputElement(parentNode) {
			let _this = this;
			this._inputElement = parentNode;

			parentNode.selectAll(".radioOption")
				.data(this._spec.options)
				.enter().append("div")
				.attr("class", "radioOption")
				.each(function (d) {

					d3.select(this).append("div")
						.attr("class", "radioInput")
						.style("font-size", 3 * ui.titleBarHeight / 4 + "px")
						.style("height", ui.titleBarHeight + "px")
						.style("width", ui.titleBarHeight + "px")
						.classed("selected", _this._state.value === d ? "true" : null)
						.on("click", function (opt) {
							parentNode.select(".selected").classed("selected", false);

							d3.select(this).classed("selected", true);

							_this._state.value = opt;
							_this._onUpdate();
						})
						.on("mouseover", function (d) {
							d3.select(this).classed("hovered", true);
						})
						.on("mouseleave", function (d) {
							d3.select(this).classed("hovered", false);
						});

					d3.select(this)
						.append("span")
						.style("display", "inline-block")
						.style("transform", `translateY(-${ui.titleBarHeight / 3}px)`)
						.text(d);
				});
		}
	}

	/*
	 * Text field input for Code Snippets
	 * Specification: { name, type }
	 */
	class SnippetText extends SnippetInput {
		constructor(specification) {
			super(specification);

		}

		get defaultValue() {
			return this._spec.defaultVal !== undefined ? this._spec.defaultVal : "";
		}

		updateStateFromSpec(newSpec) {
			// no merge required for SnippetText
			// --> state and spec never deviate
		}

		createInputElement(parentNode) {
			let _this = this;

			let input = parentNode.append("input")
				.attr("class", "textInput")
				.attr("type", "text")
				.style("height", ui.titleBarHeight + "px")
				.style("font-size", 3 * ui.titleBarHeight / 4 + "px");

			input.node().value = this._state.value;

			parentNode.append("div")
				.attr("class", "textInputGo")
				.style("height", ui.titleBarHeight + "px")
				.style("font-size", ui.titleBarHeight / 2 + "px")
				.on("click", function () {
					_this._state.value = input.node().value;
					console.log("Text Input Submit");
					_this._onUpdate();
				})
				.on("mouseover", function (d) {
					d3.select(this).classed("hovered", true);
				})
				.on("mouseleave", function (d) {
					d3.select(this).classed("hovered", false);
				});
		}
	}

	/*
	 * SnippetInputFactory class
	 */
	return {
		_typeMap: {
			range: SnippetRange,
			checkbox: SnippetCheckbox,
			radio: SnippetRadio,
			text: SnippetText
		},
		create: function (specification) {
			// console.log(specification);
			return new this._typeMap[specification.type](specification);
		}
	};
}());
