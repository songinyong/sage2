const CodeSnippetCompiler = (function() {

	/**
	 * Pass the user defined code into a Function constructor with parameters based on type
	 *
	 * @method createFunction
	 * @param {String} type - the type of the snippet (gen, draw, data)
	 * @param {String} code - the code which a user wrote, to be loaded
	 */
	function createFunction(type, code) {
		// replace special syntax pieces using RegExp
		let inputsRegex = new SnippetsInputRegExp(/SAGE2.SnippetInput\(({[\w,\W]*?})\)/, "gm");
		let visElemRegex = new SnippetsVisElementRegExp(/SAGE2.SnippetVisElement\(({[\w,\W]*?})\)/, "gm");
		let timeoutRegex = new SnippetsTimeoutRegExp(/SAGE2.SnippetTimeout\(({[\w,\W]*?})\)/, "gm");

		// "compile" code and replace/extract special syntax values
		let codeCompile_1 = code.replace(inputsRegex);
		let codeCompile_2 = codeCompile_1.replace(timeoutRegex);
		let codeCompile_final = codeCompile_2.replace(visElemRegex);

		let parameters = {
			gen: ["previousData", "next", "link", "console"],
			data: ["data", "next", "link", "console"],
			draw: ["data", "next", "link", "console"]
		};

		let functionBlock = `
			/* USER DEFINED CODE */
			// Code written by user will be inserted here
			
			${codeCompile_final}

			/* END USER DEFINED CODE*/
		`;

		return new Function(...parameters[type], functionBlock);
	}

	/**
	 * Create the funtion block for the new snippet. The user-defined code first put through a
	 * pseudo-compile process in order to append additional parameters to SAGE2 API functions,
	 * then wrapped in the necessary code to execute the snippet.
	 *
	 * @method createFunctionBlock
	 * @param {String} type - the type of the snippet (gen, draw, data)
	 * @param {String} code - the code which a user wrote, to be loaded
	 */
	function createFunctionBlock(type, code) {
		// replace special syntax pieces using RegExp
		let inputsRegex = new SnippetsInputRegExp(/SAGE2.SnippetInput\(({[\w,\W]*?})\)/, "gm");
		let visElemRegex = new SnippetsVisElementRegExp(/SAGE2.SnippetVisElement\(({[\w,\W]*?})\)/, "gm");
		let timeoutRegex = new SnippetsTimeoutRegExp(/SAGE2.SnippetTimeout\(({[\w,\W]*?})\)/, "gm");

		// "compile" code and replace/extract special syntax values
		let codeCompile_1 = code.replace(inputsRegex);
		let codeCompile_2 = codeCompile_1.replace(timeoutRegex);
		let codeCompile_final = codeCompile_2.replace(visElemRegex);

		let functionBlocks = {
			data: `(function (data, next, link) {
				/* USER DEFINED CODE */
				// Code written by user will be inserted here
				
				${codeCompile_final}

				/* END USER DEFINED CODE*/
			})`,
			draw: `(function (data, next, link) {
				/* USER DEFINED CODE */
				// Code written by user will be inserted here

				${codeCompile_final}
				
				/* END USER DEFINED CODE*/
		
			})`,
			gen: `(function (previousData, next, link) {
				/* USER DEFINED CODE */
				// Code written by user will be inserted here

				${codeCompile_final}

				/* END USER DEFINED CODE*/
			})`
		};

		return functionBlocks[type];
	}

	return {
		createFunction,
		createFunctionBlock
	};
}());

// Regular Expression which will find SAGE2.SnippetInput({ ... })
//	and add an extra link parameter to the calls
class SnippetsInputRegExp extends RegExp {
	// change the replace function
	[Symbol.replace](str, inputs) {
		let output = ``;

		let result;
		let lastIndex = 0;
		while ((result = this.exec(str))) {

			// reconstruct code string with SAGE2.Input calls given an extra property of link
			output += str.substring(lastIndex, result.index + result[0].length - 1) + `, link)`;
			lastIndex = result.index + result[0].length;
		}

		// append rest of code
		output += str.substring(lastIndex);

		return output;
	}
}

// Regular Expression which will find SAGE2.SnippetVisElement({ ... })
//	and add an extra app ('this') parameter to the calls
class SnippetsVisElementRegExp extends RegExp {
	// change the replace function
	[Symbol.replace](str, inputs) {
		// code replaced with new string
		let output = ``;

		let result;
		let lastIndex = 0;
		while ((result = this.exec(str))) {

			// reconstruct code string with SAGE2.Input calls given an extra property of app reference
			output += str.substring(lastIndex, result.index + result[0].length - 1) + `, this)`;
			lastIndex = result.index + result[0].length;
		}

		// append rest of code
		output += str.substring(lastIndex);

		return output;
	}
}

// Regular Expression which will find SAGE2.SnippetTimeout({ ... })
//	and add an extra link parameter to the calls
class SnippetsTimeoutRegExp extends RegExp {
	// change the replace function
	[Symbol.replace](str, inputs) {
		// code replaced with new string
		let output = ``;

		let result;
		let lastIndex = 0;
		while ((result = this.exec(str))) {

			// reconstruct code string with SAGE2.Input calls given an extra property of app reference
			output += str.substring(lastIndex, result.index + result[0].length - 1) + `, link)`;
			lastIndex = result.index + result[0].length;
		}

		// append rest of code
		output += str.substring(lastIndex);

		return output;
	}
}
