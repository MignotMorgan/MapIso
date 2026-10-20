import { CoreMapView } from './Controls/Base/coreMapView.js';
import { Cube } from './cube.js';
import { Entity } from './entity.js';
import { Pathfinding } from './pathfinding.js';
import { Room } from './room.js';

/**
 * Le monde : la grille 3D de cubes, les entités qui l'habitent et les pièces.
 *
 * C'est le modèle pur. Il ne sait rien de l'écran, du canvas ni de la souris :
 * MapView est la caméra qui regarde une WorldMap, et plusieurs vues peuvent
 * observer la même carte (minimap, aperçu de l'éditeur…).
 *
 * Repère : x et y forment le sol, z est l'altitude. Un cube occupe une cellule
 * entière, une entité occupe un volume width×width au sol et height en hauteur.
 *
 * La classe s'appelle WorldMap et non Map pour ne pas masquer le Map natif de
 * JavaScript ; la propriété s'appelle worldMap sur Entity et MapView.
 */
export class WorldMap{

    #name = "";
    #width = 0;
    #height = 0;
    #depth = 0;
    //cubes : grille dense cubes[x][y][z], une cellule vide vaut null
    #cubes = [];
    //players : les joueurs
    #players = [];
    //entities : PNJ et objets mobiles
    #entities = [];
    //rooms : toutes les pièces déclarées sur la carte, pas seulement celles ouvertes
    #rooms = [];
    //clock : seule horloge du monde (elapsed = dernière image, time = depuis le départ)
    #clock = {last:0, elapsed:0, time:0};

    /**
     * width/height = taille du sol, depth = nombre d'étages.
     * options : name, cubes, players, entities, rooms.
     */
    constructor(width, height, depth, options = {}){
        this.#width = WorldMap.#toSize(width);
        this.#height = WorldMap.#toSize(height);
        this.#depth = WorldMap.#toSize(depth);
        this.#cubes = WorldMap.#emptyGrid(this.#width, this.#height, this.#depth);

        this.#name = options.name ?? "";

        const cubes = options.cubes ?? null;
        if(cubes != null) this.loadCubes(cubes);

        const players = options.players ?? [];
        for(let i = 0; i < players.length; i++) this.addPlayer(players[i]);

        const entities = options.entities ?? [];
        for(let i = 0; i < entities.length; i++) this.addEntity(entities[i]);

        const rooms = options.rooms ?? [];
        for(let i = 0; i < rooms.length; i++) this.addRoom(rooms[i]);
    }

    get name(){ return this.#name; }
    set name(value){ this.#name = value ?? ""; }
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

    // === GRILLE ===

    /** La cellule existe-t-elle sur cette carte ? À appeler avant tout accès direct à cubes. */
    inBounds(x, y, z){
        return 0 <= x && x < this.#width
            && 0 <= y && y < this.#height
            && 0 <= z && z < this.#depth;
    }

    /** Cube d'une cellule, en O(1). null si la cellule est vide ou hors carte. */
    cubeAt(x, y, z){
        if(!this.inBounds(x, y, z)) return null;
        return this.#cubes[x][y][z] ?? null;
    }

    /** Crée un cube et le place dans la grille. options : floors, volumes, walkable… Retourne le cube. */
    setCube(x, y, z, options = {}){
        if(!this.inBounds(x, y, z)) return null;
        const cube = CoreMapView.FactoryWorld.createCube(x, y, z, options);
        this.#cubes[x][y][z] = cube;
        return cube;
    }

    /** Place un cube déjà construit (chargement réseau, copier-coller de l'éditeur). */
    addCube(cube){
        if(cube === null) return null;
        const x = cube.x;
        const y = cube.y;
        const z = cube.z;
        if(!this.inBounds(x, y, z)) return null;
        this.#cubes[x][y][z] = cube;
        return cube;
    }

    /** Vide une cellule. Retourne le cube retiré, ou null. */
    removeCube(x, y, z){
        const cube = this.cubeAt(x, y, z);
        if(cube !== null) this.#cubes[x][y][z] = null;
        return cube;
    }

    /** Charge une liste de cubes (JSON serveur) ou une grille [x][y][z] déjà formée. */
    loadCubes(cubes){
        if(cubes == null) return;
        if(Array.isArray(cubes) && Array.isArray(cubes[0]))
        {
            for(let x = 0; x < cubes.length; x++)
                for(let y = 0; y < (cubes[x]?.length ?? 0); y++)
                    for(let z = 0; z < (cubes[x][y]?.length ?? 0); z++)
                        this.#place(cubes[x][y][z]);
            return;
        }
        for(let i = 0; i < cubes.length; i++) this.#place(cubes[i]);
    }

    /** Cube le plus haut de la colonne (x,y) : le sol sur lequel poser une entité. */
    topCube(x, y){
        for(let z = this.#depth - 1; z >= 0; z--)
        {
            const cube = this.cubeAt(x, y, z);
            if(cube !== null) return cube;
        }
        return null;
    }

    /** Remplit tout un étage : worldMap.fillFloor(0, { walkable:true, floors:["herbe"] }). */
    fillFloor(z, options = {}){
        if(z < 0 || z >= this.#depth) return;
        for(let x = 0; x < this.#width; x++)
            for(let y = 0; y < this.#height; y++)
                this.setCube(x, y, z, options);
    }

    /** Parcourt les cellules occupées : worldMap.forEachCube(cube => …). */
    forEachCube(action){
        if(typeof action !== "function") return;
        for(let x = 0; x < this.#width; x++)
            for(let y = 0; y < this.#height; y++)
                for(let z = 0; z < this.#depth; z++)
                {
                    const cube = this.#cubes[x][y][z];
                    if(cube !== null) action(cube, x, y, z);
                }
    }

    /** Nombre de cellules occupées. Utile pour les compteurs de l'éditeur. */
    countCubes(){
        let total = 0;
        this.forEachCube(() => total++);
        return total;
    }

    /** Change les dimensions ; les cubes hors des nouvelles limites sont perdus. */
    resize(width, height, depth){
        const previous = this.#cubes;
        const oldWidth = this.#width;
        const oldHeight = this.#height;
        const oldDepth = this.#depth;

        this.#width = WorldMap.#toSize(width);
        this.#height = WorldMap.#toSize(height);
        this.#depth = WorldMap.#toSize(depth);
        this.#cubes = WorldMap.#emptyGrid(this.#width, this.#height, this.#depth);

        for(let x = 0; x < Math.min(oldWidth, this.#width); x++)
            for(let y = 0; y < Math.min(oldHeight, this.#height); y++)
                for(let z = 0; z < Math.min(oldDepth, this.#depth); z++)
                    this.#cubes[x][y][z] = previous[x][y][z];
    }

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

    // === ENTITÉS ===

    /** Ajoute un PNJ ou un objet mobile déjà construit. */
    addEntity(entity){
        return this.#attach(entity, this.#entities);
    }

    /** Ajoute un joueur déjà construit. */
    addPlayer(entity){
        return this.#attach(entity, this.#players);
    }

    /** Crée un PNJ ou un objet mobile. options : id, width, sprite, canMove… */
    spawn(x, y, z, options = {}){
        return this.addEntity(CoreMapView.FactoryWorld.createEntity(x, y, z, options));
    }

    /** Crée un joueur. */
    spawnPlayer(x, y, z, options = {}){
        return this.addPlayer(CoreMapView.FactoryWorld.createEntity(x, y, z, options));
    }

    /** Cherche par identifiant : joueurs d'abord, puis PNJ / objets. */
    findEntity(id){
        for(let i = 0; i < this.#players.length; i++)
            if(this.#players[i] != null && this.#players[i].id === id)
                return this.#players[i];

        for(let i = 0; i < this.#entities.length; i++)
            if(this.#entities[i] != null && this.#entities[i].id === id)
                return this.#entities[i];

        return null;
    }

    /** Retire un joueur, un PNJ ou un objet. Retourne l'entité retirée, ou null. */
    removeEntity(id){
        const removed = WorldMap.#pull(this.#players, id);
        if(removed !== null) return removed;
        return WorldMap.#pull(this.#entities, id);
    }

    /** Toutes les entités dont le volume contient ce point : joueurs et PNJ / objets. */
    entitiesAt(wx, wy, wz){
        const found = [];
        const all = this.#players.concat(this.#entities);
        for(let i = 0; i < all.length; i++)
            if(all[i] != null && all[i].contains(wx, wy, wz))
                found[found.length] = all[i];
        return found;
    }

    // === PIÈCES ===

    /** Déclare une pièce : addRoom(room) ou addRoom(x,y,z,width,height,depth). */
    addRoom(x, y, z, width, height, depth){
        const room = (typeof x === "object" || x == null)
            ? Room.from(x)
            : CoreMapView.FactoryWorld.createRoom(x, y, z, width, height, depth);
        this.#rooms[this.#rooms.length] = room;
        return room;
    }

    clearRooms(){
        this.#rooms = [];
    }

    /**
     * Pièces contenant ce point : c'est ce que MapView garde en mémoire quand le
     * joueur entre dans un bâtiment, pour ensuite masquer le plafond correspondant.
     */
    roomsAt(wx, wy, wz){
        const found = [];
        for(let i = 0; i < this.#rooms.length; i++)
            if(this.#rooms[i].contains(wx, wy, wz))
                found[found.length] = this.#rooms[i];
        return found;
    }

    // === SAUVEGARDE ===

    /** Sérialise la carte (JSON.stringify(worldMap) suffit). Seules les cellules occupées sont écrites. */
    toJSON(){
        const cubes = [];
        this.forEachCube(cube => { cubes[cubes.length] = cube; });
        return {
            name: this.#name,
            width: this.#width,
            height: this.#height,
            depth: this.#depth,
            cubes: cubes,
            players: this.#players,
            entities: this.#entities,
            rooms: this.#rooms
        };
    }

    /** Reconstruit une carte depuis du JSON. */
    static from(value){
        if(value instanceof WorldMap) return value;
        const v = value ?? {};
        return new WorldMap(
            v.width ?? 0,
            v.height ?? 0,
            v.depth ?? 0,
            v
        );
    }

    // === INTERNE ===

    // Accepte un Cube déjà construit ou un objet JSON, et le range dans la grille.
    #place(value){
        if(value == null) return;
        if(value instanceof Cube){ this.addCube(value); return; }
        this.setCube(value.x, value.y, value.z, value);
    }

    // Range l'entité dans la liste voulue et lui donne cette carte comme référence.
    // Un objet JSON est d'abord transformé en Entity : la carte ne contient que de vrais objets.
    #attach(value, list){
        if(value == null) return null;
        const entity = (value instanceof Entity)
            ? value
            : CoreMapView.FactoryWorld.createEntity(
                value.x ?? 0, value.y ?? 0, value.z ?? 0, value);
        entity.worldMap = this;
        list[list.length] = entity;
        return entity;
    }

    static #pull(list, id){
        for(let i = 0; i < list.length; i++)
            if(list[i] != null && list[i].id === id)
                return list.splice(i, 1)[0];
        return null;
    }

    static #toSize(value){
        const size = Math.floor(value ?? 0);
        return size > 0 ? size : 0;
    }

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
}
