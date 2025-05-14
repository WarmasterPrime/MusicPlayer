
class TypeValidation {
	/**
	 * Determines if the  is a numerical data-type.
	 * @param {*} value The object to analyze.
	 * @returns a boolean representation of the result.
	 */
	static isNumber(value) {
		return TypeValidation.is(value, "number");
	}
	
	static is(value, typeName) {
		return typeof(typeName) === "string" && typeof(value) === typeName;
	}
	
}
