/* 
 * Copyright 2019, Emanuel Rabina (http://www.ultraq.net.nz/)
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {findClosingBracket, splitFormattedArgument} from './utilities.js';

import {memoize} from '@ultraq/function-utils';

/**
 * Transforms a string that is part of an original message into an object which
 * describes it.
 * 
 * @param {String} string
 * @return {Object}
 */
function decorateMessageString(string) {
	return {
		source: 'message',
		value: string
	};
}

/**
 * Transforms a value returned by a type handler into an object which describes
 * how the value was obtained.
 * 
 * @param {String} key
 * @param {String} type
 * @param {*} value
 * @return {Object}
 */
function decorateValue(key, type, value) {
	return {
		source: 'value',
		key,
		type,
		value
	};
}

/**
 * Extract just the values from all of the nested metadata returned by the
 * {@link MessageFormatter#process} function.
 * 
 * @param {Array} array
 * @return {Array}
 */
function extractValues(array) {
	return array.reduce((acc, {value}) => {
		return acc.concat(Array.isArray(value) ? extractValues(value) : value);
	}, []);
}

/**
 * The main class for formatting messages.
 * 
 * @author Emanuel Rabina
 */
export default class MessageFormatter {

	/**
	 * Creates a new formatter that can work using any of the custom type handlers
	 * you register.
	 * 
	 * @param {Object} [typeHandlers={}]
	 *   Optional object where the keys are the names of the types to register,
	 *   their values being the functions that will return a nicely formatted
	 *   string for the data and locale they are given.
	 */
	constructor(typeHandlers = {}) {

		this.typeHandlers = typeHandlers;
	}

	/**
	 * Formats an ICU message syntax string using `values` for placeholder data
	 * and any currently-registered type handlers.
	 * 
	 * @param {String} message
	 * @param {Object} [values={}]
	 * @param {String} [locale]
	 * @return {String}
	 */
	format = memoize((message, values = {}, locale) => {

		let processResult = this.process(message, values, locale);
		let extractedResult = extractValues(processResult);
		return extractedResult.join('');
	})

	/**
	 * Process an ICU message syntax string using `values` for placeholder data
	 * and any currently-registered type handlers.  The result of this method is
	 * an array of objects, describing the component parts after they have been
	 * processed in turn by their own type handlers.  This raw output is useful
	 * for other renderers, eg: React where components can be returned instead of
	 * raw strings, and so can be handled differently.
	 * 
	 * This method is used by {@link MessageFormatter#format} where it acts as a
	 * string renderer.
	 * 
	 * @param {String} message
	 * @param {Object} [values={}]
	 * @param {String} [locale]
	 * @return {Array}
	 */
	process(message, values = {}, locale) {

		if (!message) {
			return [];
		}

		let blockStartIndex = message.indexOf('{');
		if (blockStartIndex !== -1) {
			let blockEndIndex = findClosingBracket(message, blockStartIndex);
			if (blockEndIndex !== -1) {
				let block = message.substring(blockStartIndex, blockEndIndex + 1);
				if (block) {
					let result = [];
					let head = message.substring(0, blockStartIndex);
					if (head !== null && head !== undefined && head !== '') {
						result.push(decorateMessageString(head));
					}
					let [key, type, format] = splitFormattedArgument(block);
					let body = values[key];
					if (body === null || body === undefined) {
						body = '';
					}
					let typeHandler = type && this.typeHandlers[type];
					result = result.concat(decorateValue(key, type, typeHandler ?
						typeHandler(body, format, values, locale, this.process.bind(this)) :
						body)
					);
					let tail = message.substring(blockEndIndex + 1);
					if (tail !== null && tail !== undefined && tail !== '') {
						result = result.concat(this.process(tail, values, locale));
					}
					return result;
				}
			}
			else {
				throw new Error(`Unbalanced curly braces in string: "${message}"`);
			}
		}
		return [
			decorateMessageString(message)
		];
	}
}
