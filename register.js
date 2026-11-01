export class Register {
    #types = new Map();

    set(value) {
        if(value == null || value.type == null) throw new Error('value or value.type is null or undefined');
        if(typeof value !== "function") throw new Error(value.type + ' is not a class');
        if(this.#types.has(value.type)) throw new Error(value.type + ' already registered');
        this.#types.set(value.type, value);
    }

    get(type) {
        const value = this.#types.get(type);
        if(typeof value !== "function") throw new Error(type + ' not registered: call FactoryWorld.instance.register(YourClass) in main.js before creating it');
        return value;
    }

}
