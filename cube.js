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
    set x(value){ this.#x = value; }
    get y(){ return this.#y; }
    set y(value){ this.#y = value; }
    get z(){ return this.#z; }
    set z(value){ this.#z = value; }
    get speed(){ return this.#speed; }
    set speed(value){ this.#speed = value; }
    get floors(){ return this.#floors; }
    set floors(value){ this.#floors = value; }
    get north(){ return this.#north; }
    set north(value){ this.#north = value; }
    get west(){ return this.#west; }
    set west(value){ this.#west = value; }
    get volumes(){ return this.#volumes; }
    set volumes(value){ this.#volumes = value; }
    get walkable(){ return this.#walkable; }
    set walkable(value){ this.#walkable = value; }
    get floorOpen(){ return this.#floorOpen; }
    set floorOpen(value){ this.#floorOpen = value; }
    get northOpen(){ return this.#northOpen; }
    set northOpen(value){ this.#northOpen = value; }
    get westOpen(){ return this.#westOpen; }
    set westOpen(value){ this.#westOpen = value; }

    /**
     * Écrit dans l'objet json. type/version viennent de la classe réelle
     * (une sous-classe écrit le sien via this.constructor).
     */
    toJSON(json){
        if(json == null || typeof json !== "object" || Array.isArray(json)) json = {};
        json.type = this.constructor.type;
        json.version = this.constructor.version;
        json.x = this.x;
        json.y = this.y;
        json.z = this.z;
        json.speed = this.speed;
        json.floors = this.floors;
        json.north = this.north;
        json.west = this.west;
        json.volumes = this.volumes;
        json.northOpen = this.northOpen;
        json.westOpen = this.westOpen;
        json.floorOpen = this.floorOpen;
        json.walkable = this.walkable;
        return json;
    }

    fromJSON(json){
        if( json.x !== undefined ) this.x = json.x;
        if( json.y !== undefined ) this.y = json.y;
        if( json.z !== undefined ) this.z = json.z;
        if( json.speed !== undefined ) this.speed = json.speed;
        if( json.floors !== undefined ) this.floors = json.floors;
        if( json.north !== undefined ) this.north = json.north;
        if( json.west !== undefined ) this.west = json.west;
        if( json.volumes !== undefined ) this.volumes = json.volumes;
        if( json.northOpen !== undefined ) this.northOpen = json.northOpen;
        if( json.westOpen !== undefined ) this.westOpen = json.westOpen;
        if( json.floorOpen !== undefined ) this.floorOpen = json.floorOpen;
        if( json.walkable !== undefined ) this.walkable = json.walkable;
    }
}