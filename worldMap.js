import { CoreIso } from './coreIso.js';
import { Cube } from './cubeIso.js';
import { Entity } from './entityIso.js';

/**
 * Zone rectangulaire du monde (typiquement une pièce) dont le plafond
 * doit disparaître quand le joueur se trouve à l'intérieur.
 *
 * (x,y,z) est le coin de la zone, (width,height,depth) sa taille en cubes.
 * height est la profondeur au sol (axe y), pas une hauteur : c'est le
 * vocabulaire hérité de l'ancien serveur, conservé pour rester compatible.
 */
export class NoCeilingZone{

    #x = 0;
    #y = 0;
    #z = 0;
    #width = 1;
    #height = 1;
    #depth = 1;

    constructor(x, y, z, width = 1, height = 1, depth = 1){
        this.#x = x ?? 0;
        this.#y = y ?? 0;
        this.#z = z ?? 0;
        this.#width = width ?? 1;
        this.#height = height ?? 1;
        this.#depth = depth ?? 1;
    }

    get x(){ return this.#x; }
    get y(){ return this.#y; }
    get z(){ return this.#z; }
    get width(){ return this.#width; }
    get height(){ return this.#height; }
    get depth(){ return this.#depth; }

    /** Le point est-il dans le volume de la zone ? Sert à savoir dans quelle pièce est une entité. */
    contains(px, py, pz){
        return this.#x <= px && px <= this.#x + this.#width
            && this.#y <= py && py <= this.#y + this.#height
            && this.#z <= pz && pz <= this.#z + this.#depth;
    }

    /**
     * Faut-il masquer le cube (px,py,pz) parce qu'il fait partie du plafond de cette zone ?
     * On masque tout ce qui est au-dessus du sol de la pièce (z strictement supérieur).
     * wallCeil décale le bord : à 0 les murs restent visibles, à 1 ils tombent aussi.
     */
    hides(px, py, pz, wallCeil = 0){
        return this.#x + wallCeil <= px && px <= this.#x + this.#width
            && this.#y + wallCeil <= py && py <= this.#y + this.#height
            && this.#z < pz;
    }

    /** Reconstruit une zone depuis du JSON (camelCase ou ancien format PascalCase). */
    static from(value){
        if(value instanceof NoCeilingZone) return value;
        const v = value ?? {};
        return new NoCeilingZone(
            v.x ?? v.X ?? 0,
            v.y ?? v.Y ?? 0,
            v.z ?? v.Z ?? 0,
            v.width ?? v.Width ?? 1,
            v.height ?? v.Height ?? 1,
            v.depth ?? v.Depth ?? 1
        );
    }

    toJSON(){
        return { x:this.#x, y:this.#y, z:this.#z,
                 width:this.#width, height:this.#height, depth:this.#depth };
    }
}

/**
 * Le monde : la grille 3D de cubes, les entités qui l'habitent et les zones sans plafond.
 *
 * C'est le modèle pur. Il ne sait rien de l'écran, du canvas ni de la souris :
 * MapView est la caméra qui regarde une WorldMap, et plusieurs vues peuvent
 * observer la même carte (minimap, aperçu de l'éditeur…).
 *
 * Repère : x et y forment le sol, z est l'altitude. Un cube occupe une cellule
 * entière, une entité occupe un volume width×width au sol et height en hauteur.
 *
 * La classe s'appelle WorldMap et non Map pour ne pas masquer le Map natif de
 * JavaScript ; la propriété reste nommée map partout ailleurs (mapView.map).
 */
export class WorldMap{

    #name = "";
    #width = 0;
    #height = 0;
    #depth = 0;
    //cubes : grille dense cubes[x][y][z], une cellule vide vaut null
    #cubes = [];
    //permanents : entités fixes du décor (bâtiments, arbres) chargées avec la carte
    #permanents = [];
    //entitys : entités mobiles (personnages, objets déplaçables)
    #entitys = [];
    //noCeiling : toutes les pièces déclarées sur la carte, pas seulement celles visibles
    #noCeiling = [];

    /**
     * width/height = taille du sol, depth = nombre d'étages.
     * options : name, cubes, permanents, entitys, noCeiling.
     */
    constructor(width, height, depth, options = {}){
        this.#width = WorldMap.#toSize(width);
        this.#height = WorldMap.#toSize(height);
        this.#depth = WorldMap.#toSize(depth);
        this.#cubes = WorldMap.#emptyGrid(this.#width, this.#height, this.#depth);

        this.#name = options.name ?? options.Name ?? "";

        const cubes = options.cubes ?? options.Cubes ?? null;
        if(cubes != null) this.loadCubes(cubes);

        const permanents = options.permanents ?? options.Permanents ?? [];
        for(let p = 0; p < permanents.length; p++) this.addPermanent(permanents[p]);

        const entitys = options.entitys ?? options.Entitys ?? [];
        for(let e = 0; e < entitys.length; e++) this.addEntity(entitys[e]);

        const zones = options.noCeiling ?? options.NoCeiling ?? [];
        for(let n = 0; n < zones.length; n++) this.addNoCeiling(zones[n]);
    }

    get name(){ return this.#name; }
    set name(value){ this.#name = value ?? ""; }
    get width(){ return this.#width; }
    get height(){ return this.#height; }
    get depth(){ return this.#depth; }
    get cubes(){ return this.#cubes; }
    get permanents(){ return this.#permanents; }
    get entitys(){ return this.#entitys; }
    get noCeiling(){ return this.#noCeiling; }

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

    /** Crée un cube et le place dans la grille. options : floors, volumes, cross… Retourne le cube. */
    setCube(x, y, z, options = {}){
        if(!this.inBounds(x, y, z)) return null;
        const cube = CoreIso.FactoryElementIso.createCube(x, y, z, options);
        this.#cubes[x][y][z] = cube;
        return cube;
    }

    /** Place un cube déjà construit (chargement réseau, copier-coller de l'éditeur). */
    addCube(cube){
        if(cube == null) return null;
        const x = cube.x ?? cube.X;
        const y = cube.y ?? cube.Y;
        const z = cube.z ?? cube.Z;
        if(!this.inBounds(x, y, z)) return null;
        this.#cubes[x][y][z] = cube;
        return cube;
    }

    /** Vide une cellule. Retourne le cube retiré, ou null. */
    removeCube(x, y, z){
        const cube = this.cubeAt(x, y, z);
        if(cube != null) this.#cubes[x][y][z] = null;
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
            if(cube != null) return cube;
        }
        return null;
    }

    /** Remplit tout un étage : map.fillFloor(0, { cross:true, floors:["herbe"] }). */
    fillFloor(z, options = {}){
        if(z < 0 || z >= this.#depth) return;
        for(let x = 0; x < this.#width; x++)
            for(let y = 0; y < this.#height; y++)
                this.setCube(x, y, z, options);
    }

    /** Parcourt les cellules occupées : map.forEachCube(cube => …). */
    forEachCube(action){
        if(typeof action != "function") return;
        for(let x = 0; x < this.#width; x++)
            for(let y = 0; y < this.#height; y++)
                for(let z = 0; z < this.#depth; z++)
                {
                    const cube = this.#cubes[x][y][z];
                    if(cube != null) action(cube, x, y, z);
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

    // === ENTITÉS ===

    /** Ajoute une entité mobile déjà construite. */
    addEntity(entity){
        return this.#attach(entity, this.#entitys);
    }

    /** Ajoute un élément de décor fixe déjà construit. */
    addPermanent(entity){
        return this.#attach(entity, this.#permanents);
    }

    /** Crée une entité mobile et la place sur la carte. options : id, width, body, canMove… */
    spawn(x, y, z, options = {}){
        return this.addEntity(CoreIso.FactoryElementIso.createEntity(x, y, z, options));
    }

    /** Idem pour un décor fixe (bâtiment, arbre). */
    spawnPermanent(x, y, z, options = {}){
        return this.addPermanent(CoreIso.FactoryElementIso.createEntity(x, y, z, options));
    }

    /** Cherche par identifiant : décors d'abord, puis mobiles. */
    findEntity(id){
        for(let p = 0; p < this.#permanents.length; p++)
            if(this.#permanents[p] != null && this.#permanents[p].id == id)
                return this.#permanents[p];

        for(let e = 0; e < this.#entitys.length; e++)
            if(this.#entitys[e] != null && this.#entitys[e].id == id)
                return this.#entitys[e];

        return null;
    }

    /** Retire une entité (mobile ou décor). Retourne l'entité retirée, ou null. */
    removeEntity(id){
        const removed = WorldMap.#pull(this.#entitys, id);
        if(removed != null) return removed;
        return WorldMap.#pull(this.#permanents, id);
    }

    /** Toutes les entités dont le volume contient ce point : décor et mobiles confondus. */
    entitysAt(x, y, z){
        const found = [];
        const all = this.#permanents.concat(this.#entitys);
        for(let i = 0; i < all.length; i++)
            if(all[i] != null && all[i].contains(x, y, z))
                found[found.length] = all[i];
        return found;
    }

    // === ZONES SANS PLAFOND ===

    /** Déclare une pièce : addNoCeiling(zone) ou addNoCeiling(x,y,z,width,height,depth). */
    addNoCeiling(x, y, z, width, height, depth){
        const zone = (typeof x == "object" || x == null)
            ? NoCeilingZone.from(x)
            : new NoCeilingZone(x, y, z, width, height, depth);
        this.#noCeiling[this.#noCeiling.length] = zone;
        return zone;
    }

    clearNoCeiling(){
        this.#noCeiling = [];
    }

    /**
     * Pièces contenant ce point : c'est ce que MapView garde en mémoire quand le
     * joueur entre dans un bâtiment, pour ensuite masquer le plafond correspondant.
     */
    zonesAt(x, y, z){
        const found = [];
        for(let i = 0; i < this.#noCeiling.length; i++)
            if(this.#noCeiling[i].contains(x, y, z))
                found[found.length] = this.#noCeiling[i];
        return found;
    }

    // === SAUVEGARDE ===

    /** Sérialise la carte (JSON.stringify(map) suffit). Seules les cellules occupées sont écrites. */
    toJSON(){
        const cubes = [];
        this.forEachCube(cube => { cubes[cubes.length] = cube; });
        return {
            name: this.#name,
            width: this.#width,
            height: this.#height,
            depth: this.#depth,
            cubes: cubes,
            permanents: this.#permanents,
            entitys: this.#entitys,
            noCeiling: this.#noCeiling
        };
    }

    /** Reconstruit une carte depuis du JSON (camelCase ou ancien format PascalCase). */
    static from(value){
        if(value instanceof WorldMap) return value;
        const v = value ?? {};
        return new WorldMap(
            v.width ?? v.Width ?? 0,
            v.height ?? v.Height ?? 0,
            v.depth ?? v.Depth ?? 0,
            v
        );
    }

    // === INTERNE ===

    // Accepte un Cube déjà construit ou un objet JSON, et le range dans la grille.
    #place(value){
        if(value == null) return;
        if(value instanceof Cube){ this.addCube(value); return; }
        this.setCube(value.x ?? value.X, value.y ?? value.Y, value.z ?? value.Z, value);
    }

    // Range l'entité dans la liste voulue et lui donne cette carte comme référence.
    // Un objet JSON est d'abord transformé en Entity : la carte ne contient que de vrais objets.
    #attach(value, list){
        if(value == null) return null;
        const entity = (value instanceof Entity)
            ? value
            : CoreIso.FactoryElementIso.createEntity(
                value.x ?? value.X ?? 0, value.y ?? value.Y ?? 0, value.z ?? value.Z ?? 0, value);
        entity.map = this;
        list[list.length] = entity;
        return entity;
    }

    static #pull(list, id){
        for(let i = 0; i < list.length; i++)
            if(list[i] != null && list[i].id == id)
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
