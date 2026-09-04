export class Cube{

    #x = 0;
    #y = 0;
    #z = 0;
    #floors = [];
    #volumes = [];
    #floorsSpeed = 0;
    #volumesSpeed = 0;
    #cross = false;

    constructor(x, y, z, options = {}){
        this.#x = x;
        this.#y = y;
        this.#z = z;

        this.#floors = options.floors ?? options.Floors ?? [];
        this.#volumes = options.volumes ?? options.Volumes ?? [];
        this.#floorsSpeed = options.floorsSpeed ?? options.Floors_Speed ?? 0;
        this.#volumesSpeed = options.volumesSpeed ?? options.Volumes_Speed ?? 0;
        this.#cross = options.cross ?? options.Cross ?? false;
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
    get cross(){ return this.#cross; }
    set cross(value){ this.#cross = !!value; }
}