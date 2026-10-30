import { Cube } from './cube.js';
import { Entity } from './entity.js';
import { Room } from './room.js';
import { WorldMap } from './worldMap.js';
import { EntityMove } from './entityMove.js';

export class Register {
    #types = new Map();
    constructor() {
        this.#createBase();
    }

    #set(value) {
        if(value == null || value.type == null) throw new Error('value is null or value.type is null');
        if(typeof value !== "function") throw new Error(value.type + ' is not a class');
        if(this.#types.has(value.type)) throw new Error(value.type + ' already registered');
        this.#types.set(value.type, value);
    }

    get(type) {
        const value = this.#types.get(type);
        if(typeof value !== "function") throw new Error(type + ' not registered');
        return value;
    }

    #createBase(){
        this.#set(Cube);
        this.#set(Entity);
        this.#set(Room);
        this.#set(WorldMap);
        this.#set(EntityMove);
    }

}