export class Cube{

    #x = 0;
    #y = 0;
    #z = 0;
    #floors = [];
    #volumes = [];
    #floorsSpeed = 0;
    #volumesSpeed = 0;
    #walkable = false;

    constructor(x, y, z, options = {}){
        this.#x = x;
        this.#y = y;
        this.#z = z;

        this.#floors = options.floors ?? [];
        this.#volumes = options.volumes ?? [];
        this.#floorsSpeed = options.floorsSpeed ?? 0;
        this.#volumesSpeed = options.volumesSpeed ?? 0;
        this.#walkable = options.walkable ?? false;
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

    /** Les champs privés sont invisibles pour JSON.stringify : on les expose ici. */
    toJSON(){
        return {
            x: this.#x,
            y: this.#y,
            z: this.#z,
            floors: this.#floors,
            volumes: this.#volumes,
            floorsSpeed: this.#floorsSpeed,
            volumesSpeed: this.#volumesSpeed,
            walkable: this.#walkable
        };
    }
}