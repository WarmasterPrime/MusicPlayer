
export default class VJson {
	
	static isJsonString(value) {
		if(typeof value === "string") {
			try {
				JSON.parse(value);
				return true;
			} catch {
				return false;
			}
		}
		return false;
	}
	
	static isSerializable(value) {
		if(typeof value === "object") {
			try {
				JSON.stringify(value);
				return true;
			} catch {
				return false;
			}
		}
		return false;
	}
	
	static serialize(value) {
		if(VJson.isJsonString(value))
			return value;
		else if(VJson.isSerializable(value))
			return JSON.stringify(value);
		throw new Error("The provided value is not serializable to JSON either because the provided value cannot be serialized into a JSON string, or because the value is not formatted correctly, or because the value cannot be converted into a JSON string.");
	}
	
	static deserialize(value) {
		if(VJson.isJsonString(value))
			return JSON.parse(value);
		throw new Error("The provided value is not a valid JSON string and cannot be deserialized into a JavaScript object. Please ensure that the input is a properly formatted JSON string.");
	}
	
	static isArray(value) {
		if(Array.isArray(value))
			return true;
		if(VJson.isSerializable(value))
			value = VJson.serialize(value);
		if(VJson.isJsonString(value)) {
			value = VJson.deserialize(value);
			return Array.isArray(value);
		}
		return false;
	}
	
	static isAssociative(value) {
		if(VJson.isSerializable(value))
			value = VJson.serialize(value);
		if(VJson.isJsonString(value)) {
			value = VJson.deserialize(value);
			return !Array.isArray(value);
		}
		return false;
	}
	
}
