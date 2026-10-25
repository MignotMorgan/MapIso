import { CoreMapView } from './Controls/Base/coreMapView.js';
import { Cube } from './cube.js';
import { Entity } from './entity.js';
import { Pathfinding } from './pathfinding.js';
import { Room } from './room.js';

export class WorldMap{

    static type = "WorldMap";
    static version = 1;

    #name = "";
    #width = 0;
    #height = 0;
    #depth = 0;
    #version = WorldMap.version;
    #cubes = [];
    #players = [];
    #entities = [];
    #rooms = [];
    #clock = {last:0, elapsed:0, time:0};

    /**
     * options : width, height, depth, name, version, cubes, players, entities, rooms.
     * width/height = taille du sol, depth = nombre d'étages.
     */
    constructor(options = {}){
        this.fromJSON(options);
    }

    get name(){ return this.#name; }
    set name(value){ this.#name = value ?? ""; }
    /** Version du document dont cette carte est issue, ou la version courante si elle est neuve. */
    get version(){ return this.#version; }
    get width(){ return this.#width; }
    get height(){ return this.#height; }
    get depth(){ return this.#depth; }
    get cubes(){ return this.#cubes; }
    get players(){ return this.#players; }
    get entities(){ return this.#entities; }
    get rooms(){ return this.#rooms; }
    /** Millisecondes du dernier tick. La vue les lit, elle ne les calcule pas. */
    get elapsed(){ return this.#clock.elapsed; }
    /** Millisecondes depuis le premier tick. Animations de textures, pas Date.now(). */
    get time(){ return this.#clock.time; }

    // === TEMPS ===
    /**
     * Un tour du monde : mesure le temps, puis tick joueurs et PNJ / objets.
     * Renvoie les entités dont la case logique a changé (toits, following…).
     */
    tick(){
        const elapsed = this.#measureElapsed();
        const moved = [];
        this.#tickList(this.#players, elapsed, moved);
        this.#tickList(this.#entities, elapsed, moved);
        return moved;
    }

    /**
     * Intention « aller ici ». Seule la carte pathfind et lance la marche :
     * la vue et le futur client n'ont qu'à envoyer l'id et la case.
     */
    goTo(id, wx, wy, wz){
        const entity = this.findEntity(id);
        if(entity === null || !entity.canMove) return false;
        return new Pathfinding(entity.x, entity.y, entity.z, this).moveTo(entity, wx, wy, wz);
    }

    #measureElapsed(){
        const now = Date.now();
        const clock = this.#clock;
        if(clock.last === 0){ clock.last = now; clock.elapsed = 0; clock.time = 0; return 0; }
        clock.elapsed = now - clock.last;
        clock.time += clock.elapsed;
        clock.last = now;
        return clock.elapsed;
    }

    #tickList(list, elapsed, moved){
        for(let i = 0; i < list.length; i++){
            const entity = list[i];
            if(entity == null) continue;
            if(entity.tick(elapsed)) moved[moved.length] = entity;
        }
    }
    // === GRILLE ===
    contains(x, y, z){
        return 0 <= x && x < this.#width
            && 0 <= y && y < this.#height
            && 0 <= z && z < this.#depth;
    }
    findCube(x, y, z){
        if(!this.contains(x, y, z)) return null;
        return this.#cubes[x][y][z] ?? null;
    }
    addCube(cube){
        if(cube !== null && (cube instanceof Cube) && this.contains(cube.x, cube.y, cube.z))
            this.#cubes[cube.x][cube.y][cube.z] = cube;
    }
    removeCube(x, y, z){
        const cube = this.findCube(x, y, z);
        if(cube !== null) this.#cubes[x][y][z] = null;
        return cube;
    }

    // === ENTITÉS ===
    addPlayer(entity){
        if (entity !== null && (entity instanceof Entity) && !this.findEntity(entity.id))
            this.#players[this.#players.length] = entity;
    }
    addEntity(entity){
        if (entity !== null && (entity instanceof Entity) && !this.findEntity(entity.id))
            this.#entities[this.#entities.length] = entity;
    }
    findEntity(id){
        for(let i = 0; i < this.#players.length; i++)
            if(this.#players[i] != null && this.#players[i].id === id)
                return this.#players[i];

        for(let i = 0; i < this.#entities.length; i++)
            if(this.#entities[i] != null && this.#entities[i].id === id)
                return this.#entities[i];

        return null;
    }
    indexPlayer(id){
        for(let i = 0; i < this.#players.length; i++)
            if(this.#players[i] !== null && this.#players[i].id === id)
                return i;
        return -1;
    }
    indexEntity(id){
        for(let i = 0; i < this.#entities.length; i++)
            if(this.#entities[i] !== null && this.#entities[i].id === id)
                return i;
        return -1;
    }
    removePlayer(id){
        const index = this.indexPlayer(id);
        let entity = null
        if (index !== -1){
            entity = this.#players[index];
            this.#players[index] = null;
        }
        return entity;
    }
    removeEntity(id){
        const index = this.indexEntity(id);
        let entity = null
        if (index !== -1){
            entity = this.#entities[index];
            this.#entities[index] = null;
        }
        return entity;
    }

    // === PIÈCES ===
    addRoom(room){
        if (room !== null && (room instanceof Room) && !this.findRoom(room.id))
            this.#rooms[this.#rooms.length] = room;
    }
    findRooms(wx, wy, wz){
        const list = [];
        for(let i = 0; i < this.#rooms.length; i++)
            if(this.#rooms[i] !== null && this.#rooms[i].contains(wx, wy, wz))
                list[list.length] = this.#rooms[i];
        return list;
    } 
    findRoom(id){
        for(let i = 0; i < this.#rooms.length; i++)
            if(this.#rooms[i] !== null && this.#rooms[i].id === id)
                return this.#rooms[i];
        return null;
    }
    indexRoom(id){
        for(let i = 0; i < this.#rooms.length; i++)
            if(this.#rooms[i] !== null && this.#rooms[i].id === id)
                return i;
        return -1;
    }
    removeRoom(id){
        const index = this.indexRoom(id);
        let room = null
        if (index !== -1){
            room = this.#rooms[index];
            this.#rooms[index] = null;
        }
        return room;
    }

    // === INTERNE ===
    static #emptyGrid(width, height, depth){
        const grid = new Array(width);
        for(let x = 0; x < width; x++)
        {
            grid[x] = new Array(height);
            for(let y = 0; y < height; y++)
                grid[x][y] = new Array(depth).fill(null);
        }
        return grid;
    }

    // === SAUVEGARDE ===
    toJSON(json){
        if(json == null || typeof json !== "object" || Array.isArray(json)) json = {};
        json.type = this.constructor.type;
        json.version = this.#version;
        json.name = this.#name;
        json.width = this.#width;
        json.height = this.#height;
        json.depth = this.#depth;
        json.cubes = [];
        for(let x = 0; x < this.#width; x++)
            for(let y = 0; y < this.#height; y++)
                for(let z = 0; z < this.#depth; z++){
                    const cube = this.#cubes[x][y][z];
                    if(cube !== null)
                        json.cubes[json.cubes.length] = cube.toJSON();
                    }
        json.players = WorldMap.#toJsonList(this.#players);
        json.entities = WorldMap.#toJsonList(this.#entities);
        json.rooms = WorldMap.#toJsonList(this.#rooms);
        return json;
    }

    fromJSON(json){
        const v = json ?? {};
        this.#width = v.width ?? this.#width;
        this.#height = v.height ?? this.#height;
        this.#depth = v.depth ?? this.#depth;
        this.#cubes = WorldMap.#emptyGrid(this.#width, this.#height, this.#depth);
        this.#name = v.name ?? "";
        this.#version = v.version ?? 1;
        this.#players = [];
        this.#entities = [];
        this.#rooms = [];
        const cubes = v.cubes ?? [];
        for(let i = 0; i < cubes.length; i++) this.addCube(CoreMapView.FactoryWorld.create(cubes[i]));
        const players = v.players ?? [];
        for(let i = 0; i < players.length; i++) this.addPlayer(CoreMapView.FactoryWorld.create(players[i]));
        const entities = v.entities ?? [];
        for(let i = 0; i < entities.length; i++) this.addEntity(CoreMapView.FactoryWorld.create(entities[i]));
        const rooms = v.rooms ?? [];
        for(let i = 0; i < rooms.length; i++) this.addRoom(CoreMapView.FactoryWorld.create(rooms[i]));
        return this;
    }
    
    static #toJsonList(list){
        const json = [];
        for(let i = 0; i < list.length; i++)
            if(list[i] != null) json[json.length] = list[i].toJSON();
        return json;
    }

}
