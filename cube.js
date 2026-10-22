export class Cube{

    static type = "Cube";
    static version = 1;

    #x = 0;
    #y = 0;
    #z = 0;
    #floors = [];
    #volumes = [];
    #floorsSpeed = 0;
    #volumesSpeed = 0;
    #walkable = false;

    constructor(options = {}){
        this.fromJSON(options);
    }

    get x(){ return this.#x; }
    get y(){ return this.#y; }
    get z(){ return this.#z; }
    get floors(){ return this.#floors; }
    set floors(value){ this.#floors = value || []; }
    get volumes(){ return this.#volumes; }
    set volumes(value){ this.#volumes = value || []; }
    get floorsSpeed(){ return this.#floorsSpeed; }
    set floorsSpeed(value){ this.#floorsSpeed = value ?? 0; }
    get volumesSpeed(){ return this.#volumesSpeed; }
    set volumesSpeed(value){ this.#volumesSpeed = value ?? 0; }
    get walkable(){ return this.#walkable; }
    set walkable(value){ this.#walkable = !!value; }

    /**
     * Écrit dans l'objet json. type/version viennent de la classe réelle
     * (une sous-classe écrit le sien via this.constructor).
     */
    toJSON(json){
        if(json == null || typeof json !== "object" || Array.isArray(json)) json = {};
        json.type = this.constructor.type;
        json.version = this.constructor.version;
        json.x = this.#x;
        json.y = this.#y;
        json.z = this.#z;
        json.floors = this.#floors;
        json.volumes = this.#volumes;
        json.floorsSpeed = this.#floorsSpeed;
        json.volumesSpeed = this.#volumesSpeed;
        json.walkable = this.#walkable;
        return json;
    }

    fromJSON(json){
        const v = json ?? {};
        this.#x = v.x ?? 0;
        this.#y = v.y ?? 0;
        this.#z = v.z ?? 0;
        this.#floors = v.floors ?? [];
        this.#volumes = v.volumes ?? [];
        this.#floorsSpeed = v.floorsSpeed ?? 0;
        this.#volumesSpeed = v.volumesSpeed ?? 0;
        this.#walkable = v.walkable ?? false;
        return this;
    }
}