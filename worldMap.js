import { FactoryWorld } from './factoryWorld.js';
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
    // Temps maximal traité par tick : un onglet en veille ralentit le monde, sans téléporter personne.
    #maxElapsed = 250;
    #revision = 0;
    #entityRevision = 0;
    #roomRevision = 0;

    /**
     * fromJSON lit : width, height, depth, name, version, cubes, players, entities, rooms.
     * width/height = taille du sol, depth = nombre d'étages.
     */
    get name(){ return this.#name; }
    set name(value){ this.#name = value; }
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
    /** Compteur qui change à chaque modification de la grille de cubes. La vue s'en sert pour la relire. */
    get revision(){ return this.#revision; }
    /** Compteur qui change à chaque ajout, retrait ou remplacement des personnages et des entités. */
    get entityRevision(){ return this.#entityRevision; }
    /** Compteur qui change à chaque ajout, retrait ou remplacement des pièces. */
    get roomRevision(){ return this.#roomRevision; }

    // === TEMPS ===
    /**
     * Un tour du monde : mesure le temps, puis tick joueurs et PNJ / objets.
     * Renvoie les entités dont la case logique a changé (toits, following…).
     */
    tick(){
        const elapsed = this.#measureElapsed();
        const moved = [];
        this.#tickPlayer(elapsed, moved);
        this.#tickEntities(elapsed, moved);
        return moved;
    }

    #tickPlayer(elapsed, moved){
        for(let i = 0; i < this.players.length; i++){
            const entity = this.players[i];
            if(entity == null) continue;
            if(entity.tick(elapsed)) moved[moved.length] = entity;
        }
    }
    #tickEntities(elapsed, moved){
        for(let i = 0; i < this.entities.length; i++){
            const entity = this.entities[i];
            if(entity == null) continue;
            if(entity.tick(elapsed)) moved[moved.length] = entity;
        }
    }
    /**
     * Intention « aller ici ». Seule la carte pathfind et lance la marche :
     * la vue et le futur client n'ont qu'à envoyer l'id, la case et le point visé dedans.
     */
    goTo(id, wx, wy, wz, adjustment = null){
        const entity = this.findEntity(id);
        if(entity === null || !entity.canMove) return false;
        return new Pathfinding(entity.x, entity.y, entity.z, this).moveTo(entity, wx, wy, wz, adjustment);
    }

    #measureElapsed(){
        // performance.now ne recule jamais, contrairement à l'heure de l'ordinateur.
        const now = performance.now();
        const clock = this.#clock;
        if(clock.last === 0){ clock.last = now; clock.elapsed = 0; clock.time = 0; return 0; }
        clock.elapsed = Math.max(0, Math.min(now - clock.last, this.#maxElapsed));
        clock.time += clock.elapsed;
        clock.last = now;
        return clock.elapsed;
    }

    // === GRILLE ===
    contains(x, y, z){
        return 0 <= x && x < this.width
            && 0 <= y && y < this.height
            && 0 <= z && z < this.depth;
    }
    findCube(x, y, z){
        if(!this.contains(x, y, z)) return null;
        return this.cubes[x][y][z] ?? null;
    }
    addCube(cube){
        if(cube !== null && (cube instanceof Cube) && this.contains(cube.x, cube.y, cube.z)){
            this.cubes[cube.x][cube.y][cube.z] = cube;
            this.#revision++;
        }
    }
    removeCube(x, y, z){
        const cube = this.findCube(x, y, z);
        if(cube !== null){
            this.cubes[x][y][z] = null;
            this.#revision++;
        }
        return cube;
    }

    // === ENTITÉS ===
    addPlayer(entity){
        if (entity !== null && (entity instanceof Entity)){
            if (entity.id === "" || this.findEntity(entity.id) !== null) throw new Error('entity id "' + entity.id + '" is empty or already used');
            entity.worldMap = this;
            this.players[this.players.length] = entity;
            this.#entityRevision++;
        }
    }
    addEntity(entity){
        if (entity !== null && (entity instanceof Entity)){
            if (entity.id === "" || this.findEntity(entity.id) !== null) throw new Error('entity id "' + entity.id + '" is empty or already used');
            entity.worldMap = this;
            this.entities[this.entities.length] = entity;
            this.#entityRevision++;
        }
    }
    findEntity(id){
        for(let i = 0; i < this.players.length; i++)
            if(this.players[i] != null && this.players[i].id === id)
                return this.players[i];

        for(let i = 0; i < this.entities.length; i++)
            if(this.entities[i] != null && this.entities[i].id === id)
                return this.entities[i];

        return null;
    }
    /** Une entité non traversable occupe-t-elle ce point ? ignored : celle qui se déplace. */
    blocked(x, y, z, ignored = null){
        return this.#blockedByPlayers(x, y, z, ignored)
            || this.#blockedByEntities(x, y, z, ignored);
    }
    #blockedByPlayers( x, y, z, ignored){
        for(let i = 0; i < this.players.length; i++){
            const entity = this.players[i];
            if(entity != null && entity !== ignored && !entity.walkable && entity.contains(x, y, z))
                return true;
        }
        return false;
    }
    #blockedByEntities( x, y, z, ignored){
        for(let i = 0; i < this.entities.length; i++){
            const entity = this.entities[i];
            if(entity != null && entity !== ignored && !entity.walkable && entity.contains(x, y, z))
                return true;
        }
        return false;
    }
    indexPlayer(id){
        for(let i = 0; i < this.players.length; i++)
            if(this.players[i] !== null && this.players[i].id === id)
                return i;
        return -1;
    }
    indexEntity(id){
        for(let i = 0; i < this.entities.length; i++)
            if(this.entities[i] !== null && this.entities[i].id === id)
                return i;
        return -1;
    }
    removePlayer(id){
        const index = this.indexPlayer(id);
        let entity = null
        if (index !== -1){
            entity = this.players[index];
            entity.worldMap = null;
            this.players.splice(index, 1);
            this.#entityRevision++;
        }
        return entity;
    }
    removeEntity(id){
        const index = this.indexEntity(id);
        let entity = null
        if (index !== -1){
            entity = this.entities[index];
            entity.worldMap = null;
            this.entities.splice(index, 1);
            this.#entityRevision++;
        }
        return entity;
    }

    // === PIÈCES ===
    addRoom(room){
        if (room !== null && (room instanceof Room)){
            if (room.id === "" || this.findRoom(room.id) !== null) throw new Error('room id "' + room.id + '" is empty or already used');
            this.rooms[this.rooms.length] = room;
            this.#roomRevision++;
        }
    }
    findRooms(wx, wy, wz){
        const list = [];
        for(let i = 0; i < this.rooms.length; i++)
            if(this.rooms[i] !== null && this.rooms[i].contains(wx, wy, wz))
                list[list.length] = this.rooms[i];
        return list;
    } 
    findRoom(id){
        for(let i = 0; i < this.rooms.length; i++)
            if(this.rooms[i] !== null && this.rooms[i].id === id)
                return this.rooms[i];
        return null;
    }
    indexRoom(id){
        for(let i = 0; i < this.rooms.length; i++)
            if(this.rooms[i] !== null && this.rooms[i].id === id)
                return i;
        return -1;
    }
    removeRoom(id){
        const index = this.indexRoom(id);
        let room = null
        if (index !== -1){
            room = this.rooms[index];
            this.rooms.splice(index, 1);
            this.#roomRevision++;
        }
        return room;
    }

    // === INTERNE ===
    #emptyGrid(){
        this.#revision++;
        this.#cubes = new Array(this.width);
        for(let x = 0; x < this.width; x++)
        {
            this.cubes[x] = new Array(this.height);
            for(let y = 0; y < this.height; y++)
                this.cubes[x][y] = new Array(this.depth).fill(null);
        };
    }

    /** Recrée la grille aux dimensions courantes : les cubes encore dans la carte sont conservés. */
    #resizeGrid(){
        const cubes = this.cubes;
        this.#emptyGrid();
        for(let x = 0; x < cubes.length; x++)
            for(let y = 0; y < cubes[x].length; y++)
                for(let z = 0; z < cubes[x][y].length; z++)
                    this.addCube(cubes[x][y][z]);
    }

    // === SAUVEGARDE ===
    toJSON(json){
        if(json == null || typeof json !== "object" || Array.isArray(json)) json = {};
        json.type = this.constructor.type;
        json.version = this.version;
        json.name = this.name;
        json.width = this.width;
        json.height = this.height;
        json.depth = this.depth;
        json.cubes = [];
        for(let x = 0; x < this.width; x++)
            for(let y = 0; y < this.height; y++)
                for(let z = 0; z < this.depth; z++){
                    const cube = this.cubes[x][y][z];
                    if(cube !== null)
                        json.cubes[json.cubes.length] = cube.toJSON();
                    }
        json.players = WorldMap.#toJsonList(this.players);
        json.entities = WorldMap.#toJsonList(this.entities);
        json.rooms = WorldMap.#toJsonList(this.rooms);
        return json;
    }

    fromJSON(json){
        let grid = false;
        if (json.version != null) this.#version = json.version;
        if( json.name != null ) this.name = json.name;
        if( json.width != null ){grid = true; this.#width = json.width;}
        if( json.height != null ){grid = true; this.#height = json.height;}
        if( json.depth != null ){grid = true; this.#depth = json.depth;}
        if( json.cubes != null ){
             this.#emptyGrid();
            for(let i = 0; i < json.cubes.length; i++) this.addCube(FactoryWorld.instance.create(json.cubes[i]));
        }
        else if (grid) this.#resizeGrid();
        if( json.players != null ){
            this.#players = [];
            this.#entityRevision++;
            for(let i = 0; i < json.players.length; i++) this.addPlayer(FactoryWorld.instance.create(json.players[i]));
        }
        if( json.entities != null ){
            this.#entities = [];
            this.#entityRevision++;
            for(let i = 0; i < json.entities.length; i++) this.addEntity(FactoryWorld.instance.create(json.entities[i]));
        }
        if( json.rooms != null ){
            this.#rooms = [];
            this.#roomRevision++;
            for(let i = 0; i < json.rooms.length; i++) this.addRoom(FactoryWorld.instance.create(json.rooms[i]));
        }
    }
    
    static #toJsonList(list){
        const json = [];
        for(let i = 0; i < list.length; i++)
            if(list[i] != null) json[json.length] = list[i].toJSON();
        return json;
    }

}
