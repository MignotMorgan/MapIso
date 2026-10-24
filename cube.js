export class Cube{

    static type = "Cube";
    static version = 1;

    #x = 0;
    #y = 0;
    #z = 0;
    #speed = 0;
    #floors = [];
    #north = [];
    #west = [];
    #volumes = [];
    #floorOpen = true;
    #northOpen = true;
    #westOpen = true;
    #walkable = true;

    constructor(options = {}){
        this.fromJSON(options);
    }

    get x(){ return this.#x; }
    get y(){ return this.#y; }
    get z(){ return this.#z; }
    get speed(){ return this.#speed; }
    set speed(value){ this.#speed = value ?? 0; }
    get floors(){ return this.#floors; }
    set floors(value){ this.#floors = value ?? []; }
    get north(){ return this.#north; }
    set north(value){ this.#north = value ?? []; }
    get west(){ return this.#west; }
    set west(value){ this.#west = value ?? []; }
    get volumes(){ return this.#volumes; }
    set volumes(value){ this.#volumes = value ?? []; }
    get walkable(){ return this.#walkable; }
    set walkable(value){ this.#walkable = !!value; }
    get northOpen(){ return this.#northOpen; }
    set northOpen(value){ this.#northOpen = !!value; }
    get westOpen(){ return this.#westOpen; }
    set westOpen(value){ this.#westOpen = !!value; }

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
        json.speed = this.#speed;
        json.floors = this.#floors;
        json.north = this.#north;
        json.west = this.#west;
        json.volumes = this.#volumes;
        json.northOpen = this.#northOpen;
        json.westOpen = this.#westOpen;
        json.floorOpen = this.#floorOpen;
        json.walkable = this.#walkable;
        return json;
    }

    fromJSON(json){
        const v = json ?? {};
        this.#x = v.x ?? 0;
        this.#y = v.y ?? 0;
        this.#z = v.z ?? 0;
        this.#speed = v.speed ?? 0;
        this.#floors = v.floors ?? [];
        this.#north = v.north ?? [];
        this.#west = v.west ?? [];
        this.#volumes = v.volumes ?? [];
        this.#northOpen = v.northOpen ?? true;
        this.#westOpen = v.westOpen ?? true;
        this.#floorOpen = v.floorOpen ?? true;
        this.#walkable = v.walkable ?? true;
        return this;
    }
}