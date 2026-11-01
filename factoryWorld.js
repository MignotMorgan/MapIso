import { Register } from './register.js';

export class FactoryWorld{

    static #instance = null;

    static get instance(){
        if (this.#instance === null){ this.#instance = new FactoryWorld(); }
        return this.#instance;
    }

    #register = new Register();

    register(Class){ this.#register.set(Class); }

    create(json){
        if(json == null || json.type == null) return null;
        const Class = this.#register.get(json.type);
        // Lu après la construction : les champs d'une sous-classe existent alors déjà.
        const instance = new Class();
        instance.fromJSON(json);
        return instance;
    }
}
